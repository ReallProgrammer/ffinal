import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
const base = process.env.LIBRARY_TEST_API || 'http://127.0.0.1:8787/api/v1';
let token = '';
const shelves = [],
  items = [],
  assets = [],
  genres = [];
async function call(path, method = 'GET', body, auth = true) {
  return fetch(base + path, {
    method,
    headers: {
      ...(auth ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function up(kind, data, name = 'art.png') {
  const form = new FormData();
  form.append('kind', kind);
  form.append('file', new Blob([data]), name);
  const r = await fetch(base + '/admin/uploads', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  assert.equal(r.status, 201, await r.clone().text());
  const a = await r.json();
  assets.push(a.id);
  return a;
}
async function list() {
  return (await call('/admin/collection')).json();
}
before(async () => {
  const login = await call(
    '/session',
    'POST',
    JSON.parse(await readFile(process.env.LIBRARY_TEST_CREDENTIALS, 'utf8')),
    false,
  );
  assert.equal(login.status, 200);
  token = (await login.json()).token;
  for (const name of ['Astro refinement fixture', 'Astro2 refinement fixture']) {
    const r = await call('/admin/shelves', 'POST', { name });
    assert.equal(r.status, 201);
    shelves.push((await r.json()).id);
  }
});
after(async () => {
  for (const id of items) await call('/admin/items/' + id, 'DELETE');
  for (const id of shelves) await call('/admin/shelves/' + id, 'DELETE');
  for (const id of genres) await call('/admin/genres/' + id, 'DELETE');
  for (const id of assets) await call('/admin/assets/' + id, 'DELETE');
  if (token) await call('/session', 'DELETE');
});
test('all refinement writes reject visitors and forged tokens', async () => {
  for (const [path, method, body] of [
    ['/admin/genres', 'POST', { name: 'x' }],
    ['/admin/genres/' + randomUUID(), 'PUT', { name: 'x' }],
    ['/admin/genres/' + randomUUID(), 'DELETE'],
    ['/admin/items/' + randomUUID() + '/place', 'PUT', { shelfId: shelves[0] }],
    ['/admin/assets/' + randomUUID() + '/split', 'POST', { panels: [] }],
    ['/admin/shelves/' + shelves[0], 'PUT', { name: 'x', appearance: {} }],
  ]) {
    assert.equal((await call(path, method, body, false)).status, 401, path);
  }
});
test('wrap panels, interior textures, layers and genres persist with correct public access', async () => {
  const source = await sharp({
    create: { width: 1800, height: 900, channels: 3, background: '#efefe3' },
  })
    .composite([
      {
        input: Buffer.from(
          '<svg width="1800" height="900"><rect width="800" height="900" fill="red"/><rect x="800" width="200" height="900" fill="green"/><rect x="1000" width="800" height="900" fill="blue"/></svg>',
        ),
      },
    ])
    .png()
    .toBuffer();
  const wrap = await up('wrap', source),
    disc = await up('disc', source),
    decal = await up('decal', source);
  const split = await call('/admin/assets/' + wrap.id + '/split', 'POST', {
    panels: [
      { role: 'back', start: 0, end: 4 / 9 },
      { role: 'spine', start: 4 / 9, end: 5 / 9 },
      { role: 'front', start: 5 / 9, end: 1 },
    ],
  });
  assert.equal(split.status, 201);
  const panels = await split.json();
  assets.push(...Object.values(panels).map((v) => v.id));
  assert.equal(panels.spine.width, 200);
  assert.equal(panels.front.width, 800);
  const genre = await (
    await call('/admin/genres', 'POST', { name: 'Refinement ' + randomUUID() })
  ).json();
  genres.push(genre.id);
  const input = {
    title: 'Real case',
    objectType: 'ps5',
    shelfId: shelves[0],
    width: 2.1,
    height: 2.7,
    thickness: 0.22,
    color: '#456789',
    front: panels.front.id,
    back: panels.back.id,
    spine: panels.spine.id,
    published: true,
    artwork: { wrap: wrap.id, disc: disc.id },
    genreIds: [genre.id],
    tags: ['physical'],
    presentation: { casePreset: 'ps5', includeDisc: true, openAngle: 120 },
    layers: {
      front: [
        {
          id: randomUUID(),
          type: 'image',
          assetId: decal.id,
          x: 0.5,
          y: 0.5,
          width: 0.2,
          height: 0.2,
          rotation: 15,
          locked: true,
        },
      ],
    },
    placement: { beforeId: null, expectedIds: [] },
  };
  const saved = await call('/admin/items', 'POST', input);
  assert.equal(saved.status, 201, await saved.clone().text());
  const id = (await saved.json()).id;
  items.push(id);
  const object = (await list()).books.find((b) => b.id === id);
  assert.equal(object.artwork.disc.id, disc.id);
  assert.equal(object.layers.front[0].locked, true);
  assert.equal(object.presentation.openAngle, 120);
  assert.deepEqual(object.genreIds, [genre.id]);
  assert.equal(object.layerAssets[decal.id].id, decal.id);
  const legacy = { ...input, artwork: object.artwork, layerAssets: object.layerAssets };
  assert.equal(
    (await call('/admin/items/' + id, 'PUT', legacy)).status,
    200,
    'previous clients can echo asset descriptors',
  );
  for (const asset of [disc, decal, panels.front])
    assert.equal((await call('/assets/' + asset.id, 'GET', undefined, false)).status, 200);
  assert.equal((await call('/assets/' + wrap.id, 'GET', undefined, false)).status, 404);
  assert.equal(
    (await call('/assets/' + decal.id + '?original=1', 'GET', undefined, false)).status,
    403,
  );
  const detail = await call(
    '/assets/' + panels.front.id + '?quality=detail',
    'GET',
    undefined,
    false,
  );
  assert.equal(detail.status, 200);
  const stats = await sharp(Buffer.from(await detail.arrayBuffer())).stats();
  assert.ok(stats.channels[2].mean > 240 && stats.channels[0].mean < 10);
  assert.equal((await call('/admin/assets/' + decal.id, 'DELETE')).status, 409);
  assert.equal(
    (await call('/admin/genres/' + genre.id, 'PUT', { name: 'Renamed ' + genre.id })).status,
    204,
  );
  assert.equal(
    (await call('/admin/items/' + id, 'PUT', { ...input, published: false })).status,
    200,
  );
  assert.equal((await call('/assets/' + decal.id, 'GET', undefined, false)).status, 404);
});
test('exact placement detects stale order and shelf deletion moves contents atomically', async () => {
  const create = async (title) => {
    const response = await call('/admin/items', 'POST', {
      title,
      shelfId: shelves[1],
      width: 2,
      height: 3,
      thickness: 0.2,
      color: '#456789',
    });
    assert.equal(response.status, 201);
    const id = (await response.json()).id;
    items.push(id);
    return id;
  };
  const a = await create('A'),
    b = await create('B');
  const destination = (await list()).books.filter((v) => v.shelfId === shelves[0]).map((v) => v.id);
  assert.equal(
    (
      await call('/admin/items/' + a + '/place', 'PUT', {
        shelfId: shelves[0],
        beforeId: destination[0],
        expectedIds: destination,
        expectedShelfId: shelves[1],
      })
    ).status,
    204,
  );
  assert.equal(
    (
      await call('/admin/items/' + b + '/place', 'PUT', {
        shelfId: shelves[0],
        beforeId: null,
        expectedIds: destination,
      })
    ).status,
    409,
  );
  assert.equal((await list()).books.find((v) => v.id === b).shelfId, shelves[1]);
  assert.equal((await call('/admin/shelves/' + shelves[1], 'DELETE')).status, 409);
  assert.equal(
    (await call('/admin/shelves/' + shelves[1], 'DELETE', { moveTo: shelves[0] })).status,
    204,
  );
  const data = await list();
  assert.equal(data.books.find((v) => v.id === b).shelfId, shelves[0]);
  assert.ok(!data.shelves.some((v) => v.id === shelves[1]));
  assert.equal(data.books.filter((v) => v.shelfId === shelves[0]).at(-1).id, b);
  assert.equal(
    (
      await call('/admin/shelves/' + shelves[0], 'PUT', {
        name: 'Astro preserved',
        appearance: { width: 14, depth: 3, spacing: 0.6, color: '#557744' },
      })
    ).status,
    204,
  );
  assert.equal((await list()).shelves.find((v) => v.id === shelves[0]).appearance.width, 14);
});
test('converted models keep original bytes private and expose normalized validated geometry', async () => {
  const source = Buffer.from('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n'),
    model = await up('model', source, 'source.obj');
  assert.equal(model.mime, 'model/gltf+json');
  assert.equal(model.sourceFormat, 'obj');
  const response = await call('/admin/items', 'POST', {
    title: 'Converted object',
    objectType: 'model',
    shelfId: shelves[0],
    width: 2,
    height: 2,
    thickness: 1,
    color: '#887766',
    model: model.id,
    published: true,
  });
  assert.equal(response.status, 201);
  items.push((await response.json()).id);
  const file = await call('/assets/' + model.id, 'GET', undefined, false);
  assert.equal(file.status, 200);
  assert.equal((await file.json()).asset.version, '2.0');
  assert.deepEqual(
    Buffer.from(await (await call('/assets/' + model.id + '?original=1')).arrayBuffer()),
    source,
  );
});
