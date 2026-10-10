import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { z } from 'zod';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { verifyPassword } from './password.mjs';
import { validateAsset, cropImage, detailedImage } from './assets.mjs';
import { collectionRoutes, placeItem } from './collection-routes.mjs';
import { itemSchema, cropSchema, types } from './collection-schema.mjs';
const uuid = z.string().uuid();
const bookSchema = itemSchema;
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
  // Compatibility aliases keep existing book clients working during independent deployments.
  app.use('/api/v1', (req, _res, next) => {
    req.url = req.url
      .replace(/^\/collection(?=\?|$)/, '/library')
      .replace(/^\/admin\/collection(?=\?|$)/, '/admin/library')
      .replace(/^\/admin\/items(?=\/|\?|$)/, '/admin/books')
      .replace(/^\/items(?=\/)/, '/books');
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
    const shelves = (
      await db.query('SELECT id,name,position,appearance FROM shelves ORDER BY position,id')
    ).rows;
    const records = (
      await db.query(
        `SELECT * FROM books ${admin ? '' : 'WHERE published=true'} ORDER BY position,id`,
      )
    ).rows;
    const links = (
      await db.query('SELECT * FROM book_assets WHERE book_id=ANY($1::uuid[])', [
        records.map((r) => r.id),
      ])
    ).rows;
    const genres = (await db.query('SELECT id,name FROM genres ORDER BY lower(name),id')).rows;
    const associations = (
      await db.query('SELECT * FROM book_genres WHERE book_id=ANY($1::uuid[])', [
        records.map((r) => r.id),
      ])
    ).rows;
    const assets = (
      await db.query('SELECT id,kind,mime,filename,details FROM assets WHERE id=ANY($1::uuid[])', [
        [
          ...records.flatMap((r) => [r.front, r.spine, r.back, r.digital, r.model]),
          ...links.map((l) => l.asset_id),
        ].filter(Boolean),
      ])
    ).rows;
    const books = records.map((row) => {
      const asset = (kind) => {
        const a = assets.find(
          (a) =>
            a.id ===
            (row[kind] || links.find((l) => l.book_id === row.id && l.role === kind)?.asset_id),
        );
        return a ? { id: a.id, mime: a.mime, filename: a.filename, ...a.details } : null;
      };
      const canRead = Boolean(row.digital && (admin || row.metadata.digitalAccess === 'public'));
      return {
        ...row.metadata,
        id: row.id,
        shelfId: row.shelf_id,
        position: row.position,
        published: row.published,
        updatedAt: row.updated_at,
        createdAt: row.created_at,
        category: types.find((t) => t.id === (row.metadata.objectType || 'book'))?.category,
        artwork: Object.fromEntries(
          links
            .filter(
              (l) =>
                l.book_id === row.id &&
                !l.role.startsWith('layer:') &&
                (l.role !== 'manual' || admin || row.metadata.digitalAccess === 'public'),
            )
            .map((l) => [l.role, asset(l.role)]),
        ),
        layerAssets: Object.fromEntries(
          links
            .filter((l) => l.book_id === row.id && l.role.startsWith('layer:'))
            .map((l) => [l.asset_id, asset(l.role)]),
        ),
        genreIds: associations.filter((g) => g.book_id === row.id).map((g) => g.genre_id),
        model: asset('model'),
        front: asset('front'),
        spine: asset('spine'),
        back: asset('back'),
        digital: canRead ? asset('digital') : null,
        canRead,
      };
    });
    return { shelves, books, genres };
  }
  api.get('/types', (_req, res) => res.json(types));
  api.get('/library', async (_req, res) => res.json(await library()));
  api.get('/admin/library', owner, async (_req, res) => res.json(await library(true)));
  api.post(
    '/admin/uploads',
    owner,
    rateLimit({ windowMs: 60 * 1000, limit: 30, legacyHeaders: false }),
    upload,
    async (req, res) => {
      const kind = z
        .enum([
          'front',
          'spine',
          'back',
          'digital',
          'model',
          'disc',
          'interior',
          'booklet',
          'card',
          'insert',
          'wrap',
          'decal',
          'manual',
        ])
        .parse(req.body.kind);
      if (!req.file) throw problem(400, 'Choose a file to upload.');
      let validated;
      try {
        validated = await validateAsset(req.file.buffer, kind, req.file.originalname);
      } catch (error) {
        throw problem(400, error.message);
      }
      const id = randomUUID(),
        originalKey = `originals/${id}`,
        textureKey = validated.texture ? `textures/${id}.webp` : null,
        normalizedKey = validated.normalized ? `models/${id}` : null;
      const filename = req.file.originalname.replace(/[\x00-\x1f\/\\]/g, '_').slice(0, 180);
      try {
        await s3.send(
          new PutObjectCommand({
            Bucket: config.bucket,
            Key: originalKey,
            Body: req.file.buffer,
            ContentType: validated.details?.sourceMime || validated.mime,
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
        if (normalizedKey)
          await s3.send(
            new PutObjectCommand({
              Bucket: config.bucket,
              Key: normalizedKey,
              Body: validated.normalized,
              ContentType: validated.mime,
            }),
          );
        await db.query(
          'INSERT INTO assets(id,kind,original_key,texture_key,mime,filename,bytes,details,normalized_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [
            id,
            kind,
            originalKey,
            textureKey,
            validated.mime,
            filename,
            req.file.size,
            validated.details || {},
            normalizedKey,
          ],
        );
      } catch (error) {
        await Promise.allSettled(
          [originalKey, textureKey, normalizedKey]
            .filter(Boolean)
            .map((Key) => s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key }))),
        );
        throw error;
      }
      res.status(201).json({ id, mime: validated.mime, filename, ...validated.details });
    },
  );
  api.post(
    '/admin/assets/:id/crop',
    owner,
    rateLimit({ windowMs: 60000, limit: 30, legacyHeaders: false }),
    async (req, res) => {
      const crop = cropSchema.parse(req.body);
      const source = (
        await db.query('SELECT * FROM assets WHERE id=$1', [uuid.parse(req.params.id)])
      ).rows[0];
      if (!source || ['digital', 'model', 'manual'].includes(source.kind))
        throw problem(404, 'Artwork not found.');
      const original = await s3.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: source.original_key }),
      );
      const buffer = Buffer.from(await original.Body.transformToByteArray());
      const processed = await cropImage(buffer, crop);
      const id = randomUUID(),
        originalKey = `originals/${id}`,
        textureKey = `textures/${id}.webp`;
      try {
        await s3.send(
          new PutObjectCommand({
            Bucket: config.bucket,
            Key: originalKey,
            Body: buffer,
            ContentType: source.mime,
          }),
        );
        await s3.send(
          new PutObjectCommand({
            Bucket: config.bucket,
            Key: textureKey,
            Body: processed.texture,
            ContentType: 'image/webp',
          }),
        );
        await db.query(
          'INSERT INTO assets(id,kind,original_key,texture_key,mime,filename,bytes,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [
            id,
            source.kind,
            originalKey,
            textureKey,
            source.mime,
            source.filename,
            buffer.length,
            processed.details,
          ],
        );
      } catch (e) {
        await Promise.allSettled(
          [originalKey, textureKey].map((Key) =>
            s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key })),
          ),
        );
        throw e;
      }
      res
        .status(201)
        .json({ id, mime: source.mime, filename: source.filename, ...processed.details });
    },
  );
  api.get('/books/:id', async (req, res) => {
    const data = await library(await session(req));
    const item = data.books.find((b) => b.id === uuid.parse(req.params.id));
    if (!item) throw problem(404, 'Item not found.');
    res.json(item);
  });
  const detailJobs = new Map();
  let detailQueue = Promise.resolve();
  function detailTexture(asset) {
    if (detailJobs.has(asset.id)) return detailJobs.get(asset.id);
    const task = detailQueue.then(async () => {
      const existing = (await db.query('SELECT detail_key FROM assets WHERE id=$1', [asset.id]))
        .rows[0]?.detail_key;
      if (existing) return existing;
      const source = await s3.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: asset.original_key }),
      );
      const image = await detailedImage(
          Buffer.from(await source.Body.transformToByteArray()),
          asset.details,
        ),
        key = `details/${asset.id}.webp`;
      await s3.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: image,
          ContentType: 'image/webp',
        }),
      );
      await db.query('UPDATE assets SET detail_key=$2 WHERE id=$1', [asset.id, key]);
      return key;
    });
    detailQueue = task.catch(() => {});
    detailJobs.set(asset.id, task);
    task.then(
      () => detailJobs.delete(asset.id),
      () => detailJobs.delete(asset.id),
    );
    return task;
  }
  api.get('/assets/:id', async (req, res) => {
    const id = uuid.parse(req.params.id);
    const admin = await session(req);
    const asset = (await db.query('SELECT * FROM assets WHERE id=$1', [id])).rows[0];
    if (!asset || ['digital', 'manual'].includes(asset.kind))
      throw problem(404, 'Artwork not found.');
    if (
      !admin &&
      !(
        await db.query(
          "SELECT 1 FROM books WHERE published=true AND ($1=front OR $1=spine OR $1=back OR $1=model OR EXISTS (SELECT 1 FROM book_assets ba WHERE ba.book_id=books.id AND ba.asset_id=$1 AND ba.role NOT IN ('wrap','manual')))",
          [id],
        )
      ).rowCount
    )
      throw problem(404, 'Artwork not found.');
    const original = req.query.original === '1';
    if (original && !admin) throw problem(403, 'Original artwork is private.');
    if (req.query.quality === 'detail' && !original && asset.kind !== 'model' && !asset.detail_key)
      asset.detail_key = await detailTexture(asset);
    const data = await s3.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: original
          ? asset.original_key
          : asset.kind === 'model'
            ? asset.normalized_key || asset.original_key
            : req.query.quality === 'detail'
              ? asset.detail_key
              : asset.texture_key,
      }),
    );
    res.type(
      original
        ? asset.details?.sourceMime || asset.mime
        : asset.kind === 'model'
          ? asset.mime
          : 'image/webp',
    );
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Content-Length', String(data.ContentLength));
    data.Body.on('error', () => res.destroy());
    data.Body.pipe(res);
  });
  api.get('/books/:id/read', async (req, res) => {
    const row = (
      await db.query(
        "SELECT b.*,a.original_key,a.mime,a.filename FROM books b JOIN assets a ON a.id=CASE WHEN $2='manual' THEN (SELECT asset_id FROM book_assets WHERE book_id=b.id AND role='manual') ELSE b.digital END WHERE b.id=$1",
        [uuid.parse(req.params.id), req.query.role === 'manual' ? 'manual' : 'digital'],
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
  collectionRoutes({ api, db, s3, config, owner, problem, reorder });
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
    // Existing deployed clients echo read-side asset descriptors. Normalize only
    // these known fields; ownership and role validation still run below.
    const payload = { ...req.body };
    delete payload.layerAssets;
    if (payload.artwork && typeof payload.artwork === 'object' && !Array.isArray(payload.artwork))
      payload.artwork = Object.fromEntries(
        Object.entries(payload.artwork).map(([role, value]) => [
          role,
          value && typeof value === 'object' ? value.id : value,
        ]),
      );
    const input = bookSchema.parse(payload);

    const {
      shelfId,
      published,
      front,
      spine,
      back,
      digital,
      model,
      artwork,
      layers,
      genreIds,
      placement,
      ...metadata
    } = input;
    metadata.layers = layers;
    const client = await db.connect();
    let id = create ? randomUUID() : uuid.parse(req.params.id);
    try {
      await client.query('BEGIN');
      await client.query('LOCK TABLE books IN EXCLUSIVE MODE');
      const references = { ...artwork };
      for (const [surface, list] of Object.entries(layers))
        for (const layer of list)
          if (layer.type === 'image')
            references['layer:' + surface + ':' + layer.id] = layer.assetId;
      for (const [kind, value] of Object.entries({
        front,
        spine,
        back,
        digital,
        model,
        ...references,
      }))
        if (
          value &&
          !(
            await client.query('SELECT 1 FROM assets WHERE id=$1 AND kind=$2 FOR KEY SHARE', [
              value,
              kind.startsWith('layer:') ? 'decal' : kind,
            ])
          ).rowCount
        )
          throw problem(400, `Invalid ${kind} asset.`);
      if (create)
        await client.query(
          'INSERT INTO books(id,shelf_id,published,metadata,front,spine,back,digital,model,position) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,(SELECT count(*) FROM books))',
          [id, shelfId, published, metadata, front, spine, back, digital, model],
        );
      else if (
        !(
          await client.query(
            'UPDATE books SET shelf_id=$2,published=$3,metadata=$4,front=$5,spine=$6,back=$7,digital=$8,model=$9,updated_at=now() WHERE id=$1',
            [id, shelfId, published, metadata, front, spine, back, digital, model],
          )
        ).rowCount
      )
        throw problem(404, 'Book not found.');
      await client.query('DELETE FROM book_assets WHERE book_id=$1', [id]);
      for (const [role, value] of Object.entries(references))
        if (value)
          await client.query('INSERT INTO book_assets(book_id,role,asset_id) VALUES($1,$2,$3)', [
            id,
            role,
            value,
          ]);
      if (genreIds !== undefined) {
        if (new Set(genreIds).size !== genreIds.length)
          throw problem(400, 'Choose each genre once.');
        if (
          (await client.query('SELECT id FROM genres WHERE id=ANY($1::uuid[])', [genreIds]))
            .rowCount !== genreIds.length
        )
          throw problem(409, 'A selected genre no longer exists.');
        await client.query('DELETE FROM book_genres WHERE book_id=$1', [id]);
        for (const genre of genreIds)
          await client.query('INSERT INTO book_genres(book_id,genre_id) VALUES($1,$2)', [
            id,
            genre,
          ]);
      }
      if (placement) await placeItem(client, id, { shelfId, ...placement }, problem);
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
          'SELECT id,kind,filename,bytes,created_at FROM assets WHERE NOT EXISTS (SELECT 1 FROM books WHERE assets.id IN (front,spine,back,digital,model)) AND NOT EXISTS (SELECT 1 FROM book_assets WHERE asset_id=assets.id) ORDER BY created_at DESC',
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
          (
            await client.query(
              'SELECT 1 FROM books WHERE $1 IN (front,spine,back,digital,model) UNION ALL SELECT 1 FROM book_assets WHERE asset_id=$1',
              [id],
            )
          ).rowCount
        )
          throw problem(409, 'This asset is still used by a book.');
        await Promise.all(
          [asset.original_key, asset.texture_key, asset.detail_key, asset.normalized_key]
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
          : ['23503', '23505'].includes(err.code)
            ? 409
            : err.status || 500;
    const message =
      err instanceof z.ZodError
        ? 'Check the submitted fields and try again.'
        : err instanceof multer.MulterError
          ? 'Upload exceeds the file limit.'
          : err.code === '23505'
            ? 'This name already exists.'
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
