import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { configuration } from '../src/config.mjs';
import { migrate } from '../src/migrations.mjs';
import { createApp } from '../src/app.mjs';
const configured = Boolean(process.env.DATABASE_URL && process.env.LIBRARY_TEST_CREDENTIALS);
let db, admin, server, s3, base, token, shelf, used;
const schema = 'cleanup_test_' + randomUUID().replaceAll('-', '');
async function call(path, method = 'GET', body, owner = true) {
  return fetch(base + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(owner && token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function upload(name) {
  const form = new FormData();
  form.append('kind', 'front');
  form.append(
    'file',
    new Blob([
      await sharp({ create: { width: 64, height: 96, channels: 3, background: '#456789' } })
        .png()
        .toBuffer(),
    ]),
    name,
  );
  const result = await fetch(base + '/admin/uploads', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: form,
  });
  assert.equal(result.status, 201);
  return result.json();
}
before(async () => {
  if (!configured) return;
  const config = configuration();
  admin = new Pool({ connectionString: config.databaseUrl, max: 1 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  db = new Pool({
    connectionString: config.databaseUrl,
    max: 4,
    options: '-c search_path=' + schema,
  });
  await migrate(db);
  s3 = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  server = createApp({ db, s3, config }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = 'http://127.0.0.1:' + server.address().port + '/api/v1';
  const login = await call(
    '/session',
    'POST',
    JSON.parse(await readFile(process.env.LIBRARY_TEST_CREDENTIALS, 'utf8')),
    false,
  );
  assert.equal(login.status, 200);
  token = (await login.json()).token;
  shelf = (await (await call('/admin/shelves', 'POST', { name: 'Isolated cleanup shelf' })).json())
    .id;
});
after(async () => {
  if (!configured) return;
  if (base && token) {
    await db.query('DELETE FROM books');
    await call('/admin/assets/delete', 'POST', { all: true });
  }
  if (server) await new Promise((resolve) => server.close(resolve));
  s3?.destroy();
  await db?.end();
  await admin?.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin?.end();
});
test('cleanup bulk APIs are owner-only and validate selection', { skip: !configured }, async () => {
  for (const path of ['/admin/assets/delete', '/admin/genres/delete']) {
    assert.equal((await call(path, 'POST', { all: true }, false)).status, 401);
    assert.equal((await call(path, 'POST', {})).status, 400);
    assert.equal((await call(path, 'POST', { ids: [randomUUID()], all: true })).status, 400);
  }
});
test(
  'single, selected and all genre deletion clears legacy strings and associations immediately',
  { skip: !configured },
  async () => {
    const genres = [];
    for (const name of ['Legacy subject', 'Other subject', 'Final subject'])
      genres.push(await (await call('/admin/genres', 'POST', { name })).json());
    const r = await call('/admin/items', 'POST', {
      title: 'Legacy edition',
      objectType: 'book',
      shelfId: shelf,
      width: 2,
      height: 3,
      thickness: 0.2,
      color: '#456789',
      genre: ' Legacy subject ',
      genreIds: genres.map((genre) => genre.id),
    });
    assert.equal(r.status, 201);
    const id = (await r.json()).id;
    assert.equal(
      (await call('/admin/genres/' + genres[0].id, 'PUT', { name: 'Renamed legacy subject' }))
        .status,
      204,
    );
    assert.equal(
      (await (await call('/admin/collection')).json()).books.find((item) => item.id === id).genre,
      'Renamed legacy subject',
    );
    assert.equal((await call('/admin/genres/' + genres[0].id, 'DELETE')).status, 204);
    let item = (await (await call('/admin/collection')).json()).books.find(
      (item) => item.id === id,
    );
    assert.equal(item.genre, '');
    assert.deepEqual(new Set(item.genreIds), new Set(genres.slice(1).map((genre) => genre.id)));
    assert.deepEqual(
      (await (await call('/admin/genres/delete', 'POST', { ids: [genres[1].id] })).json()).deleted,
      [genres[1].id],
    );
    assert.deepEqual(
      (await (await call('/admin/genres/delete', 'POST', { all: true })).json()).deleted,
      [genres[2].id],
    );
    const remaining = await (await call('/admin/collection')).json();
    assert.deepEqual(remaining.genres, []);
    assert.deepEqual(remaining.books.find((item) => item.id === id).genreIds, []);
  },
);
test(
  'bulk unused upload cleanup retains referenced files and reports conflicts without data loss',
  { skip: !configured },
  async () => {
    const original = await upload('referenced.png'),
      unused1 = await upload('unused-one.png'),
      unused2 = await upload('unused-two.png');
    used = original.id;
    const item = await call('/admin/items', 'POST', {
      title: 'Published edition',
      objectType: 'book',
      shelfId: shelf,
      width: 2,
      height: 3,
      thickness: 0.2,
      color: '#456789',
      front: used,
      published: true,
    });
    assert.equal(item.status, 201);
    const selected = await (
      await call('/admin/assets/delete', 'POST', { ids: [used, unused1.id] })
    ).json();
    assert.deepEqual(selected.deleted, [unused1.id]);
    assert.deepEqual(
      selected.failed.map((failure) => failure.id),
      [used],
    );
    assert.equal((await call('/assets/' + used, 'GET', undefined, false)).status, 200);
    const all = await (await call('/admin/assets/delete', 'POST', { all: true })).json();
    assert.deepEqual(all.deleted, [unused2.id]);
    assert.deepEqual(all.failed, []);
    assert.equal((await call('/assets/' + used, 'GET', undefined, false)).status, 200);
    assert.deepEqual(await (await call('/admin/assets')).json(), []);
  },
);
