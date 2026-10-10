import validator from 'gltf-validator';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
export async function validateModel(buffer) {
  if (buffer.length > 25 * 1024 * 1024) throw new Error('Models must be 25 MB or smaller.');
  let json,
    bin,
    binary = buffer.subarray(0, 4).toString() === 'glTF';
  try {
    if (binary) {
      if (
        buffer.readUInt32LE(4) !== 2 ||
        buffer.readUInt32LE(8) !== buffer.length ||
        buffer.readUInt32LE(16) !== 0x4e4f534a
      )
        throw new Error();
      const len = buffer.readUInt32LE(12);
      json = JSON.parse(buffer.subarray(20, 20 + len).toString());
      if (buffer.length > 20 + len) {
        if (buffer.readUInt32LE(24 + len) !== 0x004e4942) throw new Error();
        bin = buffer.subarray(28 + len);
      }
    } else json = JSON.parse(buffer.toString());
  } catch {
    throw new Error('Malformed GLB / GLTF file.');
  }
  if (json.asset?.version !== '2.0') throw new Error('Use glTF 2.0.');
  if (
    (json.nodes?.length || 0) > 100 ||
    (json.meshes?.length || 0) > 80 ||
    (json.materials?.length || 0) > 64 ||
    (json.images?.length || 0) > 16 ||
    (json.animations?.length || 0) > 0 ||
    (json.skins?.length || 0) > 0
  )
    throw new Error(
      'Use a static model with at most 100 nodes, 80 meshes, 64 materials and 16 textures.',
    );
  if (
    (json.extensionsUsed || []).some(
      (e) =>
        ![
          'KHR_materials_unlit',
          'KHR_texture_transform',
          'KHR_materials_specular',
          'KHR_materials_volume',
          'KHR_materials_ior',
        ].includes(e),
    )
  )
    throw new Error('Unsupported model extension. Export a standard uncompressed static glTF.');
  const decode = (uri) => {
    if (
      !/^data:(application\/octet-stream|application\/gltf-buffer|image\/(png|jpeg|webp));base64,[A-Za-z0-9+/=]+$/.test(
        uri,
      )
    )
      throw new Error('Models must embed every buffer and image. External files are not allowed.');
    return Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64');
  };
  const buffers = (json.buffers || []).map((b) => (b.uri ? decode(b.uri) : bin));
  if (buffers.some((b) => !b) || buffers.reduce((n, b) => n + b.length, 0) > 40 * 1024 * 1024)
    throw new Error('Model buffer limit exceeded.');
  let pixels = 0;
  for (const img of json.images || []) {
    const view = json.bufferViews?.[img.bufferView];
    const data = img.uri
      ? decode(img.uri)
      : view
        ? buffers[view.buffer]?.subarray(
            view.byteOffset || 0,
            (view.byteOffset || 0) + view.byteLength,
          )
        : null;
    if (!data) throw new Error('Missing model texture.');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes((await fileTypeFromBuffer(data))?.mime))
      throw new Error('Unsupported model texture.');
    const m = await sharp(data, { limitInputPixels: 16_777_216 }).metadata();
    if (
      !['jpeg', 'png', 'webp'].includes(m.format) ||
      m.width > 4096 ||
      m.height > 4096 ||
      (pixels += m.width * m.height) > 24_000_000
    )
      throw new Error('Model texture resolution exceeds limits.');
  }
  let vertices = 0,
    triangles = 0;
  for (const node of json.nodes || []) {
    if (node.mesh === undefined) continue;
    for (const p of json.meshes?.[node.mesh]?.primitives || []) {
      if (p.mode !== undefined && p.mode !== 4) throw new Error('Use triangle meshes.');
      const count = json.accessors?.[p.attributes?.POSITION]?.count || 0;
      vertices += count;
      triangles += (p.indices === undefined ? count : json.accessors?.[p.indices]?.count || 0) / 3;
    }
  }
  if (!vertices || vertices > 250000 || triangles > 250000)
    throw new Error(
      'Models require 1–250,000 vertices and at most 250,000 triangles including instances.',
    );
  const result = binary
    ? await validator.validateBytes(new Uint8Array(buffer), { maxIssues: 20 })
    : await validator.validateString(buffer.toString(), { maxIssues: 20 });
  if (result.issues.numErrors)
    throw new Error('The model fails glTF validation. Re-export it with embedded resources.');
  return {
    mime: binary ? 'model/gltf-binary' : 'model/gltf+json',
    details: { vertices, triangles, images: json.images?.length || 0 },
  };
}
