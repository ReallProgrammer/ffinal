import type { AssetKind, BookAsset, BookInput, LibraryBook, LibraryRepository } from './types';
const base = (import.meta.env.VITE_LIBRARY_API_URL || '').replace(/\/$/, '');
let token = '';
function changed() {
  window.dispatchEvent(new Event('library-change'));
}
export function bookInput(book: LibraryBook): BookInput {
  const {
    id: _id,
    position: _position,
    updatedAt: _updated,
    createdAt: _created,
    category: _category,
    model,
    canRead: _read,
    front,
    spine,
    back,
    digital,
    ...metadata
  } = book;
  return {
    ...metadata,
    model: model?.id || null,
    front: front?.id || null,
    spine: spine?.id || null,
    back: back?.id || null,
    digital: digital?.id || null,
  };
}
async function request(path: string, options: RequestInit = {}) {
  if (!base) throw new Error('The library service has not been connected.');
  const response = await fetch(base + path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    if (response.status === 401 && token) {
      token = '';
      changed();
    }
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Library request failed (${response.status}).`);
  }
  return response;
}
async function mutation(path: string, method: string, body?: unknown) {
  const response = await request(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  changed();
  return response;
}
export const libraryApi: LibraryRepository = {
  configured: Boolean(base),
  isOwner: () => Boolean(token),
  async list(owner = false) {
    return (await request(owner ? '/admin/collection' : '/collection')).json();
  },
  async login(email, password) {
    const result = await (
      await request('/session', { method: 'POST', body: JSON.stringify({ email, password }) })
    ).json();
    token = result.token;
    changed();
  },
  async logout() {
    try {
      await request('/session', { method: 'DELETE' });
    } finally {
      token = '';
      changed();
    }
  },
  upload(file: File, kind: AssetKind, progress) {
    return new Promise<BookAsset>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', base + '/admin/uploads');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.timeout = 180000;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) progress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onerror = () => reject(new Error('Upload could not reach the library service.'));
      xhr.ontimeout = () => reject(new Error('Upload timed out. Please retry.'));
      xhr.onload = () => {
        let data;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          reject(new Error('Invalid upload response.'));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else {
          if (xhr.status === 401) {
            token = '';
            changed();
          }
          reject(new Error(data.error || 'Upload failed.'));
        }
      };
      const form = new FormData();
      form.append('kind', kind);
      form.append('file', file);
      xhr.send(form);
    });
  },
  async texture(id, signal) {
    return (await request(`/assets/${encodeURIComponent(id)}`, { signal })).blob();
  },
  async original(id) {
    return (await request(`/assets/${id}?original=1`)).blob();
  },
  async crop(id, crop) {
    return (
      await request(`/admin/assets/${id}/crop`, { method: 'POST', body: JSON.stringify(crop) })
    ).json();
  },
  async read(book) {
    return (await request(`/books/${book.id}/read`)).blob();
  },
  async save(book) {
    const response = await mutation(
      book.id ? `/admin/items/${book.id}` : '/admin/items',
      book.id ? 'PUT' : 'POST',
      bookInput(book),
    );
    return (await response.json()).id;
  },
  async remove(id) {
    await mutation(`/admin/books/${id}`, 'DELETE');
  },
  async saveShelf(name, id) {
    await mutation(id ? `/admin/shelves/${id}` : '/admin/shelves', id ? 'PUT' : 'POST', { name });
  },
  async removeShelf(id) {
    await mutation(`/admin/shelves/${id}`, 'DELETE');
  },
  async reorder(kind, ids) {
    await mutation(`/admin/${kind}/order`, 'PUT', { ids });
  },
  async orphanAssets() {
    return (await request('/admin/assets')).json();
  },
  async removeAsset(id) {
    await mutation(`/admin/assets/${id}`, 'DELETE');
  },
};
