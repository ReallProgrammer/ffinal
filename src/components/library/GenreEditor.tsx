import { useEffect, useRef, useState } from 'react';
import type { Genre, LibraryBook, LibraryRepository } from '../../lib/library/types';
export default function GenreEditor({
  item,
  initialGenres,
  repository,
  onChange,
}: {
  item?: LibraryBook;
  initialGenres: Genre[];
  repository: LibraryRepository;
  onChange?: (item: LibraryBook) => void;
}) {
  const [genres, setGenres] = useState(initialGenres),
    [selected, setSelected] = useState<string[]>([]),
    [name, setName] = useState(''),
    [editing, setEditing] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const current = useRef(item);
  current.current = item;
  useEffect(() => {
    setGenres(initialGenres);
    setSelected((ids) => ids.filter((id) => initialGenres.some((genre) => genre.id === id)));
  }, [initialGenres]);
  async function remove(selection: { ids: string[] } | { all: true }) {
    setBusy(true);
    setError('');
    try {
      const removed = genres.filter(
        (genre) => 'all' in selection || selection.ids.includes(genre.id),
      );
      const result = await repository.removeGenres(selection);
      setGenres((list) => list.filter((genre) => !result.deleted.includes(genre.id)));
      setSelected((ids) => ids.filter((id) => !result.deleted.includes(id)));
      if (result.deleted.includes(editing)) {
        setEditing('');
        setName('');
      }
      const draft = current.current;
      if (draft && onChange)
        onChange({
          ...draft,
          genre:
            'all' in selection ||
            removed.some(
              (genre) => genre.name.trim().toLowerCase() === draft.genre?.trim().toLowerCase(),
            )
              ? ''
              : draft.genre,
          genreIds: (draft.genreIds || []).filter((id) => !result.deleted.includes(id)),
        });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="genre-editor">
      <h3>Genres & subjects</h3>
      <p>
        {item ? 'Choose any subjects for this object. ' : ''}Deleting a genre immediately removes
        its associations; collection objects remain.
      </p>
      <div className="collection-bulk-tools">
        <label>
          <input
            type="checkbox"
            aria-label="Select all genres for deletion"
            checked={!!genres.length && selected.length === genres.length}
            disabled={busy}
            onChange={(e) => setSelected(e.target.checked ? genres.map((genre) => genre.id) : [])}
          />
          Select all for deletion
        </label>
        <button
          type="button"
          disabled={busy || !selected.length}
          onClick={() => void remove({ ids: selected })}
        >
          Delete selected genres
        </button>
        <button
          type="button"
          disabled={busy || !genres.length}
          onClick={() => void remove({ all: true })}
        >
          Delete all genres
        </button>
      </div>
      <div className="genre-options">
        {genres.map((genre) => (
          <div className="genre-option" key={genre.id}>
            <input
              type="checkbox"
              aria-label={`Select genre ${genre.name} for deletion`}
              checked={selected.includes(genre.id)}
              disabled={busy}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, genre.id]
                    : selected.filter((id) => id !== genre.id),
                )
              }
            />
            {item ? (
              <label>
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={item.genreIds?.includes(genre.id) || false}
                  onChange={(e) =>
                    onChange?.({
                      ...item,
                      genreIds: e.target.checked
                        ? [...(item.genreIds || []), genre.id]
                        : (item.genreIds || []).filter((id) => id !== genre.id),
                    })
                  }
                />
                {genre.name}
              </label>
            ) : (
              <span>{genre.name}</span>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setEditing(genre.id);
                setName(genre.name);
              }}
            >
              Rename
            </button>
            <button type="button" disabled={busy} onClick={() => void remove({ ids: [genre.id] })}>
              Delete genre
            </button>
          </div>
        ))}
      </div>
      <label>
        {editing ? 'Rename genre' : 'New genre'}
        <input
          aria-label="Genre name"
          maxLength={80}
          value={name}
          disabled={busy}
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
            const previous = genres.find((genre) => genre.id === editing);
            const genre = await repository.saveGenre(name.trim(), editing || undefined);
            const draft = current.current;
            if (
              previous &&
              draft &&
              onChange &&
              draft.genre?.trim().toLowerCase() === previous.name.trim().toLowerCase()
            ) {
              onChange({ ...draft, genre: genre.name });
            }
            setGenres((list) =>
              editing ? list.map((old) => (old.id === editing ? genre : old)) : [...list, genre],
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
          disabled={busy}
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
