import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { fileTypeFromBuffer } from 'file-type';
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
const problem = (status, message) => Object.assign(new Error(message), { status });
const uuid = z.string().uuid();
const title = z.string().trim().min(1).max(160);
const descriptor = (row) => ({
  id: row.id,
  title: row.title,
  kind: row.kind,
  mime: row.mime,
  bytes: Number(row.bytes),
  published: row.published,
  url: row.source_url || null,
  createdAt: row.created_at,
});
export function mediaRoutes(api, { db, s3, config, owner, session }) {
  api.get('/media', async (_req, res) =>
    res.json(
      (await db.query('SELECT * FROM media_items WHERE published ORDER BY created_at,id')).rows.map(
        descriptor,
      ),
    ),
  );
  api.get('/admin/media', owner, async (_req, res) =>
    res.json(
      (await db.query('SELECT * FROM media_items ORDER BY created_at,id')).rows.map(descriptor),
    ),
  );
  api.post('/admin/media/links', owner, async (req, res) => {
    const input = z
      .object({
        title,
        kind: z.enum(['audio', 'video']),
        url: z
          .string()
          .url()
          .max(2048)
          .refine((v) => {
            const u = new URL(v);
            return u.protocol === 'https:' && !u.username && !u.password;
          }),
        published: z.boolean().default(false),
      })
      .strict()
      .parse(req.body);
    const row = (
      await db.query(
        'INSERT INTO media_items(id,title,kind,mime,source_url,published) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
        [
          randomUUID(),
          input.title,
          input.kind,
          input.kind === 'audio' ? 'audio/mpeg' : 'video/mp4',
          input.url,
          input.published,
        ],
      )
    ).rows[0];
    res.status(201).json(descriptor(row));
  });
  let uploads = 0;
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024, files: 1, fields: 2 },
  }).single('file');
  api.post(
    '/admin/media/uploads',
    owner,
    rateLimit({ windowMs: 3600000, limit: 30, legacyHeaders: false }),
    async (req, res, next) => {
      if (uploads >= 1)
        throw problem(429, 'Another media upload is in progress. Try again in a moment.');
      uploads++;
      let released = false;
      const release = () => {
        if (!released) {
          released = true;
          uploads--;
        }
      };
      res.once('close', release);
      res.once('finish', release);
      upload(req, res, async (error) => {
        if (error) {
          release();
          next(error);
          return;
        }
        try {
          if (!req.file) throw problem(400, 'Choose an MP3 or MP4 file.');
          const input = z
            .object({ title, published: z.enum(['true', 'false']).default('false') })
            .strict()
            .parse(req.body);
          const type = await fileTypeFromBuffer(req.file.buffer).catch(() => undefined);
          if (!type || !['audio/mpeg', 'video/mp4', 'audio/mp4'].includes(type.mime))
            throw problem(400, 'Only genuine MP3 or MP4 media files are supported.');
          const id = randomUUID(),
            key = 'media/' + id,
            kind = type.mime.startsWith('audio/') ? 'audio' : 'video';
          await s3.send(
            new PutObjectCommand({
              Bucket: config.bucket,
              Key: key,
              Body: req.file.buffer,
              ContentType: type.mime,
            }),
          );
          try {
            const row = (
              await db.query(
                'INSERT INTO media_items(id,title,kind,mime,object_key,bytes,published) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
                [id, input.title, kind, type.mime, key, req.file.size, input.published === 'true'],
              )
            ).rows[0];
            res.status(201).json(descriptor(row));
          } catch (e) {
            await s3
              .send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }))
              .catch(() => {});
            throw e;
          }
        } catch (e) {
          next(e);
        } finally {
          release();
        }
      });
    },
  );
  api.put('/admin/media/:id', owner, async (req, res) => {
    const input = z.object({ title, published: z.boolean() }).strict().parse(req.body);
    const row = (
      await db.query('UPDATE media_items SET title=$2,published=$3 WHERE id=$1 RETURNING *', [
        uuid.parse(req.params.id),
        input.title,
        input.published,
      ])
    ).rows[0];
    if (!row) throw problem(404, 'Media not found.');
    res.json(descriptor(row));
  });
  api.delete('/admin/media/:id', owner, async (req, res) => {
    const c = await db.connect();
    try {
      await c.query('BEGIN');
      const row = (
        await c.query('SELECT * FROM media_items WHERE id=$1 FOR UPDATE', [
          uuid.parse(req.params.id),
        ])
      ).rows[0];
      if (!row) throw problem(404, 'Media not found.');
      if (row.object_key)
        await s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: row.object_key }));
      await c.query('DELETE FROM media_items WHERE id=$1', [row.id]);
      await c.query('COMMIT');
      res.sendStatus(204);
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  });
  api.get('/media/:id/content', async (req, res) => {
    const row = (
      await db.query('SELECT * FROM media_items WHERE id=$1', [uuid.parse(req.params.id)])
    ).rows[0];
    if (!row || (!row.published && !(await session(req)))) throw problem(404, 'Media not found.');
    if (row.source_url) {
      res.redirect(302, row.source_url);
      return;
    }
    const bytes = Number(row.bytes),
      range = req.headers.range;
    let start = 0,
      end = bytes - 1;
    if (range) {
      const parsed = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!parsed || (!parsed[1] && !parsed[2])) {
        res.set('Content-Range', `bytes */${bytes}`).sendStatus(416);
        return;
      }
      if (!parsed[1]) start = Math.max(0, bytes - Number(parsed[2]));
      else {
        start = Number(parsed[1]);
        if (parsed[2]) end = Math.min(end, Number(parsed[2]));
      }
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start < 0 ||
        start > end ||
        start >= bytes
      ) {
        res.set('Content-Range', `bytes */${bytes}`).sendStatus(416);
        return;
      }
    }
    const object = await s3.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: row.object_key,
        ...(range ? { Range: `bytes=${start}-${end}` } : {}),
      }),
    );
    res.set({
      'Content-Type': row.mime,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cache-Control': row.published ? 'public, max-age=0, must-revalidate' : 'private, no-store',
    });
    if (range) res.status(206).set('Content-Range', `bytes ${start}-${end}/${bytes}`);
    const stream = object.Body;
    res.once('close', () => stream.destroy());
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  });
}
