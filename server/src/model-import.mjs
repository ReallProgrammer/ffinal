import { mkdtemp, writeFile, readFile, rm, mkdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import yauzl from 'yauzl';
import { fileTypeFromBuffer } from 'file-type';
import { validateModel } from './models.mjs';
const run = promisify(execFile),
  max = 25 * 1024 * 1024;
const formats = new Set(['.obj', '.stl', '.fbx', '.ply', '.gltf', '.glb']);
const files = new Set([...formats, '.mtl', '.png', '.jpg', '.jpeg', '.webp', '.bin']);
function safeName(name) {
  if (
    !name ||
    name.length > 240 ||
    name.includes('\\') ||
    name.includes('\0') ||
    name.startsWith('/') ||
    name.includes(':') ||
    name.split('/').some((p) => p === '..' || p === '.' || !p)
  )
    throw new Error('Unsafe model file path.');
  return name;
}
async function unpack(buffer, dir) {
  return new Promise((resolve, reject) =>
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zip) => {
      if (error) return reject(new Error('Invalid model ZIP.'));
      let total = 0,
        count = 0,
        ended = false;
      const names = [],
        seen = new Set();
      const fail = (e) => {
        if (ended) return;
        ended = true;
        zip.close();
        reject(e instanceof Error ? e : new Error('Invalid model ZIP.'));
      };
      zip.on('error', fail);
      zip.on('entry', async (entry) => {
        try {
          if (
            ++count > 128 ||
            (total += entry.uncompressedSize) > 64 * 1024 * 1024 ||
            entry.generalPurposeBitFlag & 1 ||
            ((entry.externalFileAttributes >>> 16) & 0xf000) === 0xa000
          )
            throw new Error('Unsafe or oversized model ZIP.');
          const name = safeName(entry.fileName.replace(/\/$/, ''));
          if (seen.has(name.toLowerCase())) throw new Error('Duplicate model archive path.');
          seen.add(name.toLowerCase());
          if (entry.fileName.endsWith('/')) {
            zip.readEntry();
            return;
          }
          if (!files.has(path.extname(name).toLowerCase()))
            throw new Error(
              'Model archives may contain only models, MTL, buffers, and PNG/JPEG/WebP textures.',
            );
          names.push(name);
          await mkdir(path.dirname(path.join(dir, name)), { recursive: true });
          zip.openReadStream(entry, (err, stream) => {
            if (err) return fail(err);
            const chunks = [];
            let size = 0;
            stream.on('data', (chunk) => {
              size += chunk.length;
              if (size > entry.uncompressedSize || size > max) {
                stream.destroy();
                fail(new Error('Expanded model file exceeds limit.'));
              } else chunks.push(chunk);
            });
            stream.on('error', fail);
            stream.on('end', async () => {
              if (ended) return;
              try {
                await writeFile(path.join(dir, name), Buffer.concat(chunks));
                zip.readEntry();
              } catch (e) {
                fail(e);
              }
            });
          });
        } catch (e) {
          fail(e);
        }
      });
      zip.on('end', () => {
        if (!ended) {
          ended = true;
          resolve(names);
        }
      });
      zip.readEntry();
    }),
  );
}
async function embed(document, dir, documentPath) {
  const base = path.dirname(documentPath);
  for (const [kind, list] of [
    ['buffer', document.buffers || []],
    ['image', document.images || []],
  ])
    for (const resource of list) {
      if (!resource.uri || resource.uri.startsWith('data:')) continue;
      const decoded = decodeURIComponent(resource.uri);
      safeName(decoded);
      const file = path.resolve(base, decoded);
      if (!file.startsWith(dir + path.sep))
        throw new Error('External model resources are not permitted.');
      const size = (await stat(file)).size;
      if (size > max) throw new Error('Model resource is too large.');
      const bytes = await readFile(file),
        detected = kind === 'image' ? await fileTypeFromBuffer(bytes) : null;
      if (kind === 'image' && !['image/png', 'image/jpeg', 'image/webp'].includes(detected?.mime))
        throw new Error('Unsupported model texture.');
      resource.uri = `data:${detected?.mime || 'application/octet-stream'};base64,${bytes.toString('base64')}`;
    }
  // Assimp 5.2 emits the retired specular/glossiness extension. Its core PBR
  // fallback preserves diffuse artwork; normalize it for maintained glTF loaders.
  for (const material of document.materials || []) {
    const legacy = material.extensions?.KHR_materials_pbrSpecularGlossiness;
    if (legacy) {
      material.pbrMetallicRoughness = {
        ...material.pbrMetallicRoughness,
        ...(legacy.diffuseFactor ? { baseColorFactor: legacy.diffuseFactor } : {}),
        ...(legacy.diffuseTexture ? { baseColorTexture: legacy.diffuseTexture } : {}),
        metallicFactor: 0,
        roughnessFactor: 1 - (legacy.glossinessFactor || 0),
      };
      delete material.extensions.KHR_materials_pbrSpecularGlossiness;
      if (!Object.keys(material.extensions).length) delete material.extensions;
    }
  }
  for (const key of ['extensionsUsed', 'extensionsRequired']) {
    if (document[key])
      document[key] = document[key].filter(
        (v) => !['FB_ngon_encoding', 'KHR_materials_pbrSpecularGlossiness'].includes(v),
      );
    if (!document[key]?.length) delete document[key];
  }
  return Buffer.from(JSON.stringify(document));
}
let queue = Promise.resolve();
export async function importModel(buffer, filename = 'model.glb') {
  if (buffer.length > max) throw new Error('Models must be 25 MB or smaller.');
  const extension = path.extname(filename).toLowerCase();
  if (extension === '.glb' || extension === '.gltf') return validateModel(buffer);
  if (extension !== '.zip' && !formats.has(extension))
    throw new Error(
      'Supported models: GLB, embedded GLTF, OBJ, STL, FBX, PLY, or a ZIP containing one model and its textures. USDZ is not supported.',
    );
  const task = queue.then(async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'collection-model-'));
    try {
      let source;
      if (extension === '.zip') {
        const names = await unpack(buffer, dir),
          models = names.filter((n) => formats.has(path.extname(n).toLowerCase()));
        if (models.length !== 1)
          throw new Error('Upload exactly one model with its companion files.');
        source = models[0];
      } else {
        source = 'source' + extension;
        await writeFile(path.join(dir, source), buffer);
      }
      const ext = path.extname(source).toLowerCase();
      let normalized;
      if (ext === '.glb') normalized = await readFile(path.join(dir, source));
      else if (ext === '.gltf')
        normalized = await embed(
          JSON.parse(await readFile(path.join(dir, source), 'utf8')),
          dir,
          path.join(dir, source),
        );
      else {
        try {
          await run(
            '/usr/bin/prlimit',
            [
              '--as=268435456',
              '--cpu=15',
              '--fsize=33554432',
              '--nofile=128',
              '--',
              '/usr/bin/python3',
              fileURLToPath(new URL('./convert-model.py', import.meta.url)),
              dir,
              source,
            ],
            {
              cwd: dir,
              env: { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8', OMP_NUM_THREADS: '1' },
              timeout: 20000,
              maxBuffer: 4096,
            },
          );
        } catch {
          throw new Error(
            'This model could not be converted within the memory/time limits. Use a static model or export GLB.',
          );
        }
        normalized = await embed(
          JSON.parse(await readFile(path.join(dir, 'normalized.gltf'), 'utf8')),
          dir,
          path.join(dir, 'normalized.gltf'),
        );
      }
      const validated = await validateModel(normalized);
      return {
        ...validated,
        normalized,
        details: {
          ...validated.details,
          sourceFormat: ext.slice(1),
          sourceMime: extension === '.zip' ? 'application/zip' : 'application/octet-stream',
        },
      };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  queue = task.catch(() => {});
  return task;
}
