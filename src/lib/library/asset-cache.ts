import type { LibraryRepository } from './types';
const sourceCaches = new WeakMap<LibraryRepository, Map<string, Promise<Blob>>>();
export function sourceBlob(
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

export function clearAssetCache(repository: LibraryRepository) {
  sourceCaches.delete(repository);
}
