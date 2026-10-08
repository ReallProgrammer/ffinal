/** The UI depends on this interface, not IndexedDB. A remote adapter can implement it later. */
export interface ShelfItem {
  id: string;
  name: string;
  description: string;
  category: string;
  filename: string;
  type: string;
  size: number;
  order: number;
  createdAt: string;
  blob: Blob;
}
export interface ShelfRepository {
  list(): Promise<ShelfItem[]>;
  get(id: string): Promise<ShelfItem | undefined>;
  put(item: ShelfItem): Promise<void>;
  remove(id: string): Promise<void>;
  reorder(ids: string[]): Promise<void>;
}
const DATABASE = 'personal-computer-collection';
const STORE = 'items';
let connection: Promise<IDBDatabase> | undefined;
function database() {
  return (connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      connection = undefined;
      reject(
        new Error('The collection could not be opened. Enable browser storage and try again.'),
      );
    };
  }));
}
async function transaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    let value: T;
    request.onsuccess = () => {
      value = request.result;
    };
    tx.oncomplete = () => resolve(value);
    tx.onerror = () =>
      reject(
        new Error(
          tx.error?.name === 'QuotaExceededError'
            ? 'This browser is out of storage. Download or delete some collection items.'
            : tx.error?.message || 'Unable to save the collection.',
        ),
      );
    tx.onabort = () => reject(new Error('The collection change could not be saved.'));
  });
}
export const shelfRepository: ShelfRepository = {
  async list() {
    const all = await transaction<ShelfItem[]>('readonly', (s) => s.getAll());
    return all.sort((a, b) => a.order - b.order);
  },
  get(id) {
    return transaction<ShelfItem | undefined>('readonly', (s) => s.get(id));
  },
  async put(item) {
    await transaction('readwrite', (s) => s.put(item));
    window.dispatchEvent(new Event('pc-shelf-change'));
  },
  async remove(id) {
    await transaction('readwrite', (s) => s.delete(id));
    window.dispatchEvent(new Event('pc-shelf-change'));
  },
  async reorder(ids) {
    const db = await database();
    const items = await this.list();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      for (const item of items) {
        const index = ids.indexOf(item.id);
        tx.objectStore(STORE).put({ ...item, order: index < 0 ? item.order : index });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error('Could not save the shelf order.'));
    });
    window.dispatchEvent(new Event('pc-shelf-change'));
  },
};
export function shelfFile(file: File, index: number): ShelfItem {
  if (file.size > 30 * 1024 * 1024)
    throw new Error(`${file.name} exceeds the 30 MB per-item limit.`);
  return {
    id: crypto.randomUUID(),
    name: file.name.replace(/\.[^.]+$/, ''),
    description: '',
    category: file.type.startsWith('image/')
      ? 'Photos'
      : file.type === 'application/pdf'
        ? 'Documents'
        : 'Artifacts',
    filename: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    order: index,
    createdAt: new Date().toISOString(),
    blob: file,
  };
}
export const isSafeImage = (type: string) =>
  ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/bmp'].includes(type);
export function downloadShelf(item: ShelfItem) {
  const url = URL.createObjectURL(item.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = item.filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
