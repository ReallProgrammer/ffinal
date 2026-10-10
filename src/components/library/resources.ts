import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useEffect, useState } from 'react';
import { artworkAsset } from '../../lib/library/types';
import type { LibraryBook, LibraryRepository, Surface } from '../../lib/library/types';
import { objectType, surfaceRatio } from '../../lib/library/registry';
export interface Resources {
  maps: Partial<Record<Surface, THREE.Texture>>;
  model?: THREE.Group;
}
interface Entry {
  detail?: boolean;
  refs: number;
  touched: number;
  promise: Promise<Resources>;
  value?: Resources;
  error?: string;
}
const sourceCaches = new WeakMap<LibraryRepository, Map<string, Promise<Blob>>>();
function sourceBlob(
  repository: LibraryRepository,
  id: string,
  quality: 'overview' | 'detail' = 'overview',
) {
  let cache = sourceCaches.get(repository);
  if (!cache) {
    cache = new Map();
    sourceCaches.set(repository, cache);
  }
  const key = id + ':' + quality;
  let pending = cache.get(key);
  if (!pending) {
    pending = repository.texture(id, undefined, quality);
    cache.set(key, pending);
    pending.catch(() => cache!.delete(key));
  } else {
    cache.delete(key);
    cache.set(key, pending);
  }
  while (cache.size > 24) cache.delete(cache.keys().next().value!);
  return pending;
}
const caches = new WeakMap<LibraryRepository, Map<string, Entry>>();
function dispose(r: Resources) {
  Object.values(r.maps).forEach((t) => t.dispose());
  const images = new Set<ImageBitmap>();
  r.model?.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        for (const v of Object.values(m))
          if (v instanceof THREE.Texture) {
            if (v.image instanceof ImageBitmap) images.add(v.image);
            v.dispose();
          }
        m.dispose();
      }
    }
  });
  images.forEach((image) => image.close());
}
function optimizeModelTextures(model: THREE.Group, detail: boolean) {
  const textures = new Set<THREE.Texture>();
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      for (const value of Object.values(material))
        if (value instanceof THREE.Texture && value.image) textures.add(value);
  });
  const images = new Map<
    CanvasImageSource & { width: number; height: number },
    HTMLCanvasElement
  >();
  type Source = CanvasImageSource & { width: number; height: number };
  const sources = [...new Set([...textures].map((texture) => texture.image as Source))];
  const pixels = sources.reduce((total, image) => total + image.width * image.height, 0);
  const budget = detail
    ? innerWidth < 700
      ? 6_000_000
      : 12_000_000
    : innerWidth < 700
      ? 2_000_000
      : 4_000_000;
  const edge = detail ? 2048 : 1024;
  for (const source of sources) {
    const scale = Math.min(
      1,
      edge / source.width,
      edge / source.height,
      Math.sqrt(budget / pixels),
    );
    if (scale >= 1) continue;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(source.width * scale));
    canvas.height = Math.max(1, Math.floor(source.height * scale));
    canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
    images.set(source, canvas);
  }
  for (const texture of textures)
    if (images.has(texture.image as Source)) {
      texture.image = images.get(texture.image as Source)!;
      texture.needsUpdate = true;
    }
  for (const source of images.keys()) if (source instanceof ImageBitmap) source.close();
}
function trim(cache: Map<string, Entry>) {
  const unused = [...cache.entries()]
    .filter(([, e]) => !e.refs)
    .sort((a, b) => a[1].touched - b[1].touched);
  let models = unused.filter(([, entry]) => entry.value?.model || entry.detail).length;
  for (const [k, e] of unused) {
    if (
      cache.size <= 12 &&
      Date.now() - e.touched < 60000 &&
      (!(e.value?.model || e.detail) || models <= 2)
    )
      continue;
    if (e.value?.model || e.detail) models--;
    if (e.value) dispose(e.value);
    cache.delete(k);
  }
}
export function clearCollectionCache(repository: LibraryRepository) {
  sourceCaches.delete(repository);
  const cache = caches.get(repository);
  if (!cache) return;
  for (const [k, e] of cache) {
    if (!e.refs || e.error) {
      if (e.value) dispose(e.value);
      cache.delete(k);
    }
  }
}
function key(item: LibraryBook) {
  return JSON.stringify([
    item.front?.id,
    item.spine?.id,
    item.back?.id,
    item.model?.id,
    item.artwork,
    item.layers,
    item.presentation?.frameWidth,
    item.presentation?.frame,
    item.presentation?.casePreset,
    item.width,
    item.height,
    item.thickness,
    item.color,
    item.objectType,
    item.presentation?.textOverlay ? item.title : '',
  ]);
}
async function load(
  item: LibraryBook,
  repository: LibraryRepository,
  detail: boolean,
): Promise<Resources> {
  const result: Resources = { maps: {} };
  try {
    for (const face of (objectType(item).geometry === 'model'
      ? []
      : [
          ...objectType(item).surfaces,
          ...objectType(item).contents.filter((role) => role !== 'manual'),
        ]) as Surface[]) {
      if (
        !artworkAsset(item, face) &&
        !item.layers?.[face]?.length &&
        !item.presentation?.textOverlay
      )
        continue;
      const ratio = surfaceRatio(item, face);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(
        16,
        Math.round(
          Math.min(
            detail ? (innerWidth < 700 ? 2048 : 3072) : 1024,
            (detail ? (innerWidth < 700 ? 2048 : 3072) : 1024) * ratio,
          ),
        ),
      );
      canvas.height = Math.max(16, Math.round(canvas.width / ratio));
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = item.color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const asset = artworkAsset(item, face);
      if (asset) {
        const blob = await sourceBlob(repository, asset.id, detail ? 'detail' : 'overview');
        const bitmap = await createImageBitmap(blob);
        try {
          const scale = Math.max(canvas.width / bitmap.width, canvas.height / bitmap.height);
          ctx.drawImage(
            bitmap,
            (canvas.width - bitmap.width * scale) / 2,
            (canvas.height - bitmap.height * scale) / 2,
            bitmap.width * scale,
            bitmap.height * scale,
          );
        } finally {
          bitmap.close();
        }
      } else {
        ctx.strokeStyle = '#ffffff16';
        for (let y = 0; y < canvas.height; y += 5) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }
      }
      for (const layer of item.layers?.[face] || []) {
        ctx.save();
        ctx.translate(layer.x * canvas.width, layer.y * canvas.height);
        ctx.rotate((layer.rotation * Math.PI) / 180);
        const w = layer.width * canvas.width,
          h = layer.height * canvas.height;
        if (layer.type === 'image' && layer.assetId) {
          const bitmap = await createImageBitmap(
            await sourceBlob(repository, layer.assetId, detail ? 'detail' : 'overview'),
          );
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(bitmap, -w / 2, -h / 2, w, h);
          bitmap.close();
        } else if (layer.type === 'text') {
          ctx.fillStyle = layer.color;
          ctx.font = `${h * 0.72}px ${layer.font}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(layer.text || '', 0, 0, w);
        }
        ctx.restore();
      }
      if (item.presentation?.textOverlay) {
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 6;
        ctx.textAlign = 'center';
        ctx.font = `${Math.max(12, canvas.width / 12)}px Georgia`;
        ctx.fillText(item.title, canvas.width / 2, canvas.height * 0.8, canvas.width * 0.85);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 16;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      result.maps[face] = texture;
    }
    if (item.model) {
      const bytes = await (await sourceBlob(repository, item.model.id)).arrayBuffer();
      const manager = new THREE.LoadingManager();
      manager.setURLModifier((url) => {
        if (!url.startsWith('data:') && !url.startsWith('blob:'))
          throw new Error('External model resources are not permitted.');
        return url;
      });
      const loader = new GLTFLoader(manager);
      const gltf = await loader.parseAsync(
        item.model.mime === 'model/gltf+json' ? new TextDecoder().decode(bytes) : bytes,
        '',
      );
      result.model = gltf.scene;
      optimizeModelTextures(result.model, detail);
      result.model.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
    }
    return result;
  } catch (e) {
    dispose(result);
    throw e;
  }
}
export function useResources(
  item: LibraryBook,
  repository: LibraryRepository,
  detail = false,
): { value?: Resources; error?: string } {
  const baseKey = key(item);
  const resourceKey = baseKey + (detail ? 'detail' : 'overview');
  const [state, setState] = useState<{
    key: string;
    base?: string;
    value?: Resources;
    error?: string;
  }>({
    key: '',
  });
  useEffect(() => {
    let active = true;
    let cache = caches.get(repository);
    if (!cache) {
      cache = new Map();
      caches.set(repository, cache);
    }
    let entry = cache.get(resourceKey);
    if (!entry) {
      entry = { detail, refs: 0, touched: Date.now(), promise: Promise.resolve({ maps: {} }) };
      cache.set(resourceKey, entry);
      const e = entry;
      e.promise = load(item, repository, detail)
        .then((r) => {
          if (cache!.get(resourceKey) !== e) {
            dispose(r);
            throw new Error('Resource released');
          }
          e.value = r;
          return r;
        })
        .catch((error) => {
          e.error = error instanceof Error ? error.message : 'Asset failed to load';
          throw error;
        });
    }
    entry.refs++;
    const current = entry;
    const overview = detail ? cache.get(baseKey + 'overview') : undefined;
    if (overview) {
      overview.refs++;
      overview.promise
        .then((value) => {
          if (active && !current.error)
            setState((previous) =>
              previous.key === resourceKey && previous.value
                ? previous
                : { key: resourceKey, base: baseKey, value },
            );
        })
        .catch(() => {});
    }
    setState((previous) => ({
      key: resourceKey,
      base: baseKey,
      value: entry.value || (previous.base === baseKey ? previous.value : undefined),
      error: entry.error,
    }));
    entry.promise
      .then((value) => {
        if (active) setState({ key: resourceKey, base: baseKey, value });
      })
      .catch(() => {
        if (active)
          setState({ key: resourceKey, error: current.error || 'Artwork failed to load' });
      });
    trim(cache);
    return () => {
      active = false;
      current.refs--;
      if (overview) {
        overview.refs--;
        overview.touched = Date.now();
      }
      current.touched = Date.now();
      const target = cache;
      setTimeout(() => trim(target!), 61000);
    };
  }, [resourceKey, repository]);
  return state.key === resourceKey ? state : state.base === baseKey ? { value: state.value } : {};
}
