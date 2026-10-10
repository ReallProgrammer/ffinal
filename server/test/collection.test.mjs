import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { types } from '../src/collection-schema.mjs';
import { validateModel } from '../src/models.mjs';
const base = process.env.LIBRARY_TEST_API || 'http://127.0.0.1:8787/api/v1';
let token = '',
  shelf = '';
const items = [],
  assets = [];
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
async function up(kind, data, name) {
  const f = new FormData();
  f.append('kind', kind);
  f.append('file', new Blob([data]), name);
  const r = await fetch(base + '/admin/uploads', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: f,
  });
  assert.equal(r.status, 201);
  const a = await r.json();
  assets.push(a.id);
  return a;
}
export function modelFixture() {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  return Buffer.from(
    JSON.stringify({
      asset: { version: '2.0' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      buffers: [
        {
          uri:
            'data:application/octet-stream;base64,' +
            Buffer.from(positions.buffer).toString('base64'),
          byteLength: 36,
        },
      ],
      bufferViews: [{ buffer: 0, byteLength: 36 }],
      accessors: [
        {
          bufferView: 0,
          componentType: 5126,
          count: 3,
          type: 'VEC3',
          min: [0, 0, 0],
          max: [1, 1, 0],
        },
      ],
    }),
  );
}
before(async () => {
  const credentials = JSON.parse(await readFile(process.env.LIBRARY_TEST_CREDENTIALS, 'utf8'));
  const r = await call('/session', 'POST', credentials, false);
  assert.equal(r.status, 200);
  token = (await r.json()).token;
  shelf = (await (await call('/admin/shelves', 'POST', { name: 'Collection integration' })).json())
    .id;
});
after(async () => {
  for (const id of items) await call('/admin/items/' + id, 'DELETE');
  if (shelf) await call('/admin/shelves/' + shelf, 'DELETE');
  for (const id of assets) await call('/admin/assets/' + id, 'DELETE');
  if (token) await call('/session', 'DELETE');
});
test('each registered object persists with type-specific metadata and visibility', async () => {
  const front = await up(
    'front',
    await sharp({ create: { width: 400, height: 200, channels: 3, background: '#4b6170' } })
      .png()
      .toBuffer(),
    'wide.png',
  );
  const model = await up('model', modelFixture(), 'triangle.gltf');
  for (const type of types) {
    const [width, height, thickness] = type.dimensions;
    const input = {
      title: 'Test ' + type.id,
      objectType: type.id,
      details: type.fields[0] ? { [type.fields[0].key]: 'Test issuer' } : {},
      shelfId: shelf,
      width,
      height,
      thickness,
      color: '#446655',
      published: false,
      front: type.id === 'model' ? null : front.id,
      model: type.id === 'model' ? model.id : null,
    };
    const r = await call('/admin/items', 'POST', input);
    assert.equal(r.status, 201, type.id);
    const id = (await r.json()).id;
    items.push(id);
    assert.equal((await call('/items/' + id, 'GET', undefined, false)).status, 404);
    const published = await call('/admin/items/' + id, 'PUT', { ...input, published: true });
    assert.equal(published.status, 200);
    const saved = await (await call('/items/' + id, 'GET', undefined, false)).json();
    assert.equal(saved.objectType, type.id);
    assert.equal(saved.category, type.category);
    assert.equal(saved.width, width);
  }
  assert.equal((await call('/assets/' + model.id, 'GET', undefined, false)).status, 200);
});
test('cropping keeps originals private and creates immutable correctly sized textures', async () => {
  const original = await sharp({
    create: { width: 600, height: 200, channels: 3, background: '#ff0000' },
  })
    .png()
    .toBuffer();
  const a = await up('front', original, 'crop.png');
  assert.equal(
    (await call('/admin/assets/' + a.id + '/crop', 'POST', { ratio: 1 }, false)).status,
    401,
  );
  const r = await call('/admin/assets/' + a.id + '/crop', 'POST', {
    ratio: 1,
    x: 0,
    y: 0.5,
    zoom: 2,
  });
  assert.equal(r.status, 201);
  const variant = await r.json();
  assets.push(variant.id);
  assert.notEqual(variant.id, a.id);
  assert.equal(variant.lowResolution, true);
  const art = await call('/assets/' + variant.id);
  const meta = await sharp(Buffer.from(await art.arrayBuffer())).metadata();
  assert.equal(meta.width, meta.height);
  assert.deepEqual(
    Buffer.from(await (await call('/assets/' + variant.id + '?original=1')).arrayBuffer()),
    original,
  );
  assert.equal((await call('/assets/' + variant.id, 'GET', undefined, false)).status, 404);
  assert.equal(
    (await call('/admin/assets/' + a.id + '/crop', 'POST', { ratio: 1, zoom: 999 })).status,
    400,
  );
});
test('new mutation aliases reject anonymous access and mismatched metadata', async () => {
  for (const [path, method] of [
    ['/admin/items', 'POST'],
    ['/admin/items/order', 'PUT'],
    ['/admin/items/' + items[0], 'DELETE'],
  ])
    assert.equal((await call(path, method, {}, false)).status, 401);
  assert.equal(
    (
      await call('/admin/items', 'POST', {
        title: 'Bad',
        objectType: 'certificate',
        shelfId: shelf,
        width: 3,
        height: 2,
        thickness: 0.1,
        color: '#000000',
        details: { publisher: 'irrelevant' },
      })
    ).status,
    400,
  );
});
test('model validation rejects external resources, invalid data and excessive instances', async () => {
  const good = JSON.parse(modelFixture());
  good.buffers[0].uri = 'https://example.test/model.bin';
  await assert.rejects(validateModel(Buffer.from(JSON.stringify(good))), /embed/);
  await assert.rejects(validateModel(Buffer.from('invalid')), /Malformed/);
  const excessive = JSON.parse(modelFixture());
  excessive.nodes = Array.from({ length: 101 }, () => ({ mesh: 0 }));
  await assert.rejects(validateModel(Buffer.from(JSON.stringify(excessive))), /100 nodes/);
});
test('binary GLB uploads retain validated model data and reject corrupt chunk lengths', async () => {
  const json = JSON.parse(modelFixture());
  const binary = Buffer.from(json.buffers[0].uri.split(',')[1], 'base64');
  delete json.buffers[0].uri;
  const source = Buffer.from(JSON.stringify(json));
  const padded = Buffer.alloc(Math.ceil(source.length / 4) * 4, 0x20);
  source.copy(padded);
  const glb = Buffer.alloc(28 + padded.length + binary.length);
  glb.write('glTF');
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(padded.length, 12);
  glb.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(glb, 20);
  glb.writeUInt32LE(binary.length, 20 + padded.length);
  glb.writeUInt32LE(0x004e4942, 24 + padded.length);
  binary.copy(glb, 28 + padded.length);
  const uploaded = await up('model', glb, 'triangle.glb');
  assert.equal(uploaded.mime, 'model/gltf-binary');
  assert.equal(uploaded.vertices, 3);
  assert.deepEqual(Buffer.from(await (await call('/assets/' + uploaded.id)).arrayBuffer()), glb);
  glb.writeUInt32LE(binary.length + 4, 20 + padded.length);
  await assert.rejects(validateModel(glb), /validation|Malformed/);
});
