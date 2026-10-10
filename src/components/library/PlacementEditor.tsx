import { lazy, Suspense } from 'react';
import type { LibraryBook, LibraryData, LibraryRepository } from '../../lib/library/types';
const Scene = lazy(() => import('./LibraryScene'));
export default function PlacementEditor({
  item,
  data,
  repository,
  onChange,
}: {
  item: LibraryBook;
  data: LibraryData;
  repository: LibraryRepository;
  onChange: (item: LibraryBook) => void;
}) {
  const peers = data.books
    .filter((b) => b.shelfId === item.shelfId && b.id !== item.id)
    .sort((a, b) => a.position - b.position);
  const before =
    item.placement?.beforeId ??
    (item.id ? peers.find((b) => b.position > item.position)?.id : null) ??
    null;
  const position = before ? peers.findIndex((b) => b.id === before) : peers.length;
  const books = [...peers];
  books.splice(position, 0, {
    ...item,
    id: item.id || 'placement-preview',
    title: item.title || 'New object',
  });
  const select = (shelfId: string, beforeId: string | null) =>
    onChange({
      ...item,
      shelfId,
      placement: {
        beforeId,
        expectedIds: data.books
          .filter((b) => b.shelfId === shelfId && b.id !== item.id)
          .sort((a, b) => a.position - b.position)
          .map((b) => b.id),
      },
    });
  return (
    <section className="placement-editor">
      <h3>Choose its place before saving</h3>
      <label>
        Shelf
        <select
          aria-label="Shelf"
          value={item.shelfId}
          onChange={(e) => select(e.target.value, null)}
        >
          {data.shelves.map((s) => (
            <option value={s.id} key={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Insertion position
        <select
          aria-label="Insertion position"
          value={before || ''}
          onChange={(e) => select(item.shelfId, e.target.value || null)}
        >
          {peers.map((b) => (
            <option key={b.id} value={b.id}>
              Before {b.title}
            </option>
          ))}
          <option value="">End of shelf</option>
        </select>
      </label>
      <div className="placement-preview">
        <Suspense fallback={<p>Preparing placement…</p>}>
          <Scene
            books={books}
            shelves={data.shelves.filter((s) => s.id === item.shelfId)}
            selected=""
            onSelect={() => {}}
            repository={repository}
            reduced
            zoom={1}
          />
        </Suspense>
      </div>
      <small>Preview uses object dimensions. Overflow continues onto another row.</small>
    </section>
  );
}
