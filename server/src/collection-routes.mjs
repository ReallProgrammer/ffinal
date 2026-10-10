import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import sharp from 'sharp';
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { placementSchema, shelfAppearanceSchema } from './collection-schema.mjs';
import { validateAsset } from './assets.mjs';
const uuid = z.string().uuid();
export async function placeItem(client, id, placement, problem) {
  await client.query('LOCK TABLE books IN EXCLUSIVE MODE');
  const records = (await client.query('SELECT id,shelf_id FROM books ORDER BY position,id')).rows;
  const current = records.find((v) => v.id === id);
  if (!current) throw problem(404, 'Item not found.');
  if (placement.expectedShelfId && current.shelf_id !== placement.expectedShelfId)
    throw problem(409, 'The item moved in another editor. Refresh its placement.');
  if (
    !(await client.query('SELECT 1 FROM shelves WHERE id=$1 FOR KEY SHARE', [placement.shelfId]))
      .rowCount
  )
    throw problem(409, 'Destination shelf no longer exists.');
  const destination = records
    .filter((v) => v.id !== id && v.shelf_id === placement.shelfId)
    .map((v) => v.id);
  if (
    placement.expectedIds &&
    JSON.stringify(destination) !== JSON.stringify(placement.expectedIds)
  )
    throw problem(409, 'The destination shelf changed. Refresh and choose the position again.');
  if (placement.beforeId && !destination.includes(placement.beforeId))
    throw problem(409, 'The chosen insertion point is no longer on this shelf.');
  const ordered = records.filter((v) => v.id !== id);
  const index = placement.beforeId
    ? ordered.findIndex((v) => v.id === placement.beforeId)
    : destination.length
      ? ordered.findIndex((v) => v.id === destination.at(-1)) + 1
      : ordered.length;
  ordered.splice(index, 0, { id, shelf_id: placement.shelfId });
  await client.query('UPDATE books SET shelf_id=$2,updated_at=now() WHERE id=$1', [
    id,
    placement.shelfId,
  ]);
  for (let i = 0; i < ordered.length; i++)
    await client.query('UPDATE books SET position=$2 WHERE id=$1', [ordered[i].id, i]);
}
export function collectionRoutes({ api, db, s3, config, owner, problem, reorder }) {
  async function transaction(action) {
    const c = await db.connect();
    try {
      await c.query('BEGIN');
      const result = await action(c);
      await c.query('COMMIT');
      return result;
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }
  api.put('/admin/books/:id/place', owner, async (req, res) => {
    const input = placementSchema.parse(req.body);
    await transaction((c) => placeItem(c, uuid.parse(req.params.id), input, problem));
    res.sendStatus(204);
  });
  const shelf = z
    .object({
      name: z.string().trim().min(1).max(100),
      appearance: shelfAppearanceSchema.optional(),
    })
    .strict();
  api.post('/admin/shelves', owner, async (req, res) => {
    const input = shelf.parse(req.body),
      id = randomUUID();
    await transaction(async (c) => {
      await c.query('LOCK TABLE shelves IN EXCLUSIVE MODE');
      await c.query(
        'INSERT INTO shelves(id,name,position,appearance) VALUES($1,$2,(SELECT count(*) FROM shelves),$3)',
        [id, input.name, input.appearance || {}],
      );
    });
    res.status(201).json({ id });
  });
  api.put('/admin/shelves/order', owner, async (req, res) => {
    await reorder('shelves', req.body);
    res.sendStatus(204);
  });
  api.put('/admin/shelves/:id', owner, async (req, res) => {
    const input = shelf.parse(req.body);
    if (
      !(
        await db.query(
          'UPDATE shelves SET name=$2,appearance=coalesce($3,appearance) WHERE id=$1',
          [uuid.parse(req.params.id), input.name, input.appearance || null],
        )
      ).rowCount
    )
      throw problem(404, 'Shelf not found.');
    res.sendStatus(204);
  });
  api.delete('/admin/shelves/:id', owner, async (req, res) => {
    const id = uuid.parse(req.params.id),
      { moveTo } = z
        .object({ moveTo: uuid.optional() })
        .strict()
        .parse(req.body || {});
    if (moveTo === id) throw problem(400, 'Choose a different destination shelf.');
    await transaction(async (c) => {
      await c.query('LOCK TABLE books,shelves IN EXCLUSIVE MODE');
      const items = (
        await c.query('SELECT id FROM books WHERE shelf_id=$1 ORDER BY position,id', [id])
      ).rows;
      if (items.length && !moveTo)
        throw problem(409, 'Move the contents to another shelf before deleting this shelf.');
      for (const item of items)
        await placeItem(c, item.id, { shelfId: moveTo, beforeId: null }, problem);
      await c.query('DELETE FROM shelves WHERE id=$1', [id]);
    });
    res.sendStatus(204);
  });
  const genre = z.object({ name: z.string().trim().min(1).max(80) }).strict();
  api.post('/admin/genres', owner, async (req, res) => {
    const { name } = genre.parse(req.body),
      id = randomUUID();
    await db.query('INSERT INTO genres(id,name) VALUES($1,$2)', [id, name]);
    res.status(201).json({ id, name });
  });
  api.put('/admin/genres/:id', owner, async (req, res) => {
    const { name } = genre.parse(req.body);
    if (
      !(await db.query('UPDATE genres SET name=$2 WHERE id=$1', [uuid.parse(req.params.id), name]))
        .rowCount
    )
      throw problem(404, 'Genre not found.');
    res.sendStatus(204);
  });
  api.delete('/admin/genres/:id', owner, async (req, res) => {
    await db.query('DELETE FROM genres WHERE id=$1', [uuid.parse(req.params.id)]);
    res.sendStatus(204);
  });
  api.post(
    '/admin/assets/:id/split',
    owner,
    rateLimit({ windowMs: 60000, limit: 10, legacyHeaders: false }),
    async (req, res) => {
      const { panels } = z
        .object({
          panels: z
            .array(
              z
                .object({
                  role: z.enum(['back', 'spine', 'front']),
                  start: z.number().min(0).max(1),
                  end: z.number().min(0).max(1),
                })
                .strict(),
            )
            .length(3),
        })
        .strict()
        .parse(req.body);
      if (
        new Set(panels.map((p) => p.role)).size !== 3 ||
        panels[0].start !== 0 ||
        panels.at(-1).end !== 1 ||
        panels.some((p, i) => p.end - p.start < 0.005 || (i > 0 && p.start !== panels[i - 1].end))
      )
        throw problem(400, 'Confirm three contiguous panels spanning the complete image.');
      const source = (
        await db.query("SELECT * FROM assets WHERE id=$1 AND kind='wrap'", [
          uuid.parse(req.params.id),
        ])
      ).rows[0];
      if (!source) throw problem(404, 'Full-wrap source not found.');
      const original = await s3.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: source.original_key }),
      );
      const image = await sharp(Buffer.from(await original.Body.transformToByteArray()), {
        limitInputPixels: 40_000_000,
      })
        .rotate()
        .png()
        .toBuffer();
      const { width, height } = await sharp(image).metadata(),
        stored = [],
        result = {};
      try {
        await transaction(async (c) => {
          for (const panel of panels) {
            const start = Math.round(width * panel.start),
              end = Math.round(width * panel.end);
            const bytes = await sharp(image)
              .extract({ left: start, top: 0, width: Math.max(1, end - start), height })
              .png()
              .toBuffer();
            const processed = await validateAsset(bytes, panel.role),
              id = randomUUID(),
              originalKey = `originals/${id}`,
              textureKey = `textures/${id}.webp`;
            stored.push(originalKey, textureKey);
            await s3.send(
              new PutObjectCommand({
                Bucket: config.bucket,
                Key: originalKey,
                Body: bytes,
                ContentType: 'image/png',
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
            const filename = panel.role + ' — ' + source.filename;
            await c.query(
              'INSERT INTO assets(id,kind,original_key,texture_key,mime,filename,bytes,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
              [
                id,
                panel.role,
                originalKey,
                textureKey,
                'image/png',
                filename,
                bytes.length,
                { ...processed.details, wrapSource: source.id, panel },
              ],
            );
            result[panel.role] = { id, mime: 'image/png', filename, ...processed.details };
          }
        });
        res.status(201).json(result);
      } catch (e) {
        await Promise.allSettled(
          stored.map((Key) => s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key }))),
        );
        throw e;
      }
    },
  );
}
