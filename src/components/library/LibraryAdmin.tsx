import { useState } from 'react';
import type { LibraryBook, LibraryData, LibraryRepository } from '../../lib/library/types';
import { objectTypes, objectType } from '../../lib/library/registry';
import CollectionEditor, { defaultPresentation } from './CollectionEditor';
export const newBook = (shelfId: string, typeId = 'book'): LibraryBook => {
  const type = objectTypes.find((t) => t.id === typeId)!;
  const [width, height, thickness] = type.dimensions;
  return {
    id: '',
    title: '',
    author: '',
    description: '',
    genre: '',
    year: null,
    isbn: '',
    color: typeId === 'certificate' ? '#b99a57' : '#385548',
    width,
    height,
    thickness,
    shelfId,
    position: 0,
    published: false,
    digitalAccess: 'private',
    front: null,
    back: null,
    spine: null,
    digital: null,
    model: null,
    canRead: false,
    objectType: typeId,
    details: {},
    presentation: { ...defaultPresentation },
  };
};
export default function LibraryAdmin({
  data,
  repository,
  reduced,
  reload,
  onBack,
}: {
  data: LibraryData;
  repository: LibraryRepository;
  reduced: boolean;
  reload: () => Promise<void>;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState<LibraryBook | null>(null),
    [choosing, setChoosing] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [name, setName] = useState(''),
    [editing, setEditing] = useState(''),
    [orphans, setOrphans] = useState<{ id: string; filename: string; bytes: number }[] | null>(
      null,
    );
  async function work(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await action();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function move(kind: 'books' | 'shelves', id: string, direction: number) {
    const ids = data[kind].map((i) => i.id),
      from = ids.indexOf(id);
    let to = from + direction;
    if (kind === 'books') {
      const shelf = data.books.find((b) => b.id === id)?.shelfId;
      while (
        to >= 0 &&
        to < ids.length &&
        data.books.find((b) => b.id === ids[to])?.shelfId !== shelf
      )
        to += direction;
    }
    if (to < 0 || to >= ids.length) return;
    [ids[to], ids[from]] = [ids[from], ids[to]];
    await work(() => repository.reorder(kind, ids));
  }
  return (
    <section className="library-admin" aria-label="Owner library management">
      {error && (
        <p role="alert" className="library-error">
          {error}
        </p>
      )}
      {draft ? (
        <CollectionEditor
          key={draft.id || draft.objectType}
          initial={draft}
          data={data}
          repository={repository}
          reduced={reduced}
          onSaved={async () => {
            await reload();
            setDraft(null);
          }}
          onCancel={() => setDraft(null)}
        />
      ) : choosing ? (
        <>
          <header>
            <div>
              <small>ADD TO COLLECTION</small>
              <h2>Choose a physical format.</h2>
            </div>
            <button onClick={() => setChoosing(false)}>Cancel</button>
          </header>
          <div className="collection-type-grid">
            {objectTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => {
                  setDraft(newBook(data.shelves[0].id, type.id));
                  setChoosing(false);
                }}
              >
                <span className={`type-silhouette type-${type.geometry}`} />
                <strong>{type.label}</strong>
                <small>
                  {type.surfaces.join(' · ')}
                  {type.document ? ' · document' : ''}
                </small>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <header>
            <div>
              <small>PRIVATE / COLLECTION DESK</small>
              <h2>Objects with a story.</h2>
            </div>
            <button className="xp-button" onClick={onBack}>
              Public collection
            </button>
          </header>
          <div className="library-management-tools">
            <button
              className="library-read-button"
              disabled={busy || !data.shelves.length}
              onClick={() => setChoosing(true)}
            >
              ＋ Add to Collection
            </button>
            <button
              className="xp-button"
              onClick={() => void work(async () => setOrphans(await repository.orphanAssets()))}
            >
              Unused uploads
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void work(async () => {
                await repository.saveShelf(name, editing || undefined);
                setName('');
                setEditing('');
              });
            }}
          >
            <label>
              Shelf name
              <input
                aria-label="Shelf name"
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button disabled={busy}>{editing ? 'Rename shelf' : 'Add shelf'}</button>
          </form>
          <div className="library-admin-shelves">
            {data.shelves.map((s, i) => (
              <div key={s.id}>
                <strong>{s.name}</strong>
                <button
                  aria-label={`Move shelf ${s.name} up`}
                  disabled={busy || !i}
                  onClick={() => void move('shelves', s.id, -1)}
                >
                  ↑
                </button>
                <button
                  aria-label={`Move shelf ${s.name} down`}
                  disabled={busy || i === data.shelves.length - 1}
                  onClick={() => void move('shelves', s.id, 1)}
                >
                  ↓
                </button>
                <button
                  onClick={() => {
                    setEditing(s.id);
                    setName(s.name);
                  }}
                >
                  Rename
                </button>
                <button
                  disabled={busy || data.books.some((b) => b.shelfId === s.id)}
                  onClick={() => {
                    if (confirm(`Delete empty shelf “${s.name}”?`))
                      void work(() => repository.removeShelf(s.id));
                  }}
                >
                  Delete shelf
                </button>
              </div>
            ))}
          </div>
          {!data.shelves.length && <p>Create your first shelf to begin adding objects.</p>}
          <div className="library-admin-books">
            {data.books.map((b, i) => (
              <article key={b.id}>
                <div>
                  <small>
                    {objectType(b).label} · {b.published ? 'Published' : 'Private draft'}
                  </small>
                  <h3>{b.title}</h3>
                  <span>{data.shelves.find((s) => s.id === b.shelfId)?.name}</span>
                </div>
                <div>
                  <button
                    aria-label={`Move ${b.title} earlier`}
                    disabled={busy || !data.books.slice(0, i).some((v) => v.shelfId === b.shelfId)}
                    onClick={() => void move('books', b.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Move ${b.title} later`}
                    disabled={busy || !data.books.slice(i + 1).some((v) => v.shelfId === b.shelfId)}
                    onClick={() => void move('books', b.id, 1)}
                  >
                    ↓
                  </button>
                  <button aria-label={`Edit ${b.title}`} onClick={() => setDraft(b)}>
                    Edit
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void work(() => repository.save({ ...b, published: !b.published }))
                    }
                  >
                    {b.published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          `Delete “${b.title}”? Original uploads remain private until cleaned up.`,
                        )
                      )
                        void work(() => repository.remove(b.id));
                    }}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
          {orphans && (
            <section className="library-orphans">
              <h3>Unused private uploads</h3>
              <p>
                Includes replaced originals and crop variants. Deleting removes their stored files
                permanently.
              </p>
              {orphans.map((a) => (
                <div key={a.id}>
                  <span>
                    {a.filename} · {Math.ceil(a.bytes / 1024)} KB
                  </span>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (confirm('Permanently delete this unused file?'))
                        void work(async () => {
                          await repository.removeAsset(a.id);
                          setOrphans(await repository.orphanAssets());
                        });
                    }}
                  >
                    Delete unused file
                  </button>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </section>
  );
}
