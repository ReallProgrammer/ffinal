import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { zipSync, strToU8 } from 'fflate';
import sharp from 'sharp';
import { importModel } from '../src/model-import.mjs';
const obj = 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n';
test('OBJ, STL, PLY and FBX normalize to bounded glTF geometry', async () => {
  const samples = [
    ['obj', Buffer.from(obj)],
    [
      'stl',
      Buffer.from(
        'solid triangle\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid triangle',
      ),
    ],
    [
      'ply',
      Buffer.from(
        'ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nelement face 1\nproperty list uchar int vertex_indices\nend_header\n0 0 0\n1 0 0\n0 1 0\n3 0 1 2\n',
      ),
    ],
    ['fbx', await readFile(new URL('./fixtures/triangle.fbx', import.meta.url))],
  ];
  for (const [format, bytes] of samples) {
    const r = await importModel(bytes, 'triangle.' + format);
    assert.equal(r.details.triangles, 1, format);
    assert.equal(r.mime, 'model/gltf+json');
    assert.ok(r.normalized.length > 100);
  }
});
test('OBJ ZIP retains MTL color and companion texture without external URLs', async () => {
  const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#558877' } })
    .png()
    .toBuffer();
  const archive = zipSync({
    'model.obj': strToU8(
      'mtllib material.mtl\nv 0 0 0\nv 1 0 0\nv 0 1 0\nvt 0 0\nvt 1 0\nvt 0 1\nusemtl cover\nf 1/1 2/2 3/3\n',
    ),
    'material.mtl': strToU8('newmtl cover\nKd 1 1 1\nmap_Kd art.png\n'),
    'art.png': png,
  });
  const result = await importModel(Buffer.from(archive), 'object.zip'),
    json = JSON.parse(result.normalized);
  assert.equal(result.details.images, 1);
  assert.ok(json.images[0].uri.startsWith('data:image/png;base64,'));
});
test('archives reject traversal, scripts, multiple models, missing and external resources', async () => {
  for (const archive of [
    { '../model.obj': strToU8(obj) },
    { 'model.obj': strToU8(obj), 'run.js': strToU8('alert(1)') },
    { 'a.obj': strToU8(obj), 'b.obj': strToU8(obj) },
    {
      'model.gltf': strToU8(
        JSON.stringify({
          asset: { version: '2.0' },
          buffers: [{ uri: '/etc/passwd', byteLength: 4 }],
        }),
      ),
    },
  ])
    await assert.rejects(importModel(Buffer.from(zipSync(archive)), 'unsafe.zip'));
  await assert.rejects(importModel(Buffer.from('broken'), 'file.fbx'));
  await assert.rejects(importModel(Buffer.from('broken'), 'file.usdz'), /USDZ/);
});
