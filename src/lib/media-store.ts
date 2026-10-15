export interface LocalMedia {
  id: string;
  title: string;
  kind: 'audio' | 'video';
  blob: Blob;
  createdAt: number;
}
let connection: Promise<IDBDatabase> | undefined;
function database() {
  return (connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('pc-media-player', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('tracks', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      connection = undefined;
      reject(new Error('Browser media storage is unavailable.'));
    };
  }));
}
async function transaction<T>(
  mode: IDBTransactionMode,
  action: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', mode),
      request = action(tx.objectStore('tracks'));
    let result: T;
    request.onsuccess = () => {
      result = request.result;
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = tx.onerror = () =>
      reject(new Error('Could not save media. Browser storage may be full.'));
  });
}
export const mediaStore = {
  list: () => transaction<LocalMedia[]>('readonly', (s) => s.getAll()),
  put: (item: LocalMedia) => transaction('readwrite', (s) => s.put(item)),
  remove: (id: string) => transaction('readwrite', (s) => s.delete(id)),
};
