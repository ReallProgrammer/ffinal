import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { z } from 'zod';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { verifyPassword } from './password.mjs';
import { validateAsset } from './assets.mjs';
const uuid = z.string().uuid();
const bookSchema = z
  .object({
    title: z.string().trim().min(1).max(180),
    author: z.string().trim().min(1).max(120),
    description: z.string().max(6000).default(''),
    genre: z.string().trim().max(80).default(''),
    year: z.number().int().min(1).max(2200).nullable().default(null),
    isbn: z.string().max(32).default(''),
    color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
    height: z.number().min(1.6).max(3.6),
    width: z.number().min(1).max(2.6),
    thickness: z.number().min(0.12).max(0.8),
    shelfId: uuid,
    published: z.boolean().default(false),
    digitalAccess: z.enum(['private', 'public']).default('private'),
    front: uuid.nullable().default(null),
    spine: uuid.nullable().default(null),
    back: uuid.nullable().default(null),
    digital: uuid.nullable().default(null),
  })
  .strict();
const shelfSchema = z.object({ name: z.string().trim().min(1).max(100) }).strict();
const hash = (value) => createHash('sha256').update(value).digest('hex');
const problem = (status, message) => Object.assign(new Error(message), { status });
export function createApp({ db, s3, config }) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);
  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        cb(null, !origin || config.origins.includes(origin));
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
  app.use(express.json({ limit: '64kb' }));
  app.use('/api/v1', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  const api = express.Router();
  app.use('/api/v1', api);
  const limited = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many sign-in attempts. Try again in 15 minutes.' },
  });
  async function session(req) {
    const token = /^Bearer ([a-zA-Z0-9_-]{43})$/.exec(req.headers.authorization || '')?.[1];
    if (!token) return false;
    const result = await db.query(
      'SELECT 1 FROM sessions WHERE token_hash=$1 AND expires_at>now()',
      [hash(token)],
    );
    return result.rowCount > 0;
  }
  const owner = async (req, _res, next) => {
    if (!(await session(req))) throw problem(401, 'Owner sign-in required.');
    next();
  };
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 1 },
  }).single('file');
  api.get('/health', async (_req, res) => {
    await db.query('SELECT 1');
    res.json({ status: 'ok' });
  });
  api.post('/session', limited, async (req, res) => {
    const input = z
      .object({ email: z.string().email().max(254), password: z.string().min(1).max(256) })
      .strict()
      .parse(req.body);
    // Always run the password derivation, including for unknown addresses.
    const passwordOK = verifyPassword(input.password, config.passwordHash);
    if (!passwordOK || input.email.toLowerCase() !== config.ownerEmail)
      throw problem(401, 'Email or password is incorrect.');
    const token = randomBytes(32).toString('base64url');
    await db.query('DELETE FROM sessions WHERE expires_at<now()');
    await db.query(
      "INSERT INTO sessions(token_hash,expires_at) VALUES($1,now()+interval '8 hours')",
      [hash(token)],
    );
    res.json({ token, expiresIn: 28800, email: config.ownerEmail });
  });
  api.delete('/session', owner, async (req, res) => {
    await db.query('DELETE FROM sessions WHERE token_hash=$1', [
      hash(req.headers.authorization.slice(7)),
    ]);
    res.sendStatus(204);
  });
  api.get('/session', owner, (_req, res) => res.json({ email: config.ownerEmail }));
  async function library(admin = false) {
    const shelves = (await db.query('SELECT id,name,position FROM shelves ORDER BY position,id'))
      .rows;
    const records = (
      await db.query(
        `SELECT * FROM books ${admin ? '' : 'WHERE published=true'} ORDER BY position,id`,
      )
    ).rows;
    const assets = (
      await db.query('SELECT id,kind,mime,filename FROM assets WHERE id=ANY($1::uuid[])', [
        records.flatMap((r) => [r.front, r.spine, r.back, r.digital]).filter(Boolean),
      ])
    ).rows;
    const books = records.map((row) => {
      const asset = (kind) => {
        const a = assets.find((a) => a.id === row[kind]);
        return a ? { id: a.id, mime: a.mime, filename: a.filename } : null;
      };
      const canRead = Boolean(row.digital && (admin || row.metadata.digitalAccess === 'public'));
      return {
        ...row.metadata,
        id: row.id,
        shelfId: row.shelf_id,
        position: row.position,
        published: row.published,
        updatedAt: row.updated_at,
        front: asset('front'),
        spine: asset('spine'),
        back: asset('back'),
        digital: canRead ? asset('digital') : null,
        canRead,
      };
    });
    return { shelves, books };
  }
  api.get('/library', async (_req, res) => res.json(await library()));
  api.get('/admin/library', owner, async (_req, res) => res.json(await library(true)));
  api.post(
    '/admin/uploads',
    owner,
    rateLimit({ windowMs: 60 * 1000, limit: 30, legacyHeaders: false }),
    upload,
    async (req, res) => {
      const kind = z.enum(['front', 'spine', 'back', 'digital']).parse(req.body.kind);
      if (!req.file) throw problem(400, 'Choose a file to upload.');
      let validated;
      try {
        validated = await validateAsset(req.file.buffer, kind);
      } catch (error) {
        throw problem(400, error.message);
      }
      const id = randomUUID(),
        originalKey = `originals/${id}`,
        textureKey = validated.texture ? `textures/${id}.webp` : null;
      const filename = req.file.originalname.replace(/[\x00-\x1f\/\\]/g, '_').slice(0, 180);
      try {
        await s3.send(
          new PutObjectCommand({
            Bucket: config.bucket,
            Key: originalKey,
            Body: req.file.buffer,
            ContentType: validated.mime,
          }),
        );
        if (textureKey)
          await s3.send(
            new PutObjectCommand({
              Bucket: config.bucket,
              Key: textureKey,
              Body: validated.texture,
              ContentType: 'image/webp',
            }),
          );
        await db.query(
          'INSERT INTO assets(id,kind,original_key,texture_key,mime,filename,bytes) VALUES($1,$2,$3,$4,$5,$6,$7)',
          [id, kind, originalKey, textureKey, validated.mime, filename, req.file.size],
        );
      } catch (error) {
        await Promise.allSettled(
          [originalKey, textureKey]
            .filter(Boolean)
            .map((Key) => s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key }))),
        );
        throw error;
      }
      res.status(201).json({ id, mime: validated.mime, filename });
    },
  );
  api.get('/assets/:id', async (req, res) => {
    const id = uuid.parse(req.params.id);
    const admin = await session(req);
    const asset = (await db.query('SELECT * FROM assets WHERE id=$1', [id])).rows[0];
    if (!asset || asset.kind === 'digital') throw problem(404, 'Artwork not found.');
    if (
      !admin &&
      !(
        await db.query(
          'SELECT 1 FROM books WHERE published=true AND ($1=front OR $1=spine OR $1=back)',
          [id],
        )
      ).rowCount
    )
      throw problem(404, 'Artwork not found.');
    const original = req.query.original === '1';
    if (original && !admin) throw problem(403, 'Original artwork is private.');
    const data = await s3.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: original ? asset.original_key : asset.texture_key,
      }),
    );
    res.type(original ? asset.mime : 'image/webp');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Content-Length', String(data.ContentLength));
    data.Body.on('error', () => res.destroy());
    data.Body.pipe(res);
  });
  api.get('/books/:id/read', async (req, res) => {
    const row = (
      await db.query(
        'SELECT b.*,a.original_key,a.mime,a.filename FROM books b JOIN assets a ON b.digital=a.id WHERE b.id=$1',
        [uuid.parse(req.params.id)],
      )
    ).rows[0];
    if (
      !row ||
      (!(await session(req)) && (!row.published || row.metadata.digitalAccess !== 'public'))
    )
      throw problem(404, 'This reading file is not available.');
    const file = await s3.send(
      new GetObjectCommand({ Bucket: config.bucket, Key: row.original_key }),
    );
    res.type(row.mime);
    res.set(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
    );
    res.set('Content-Length', String(file.ContentLength));
    file.Body.on('error', () => res.destroy());
    file.Body.pipe(res);
  });
  api.post('/admin/shelves', owner, async (req, res) => {
    const { name } = shelfSchema.parse(req.body);
    const id = randomUUID();
    await db.query(
      'INSERT INTO shelves(id,name,position) VALUES($1,$2,(SELECT count(*) FROM shelves))',
      [id, name],
    );
    res.status(201).json({ id });
  });
  api.put('/admin/shelves/order', owner, async (req, res) => {
    await reorder('shelves', req.body);
    res.sendStatus(204);
  });
  api.put('/admin/shelves/:id', owner, async (req, res) => {
    const { name } = shelfSchema.parse(req.body);
    if (
      !(await db.query('UPDATE shelves SET name=$1 WHERE id=$2', [name, uuid.parse(req.params.id)]))
        .rowCount
    )
      throw problem(404, 'Shelf not found.');
    res.sendStatus(204);
  });
  api.delete('/admin/shelves/:id', owner, async (req, res) => {
    await db.query('DELETE FROM shelves WHERE id=$1', [uuid.parse(req.params.id)]);
    res.sendStatus(204);
  });
  api.put('/admin/books/order', owner, async (req, res) => {
    await reorder('books', req.body);
    res.sendStatus(204);
  });
  async function reorder(table, body) {
    const ids = z
      .object({ ids: z.array(uuid).max(1000) })
      .strict()
      .parse(body).ids;
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(`LOCK TABLE ${table} IN EXCLUSIVE MODE`);
      const existing = (await client.query(`SELECT id FROM ${table}`)).rows.map((r) => r.id);
      if (
        ids.length !== existing.length ||
        new Set(ids).size !== ids.length ||
        existing.some((id) => !ids.includes(id))
      )
        throw problem(409, 'Order must include every item once. Refresh and try again.');
      for (let i = 0; i < ids.length; i++)
        await client.query(`UPDATE ${table} SET position=$1 WHERE id=$2`, [i, ids[i]]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
  async function saveBook(req, res, create) {
    const input = bookSchema.parse(req.body);
    if (input.published && !input.front)
      throw problem(400, 'Upload a front cover before publishing.');
    const { shelfId, published, front, spine, back, digital, ...metadata } = input;
    const client = await db.connect();
    let id = create ? randomUUID() : uuid.parse(req.params.id);
    try {
      await client.query('BEGIN');
      for (const [kind, value] of Object.entries({ front, spine, back, digital }))
        if (
          value &&
          !(
            await client.query('SELECT 1 FROM assets WHERE id=$1 AND kind=$2 FOR KEY SHARE', [
              value,
              kind,
            ])
          ).rowCount
        )
          throw problem(400, `Invalid ${kind} asset.`);
      if (create)
        await client.query(
          'INSERT INTO books(id,shelf_id,published,metadata,front,spine,back,digital,position) VALUES($1,$2,$3,$4,$5,$6,$7,$8,(SELECT count(*) FROM books))',
          [id, shelfId, published, metadata, front, spine, back, digital],
        );
      else if (
        !(
          await client.query(
            'UPDATE books SET shelf_id=$2,published=$3,metadata=$4,front=$5,spine=$6,back=$7,digital=$8,updated_at=now() WHERE id=$1',
            [id, shelfId, published, metadata, front, spine, back, digital],
          )
        ).rowCount
      )
        throw problem(404, 'Book not found.');
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    res.status(create ? 201 : 200).json({ id });
  }
  api.post('/admin/books', owner, (req, res) => saveBook(req, res, true));
  api.put('/admin/books/:id', owner, (req, res) => saveBook(req, res, false));
  api.delete('/admin/books/:id', owner, async (req, res) => {
    await db.query('DELETE FROM books WHERE id=$1', [uuid.parse(req.params.id)]);
    res.sendStatus(204);
  });
  api.get('/admin/assets', owner, async (_req, res) =>
    res.json(
      (
        await db.query(
          'SELECT id,kind,filename,bytes,created_at FROM assets WHERE NOT EXISTS (SELECT 1 FROM books WHERE assets.id IN (front,spine,back,digital)) ORDER BY created_at DESC',
        )
      ).rows,
    ),
  );
  api.delete('/admin/assets/:id', owner, async (req, res) => {
    const id = uuid.parse(req.params.id);
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const asset = (await client.query('SELECT * FROM assets WHERE id=$1 FOR UPDATE', [id]))
        .rows[0];
      if (asset) {
        if (
          (await client.query('SELECT 1 FROM books WHERE $1 IN (front,spine,back,digital)', [id]))
            .rowCount
        )
          throw problem(409, 'This asset is still used by a book.');
        await Promise.all(
          [asset.original_key, asset.texture_key]
            .filter(Boolean)
            .map((Key) => s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key }))),
        );
        await client.query('DELETE FROM assets WHERE id=$1', [id]);
      }
      await client.query('COMMIT');
      res.sendStatus(204);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });
  app.use((_req, _res, next) => next(problem(404, 'Endpoint not found.')));
  app.use((err, _req, res, _next) => {
    const status =
      err instanceof z.ZodError
        ? 400
        : err instanceof multer.MulterError
          ? 413
          : err.code === '23503'
            ? 409
            : err.status || 500;
    const message =
      err instanceof z.ZodError
        ? 'Check the submitted fields and try again.'
        : err instanceof multer.MulterError
          ? 'Upload exceeds the file limit.'
          : err.code === '23503'
            ? 'The shelf or asset is in use, or no longer exists.'
            : status === 500
              ? 'The library service could not complete this request.'
              : err.message;
    if (status === 500) console.error('Library request failed:', err.code || err.name);
    res.status(status).json({ error: message });
  });
  return app;
}
