import { useState } from 'react';
import type { Genre, LibraryBook, LibraryRepository } from '../../lib/library/types';
export default function GenreEditor({
  item,
  initialGenres,
  repository,
  onChange,
}: {
  item: LibraryBook;
  initialGenres: Genre[];
  repository: LibraryRepository;
  onChange: (item: LibraryBook) => void;
}) {
  const [genres, setGenres] = useState(initialGenres),
    [name, setName] = useState(''),
    [editing, setEditing] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <section className="genre-editor">
      <h3>Genres & subjects</h3>
      <div>
        {genres.map((g) => (
          <label key={g.id}>
            <input
              type="checkbox"
              checked={item.genreIds?.includes(g.id) || false}
              onChange={(e) =>
                onChange({
                  ...item,
                  genreIds: e.target.checked
                    ? [...(item.genreIds || []), g.id]
                    : (item.genreIds || []).filter((id) => id !== g.id),
                })
              }
            />
            {g.name}
            <button
              type="button"
              onClick={() => {
                setEditing(g.id);
                setName(g.name);
              }}
            >
              Rename
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (
                  !confirm(
                    `Remove genre “${g.name}” from every object? Objects remain in the collection.`,
                  )
                )
                  return;
                setBusy(true);
                try {
                  await repository.removeGenre(g.id);
                  setGenres((v) => v.filter((x) => x.id !== g.id));
                  onChange({
                    ...item,
                    genreIds: (item.genreIds || []).filter((id) => id !== g.id),
                  });
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete genre
            </button>
          </label>
        ))}
      </div>
      <label>
        {editing ? 'Rename genre' : 'New genre'}
        <input
          aria-label="Genre name"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={busy || !name.trim()}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            const g = await repository.saveGenre(name, editing || undefined);
            setGenres((list) =>
              editing ? list.map((v) => (v.id === editing ? { ...v, name } : v)) : [...list, g],
            );
            setName('');
            setEditing('');
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {editing ? 'Save genre name' : 'Add genre'}
      </button>
      {editing && (
        <button
          type="button"
          onClick={() => {
            setEditing('');
            setName('');
          }}
        >
          Cancel rename
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
