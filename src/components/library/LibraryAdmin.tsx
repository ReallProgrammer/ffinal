import { lazy, Suspense, useState } from 'react';
import type {
  AssetKind,
  LibraryBook,
  LibraryData,
  LibraryRepository,
} from '../../lib/library/types';
const BookPreview = lazy(() => import('./LibraryScene').then((m) => ({ default: m.BookPreview })));
export const newBook = (shelfId: string): LibraryBook => ({
  id: '',
  title: '',
  author: '',
  description: '',
  genre: '',
  year: null,
  isbn: '',
  color: '#385548',
  height: 2.85,
  width: 1.85,
  thickness: 0.32,
  shelfId,
  position: 0,
  published: false,
  digitalAccess: 'private',
  front: null,
  spine: null,
  back: null,
  digital: null,
  canRead: false,
});
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
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState<{ kind: string; percent: number } | null>(null),
    [shelfName, setShelfName] = useState(''),
    [shelfEdit, setShelfEdit] = useState('');
  const [orphans, setOrphans] = useState<{ id: string; filename: string; bytes: number }[] | null>(
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
  async function upload(file: File, kind: AssetKind) {
    setBusy(true);
    setError('');
    setProgress({ kind, percent: 0 });
    try {
      if (file.size > (kind === 'digital' ? 50 : 10) * 1024 * 1024)
        throw new Error(
          kind === 'digital'
            ? 'Digital books must be 50 MB or smaller.'
            : 'Cover images must be 10 MB or smaller.',
        );
      const asset = await repository.upload(file, kind, (percent) =>
        setProgress({ kind, percent }),
      );
      setDraft((current) => (current ? { ...current, [kind]: asset } : null));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }
  async function move(kind: 'books' | 'shelves', id: string, direction: number) {
    const ids = data[kind].map((v) => v.id),
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
    [ids[from], ids[to]] = [ids[to], ids[from]];
    await work(() => repository.reorder(kind, ids));
  }
  const blankPreview = draft
    ? { ...draft, title: draft.title || 'Untitled book', author: draft.author || 'Author' }
    : null;
  return (
    <section className="library-admin" aria-label="Owner library management">
      <header>
        <div>
          <span className="library-kicker">PRIVATE / LIBRARIAN’S DESK</span>
          <h2>
            {draft
              ? draft.id
                ? 'Edit this edition.'
                : 'A new addition.'
              : 'A place for every book.'}
          </h2>
        </div>
        <button
          className="xp-button"
          disabled={busy}
          onClick={() => (draft ? setDraft(null) : onBack())}
        >
          {draft ? 'Back to management' : 'Public library'}
        </button>
      </header>
      {error && (
        <p role="alert" className="library-error">
          {error}
        </p>
      )}
      {draft && blankPreview ? (
        <div className="library-editor">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void work(async () => {
                await repository.save(draft);
                setDraft(null);
              });
            }}
          >
            <fieldset disabled={busy}>
              <legend>Edition details</legend>
              <label>
                Title
                <input
                  required
                  maxLength={180}
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </label>
              <label>
                Author
                <input
                  required
                  maxLength={120}
                  value={draft.author}
                  onChange={(e) => setDraft({ ...draft, author: e.target.value })}
                />
              </label>
              <label>
                Description
                <textarea
                  maxLength={6000}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </label>
              <div className="library-field-pair">
                <label>
                  Genre
                  <input
                    maxLength={80}
                    value={draft.genre}
                    onChange={(e) => setDraft({ ...draft, genre: e.target.value })}
                  />
                </label>
                <label>
                  Publication year
                  <input
                    type="number"
                    min={1}
                    max={2200}
                    value={draft.year || ''}
                    onChange={(e) =>
                      setDraft({ ...draft, year: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </label>
              </div>
              <label>
                ISBN / edition reference
                <input
                  maxLength={32}
                  value={draft.isbn}
                  onChange={(e) => setDraft({ ...draft, isbn: e.target.value })}
                />
              </label>
              <label>
                Shelf
                <select
                  aria-label="Shelf"
                  required
                  value={draft.shelfId}
                  onChange={(e) => setDraft({ ...draft, shelfId: e.target.value })}
                >
                  {data.shelves.map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
            <fieldset disabled={busy}>
              <legend>Artwork & reading file</legend>
              {(['front', 'spine', 'back', 'digital'] as const).map((kind) => (
                <label className="library-upload" key={kind}>
                  <span>
                    {kind === 'digital'
                      ? 'Digital book (PDF / EPUB)'
                      : `${kind[0].toUpperCase() + kind.slice(1)} cover`}
                  </span>
                  <input
                    aria-label={`Upload ${kind}`}
                    type="file"
                    accept={kind === 'digital' ? '.pdf,.epub' : 'image/png,image/jpeg,image/webp'}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void upload(f, kind);
                      e.target.value = '';
                    }}
                  />
                  <small>
                    {draft[kind]?.filename ||
                      (kind === 'front'
                        ? 'Required to publish'
                        : kind === 'digital'
                          ? 'No reading file supplied'
                          : 'Generated from title and cloth color')}
                  </small>
                  {draft[kind] && (
                    <button type="button" onClick={() => setDraft({ ...draft, [kind]: null })}>
                      Remove {kind}
                    </button>
                  )}
                </label>
              ))}
              <label>
                Reading access
                <select
                  aria-label="Reading access"
                  value={draft.digitalAccess}
                  onChange={(e) =>
                    setDraft({ ...draft, digitalAccess: e.target.value as 'private' | 'public' })
                  }
                >
                  <option value="private">Owner only — private file</option>
                  <option value="public">Visitors may read and download when published</option>
                </select>
              </label>
            </fieldset>
            <fieldset disabled={busy}>
              <legend>Binding & proportions</legend>
              <label>
                Cloth / spine color
                <input
                  type="color"
                  value={draft.color}
                  onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                />
              </label>
              {(['height', 'width', 'thickness'] as const).map((key) => (
                <label key={key}>
                  {key[0].toUpperCase() + key.slice(1)}
                  <input
                    type="number"
                    step=".01"
                    min={key === 'height' ? 1.6 : key === 'width' ? 1 : 0.12}
                    max={key === 'height' ? 3.6 : key === 'width' ? 2.6 : 0.8}
                    value={draft[key]}
                    onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
                  />
                </label>
              ))}
            </fieldset>
            {progress && (
              <div role="status">
                <progress max="100" value={progress.percent} />
                <span>
                  {progress.percent === 100
                    ? 'Validating and preparing textures…'
                    : `Uploading ${progress.kind} · ${progress.percent}%`}
                </span>
              </div>
            )}
            <label className="library-checkbox">
              <input
                type="checkbox"
                checked={draft.published}
                disabled={busy}
                onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
              />
              Published — visible to visitors
            </label>
            <div className="library-editor-actions">
              <button
                className="xp-button"
                disabled={
                  busy ||
                  !draft.title ||
                  !draft.author ||
                  !draft.shelfId ||
                  (draft.published && !draft.front)
                }
              >
                {busy ? 'Saving…' : draft.published ? 'Save & publish' : 'Save private draft'}
              </button>
              <button
                type="button"
                className="xp-button"
                disabled={busy}
                onClick={() => setDraft(null)}
              >
                Cancel
              </button>
            </div>
          </form>
          <aside>
            <Suspense fallback={<p>Preparing 3D preview…</p>}>
              <BookPreview book={blankPreview} repository={repository} reduced={reduced} />
            </Suspense>
            <h3>Made from your artwork.</h3>
            <p>
              The front, spine, and back use separate textures. Missing artwork uses a generated
              cloth design; images retain their proportions.
            </p>
            <p>Changes remain private until you save a published edition.</p>
          </aside>
        </div>
      ) : (
        <>
          <div className="library-management-tools">
            <button
              className="xp-button"
              disabled={!data.shelves.length || busy}
              onClick={() => setDraft(newBook(data.shelves[0].id))}
            >
              ＋ Add book
            </button>
            <button
              className="xp-button"
              disabled={busy}
              onClick={() => void work(async () => setOrphans(await repository.orphanAssets()))}
            >
              Unused uploads
            </button>
          </div>
          <div className="library-admin-shelves">
            <h3>Shelves</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void work(async () => {
                  await repository.saveShelf(shelfName, shelfEdit || undefined);
                  setShelfName('');
                  setShelfEdit('');
                });
              }}
            >
              <input
                aria-label="Shelf name"
                placeholder="A name for this shelf"
                required
                maxLength={100}
                value={shelfName}
                onChange={(e) => setShelfName(e.target.value)}
              />
              <button className="xp-button" disabled={busy}>
                {shelfEdit ? 'Rename shelf' : 'Add shelf'}
              </button>
            </form>
            {data.shelves.map((s, i) => (
              <div className="library-admin-row" key={s.id}>
                <b>{s.name}</b>
                <button
                  aria-label={`Move shelf ${s.name} up`}
                  disabled={!i || busy}
                  onClick={() => void move('shelves', s.id, -1)}
                >
                  ↑
                </button>
                <button
                  aria-label={`Move shelf ${s.name} down`}
                  disabled={i === data.shelves.length - 1 || busy}
                  onClick={() => void move('shelves', s.id, 1)}
                >
                  ↓
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    setShelfEdit(s.id);
                    setShelfName(s.name);
                  }}
                >
                  Rename
                </button>
                <button
                  disabled={busy || data.books.some((b) => b.shelfId === s.id)}
                  onClick={() => {
                    if (confirm(`Delete the empty shelf “${s.name}”?`))
                      void work(() => repository.removeShelf(s.id));
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
          <div className="library-admin-books">
            <h3>
              Editions <small>{data.books.length}</small>
            </h3>
            {!data.books.length && (
              <p>Create a shelf, then add your first book and its actual cover.</p>
            )}
            {data.books.map((book, i) => (
              <div className="library-admin-row" key={book.id}>
                <div>
                  <b>{book.title}</b>
                  <small>
                    {book.author} · {book.published ? 'Published' : 'Private draft'} ·{' '}
                    {data.shelves.find((s) => s.id === book.shelfId)?.name}
                  </small>
                </div>
                <button
                  disabled={busy || !data.books.slice(0, i).some((b) => b.shelfId === book.shelfId)}
                  aria-label={`Move ${book.title} earlier`}
                  onClick={() => void move('books', book.id, -1)}
                >
                  ↑
                </button>
                <button
                  disabled={
                    busy || !data.books.slice(i + 1).some((b) => b.shelfId === book.shelfId)
                  }
                  aria-label={`Move ${book.title} later`}
                  onClick={() => void move('books', book.id, 1)}
                >
                  ↓
                </button>
                <button disabled={busy} onClick={() => setDraft({ ...book })}>
                  Edit {book.title}
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void work(() => repository.save({ ...book, published: !book.published }))
                  }
                >
                  {book.published ? 'Unpublish' : 'Publish'}
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        `Delete “${book.title}”? Its uploads remain private under Unused uploads until you delete them.`,
                      )
                    )
                      void work(() => repository.remove(book.id));
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
          {orphans && (
            <section className="library-orphans">
              <h3>Unused private uploads</h3>
              <p>These files are not visible to visitors. Delete originals you no longer need.</p>
              {!orphans.length && <p>No unused uploads.</p>}
              {orphans.map((a) => (
                <div key={a.id}>
                  <span>
                    {a.filename} · {Math.ceil(a.bytes / 1024)} KB
                  </span>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (confirm(`Permanently delete “${a.filename}”?`))
                        void work(async () => {
                          await repository.removeAsset(a.id);
                          setOrphans(await repository.orphanAssets());
                        });
                    }}
                  >
                    Delete file
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
