import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
  DragOverlay,
} from '@dnd-kit/core';
import type { DragEndEvent, CollisionDetection } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type {
  LibraryBook,
  LibraryData,
  LibraryRepository,
  LibraryShelf,
  ShelfAppearance,
} from '../../lib/library/types';
import { objectType, footprint } from '../../lib/library/registry';
function Sortable({
  id,
  kind,
  children,
  label,
  disabled,
}: {
  id: string;
  kind: string;
  children: ReactNode;
  label: string;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({ id, data: { kind }, disabled });
  return (
    <div
      ref={setNodeRef}
      className={`organizer-${kind} ${isOver ? 'drop-target' : ''}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}
    >
      <button
        type="button"
        className="drag-handle"
        aria-label={`Drag ${label}`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      {children}
    </div>
  );
}
function EndDrop({ shelf }: { shelf: LibraryShelf }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'end:' + shelf.id,
    data: { kind: 'end', shelfId: shelf.id },
  });
  return (
    <div ref={setNodeRef} className={`shelf-end-drop ${isOver ? 'drop-target' : ''}`}>
      Drop at end of {shelf.name}
    </div>
  );
}
export default function CollectionOrganizer({
  data,
  repository,
  busy,
  work,
  onEdit,
}: {
  data: LibraryData;
  repository: LibraryRepository;
  busy: boolean;
  work: (action: () => Promise<unknown>) => Promise<void>;
  onEdit: (book: LibraryBook) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [active, setActive] = useState(''),
    [shelfDraft, setShelfDraft] = useState<LibraryShelf | null>(null),
    [deleting, setDeleting] = useState(''),
    [destination, setDestination] = useState('');
  const collision: CollisionDetection = (args) =>
    closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) =>
        args.active.data.current?.kind === 'shelf'
          ? c.data.current?.kind === 'shelf'
          : c.data.current?.kind !== 'shelf',
      ),
    });
  async function end(event: DragEndEvent) {
    setActive('');
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (active.data.current?.kind === 'shelf') {
      const ids = data.shelves.map((s) => s.id);
      await work(() =>
        repository.reorder(
          'shelves',
          arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))),
        ),
      );
      return;
    }
    const item = data.books.find((b) => b.id === active.id),
      target = data.books.find((b) => b.id === over.id);
    if (!item) return;
    const shelfId = target?.shelfId || over.data.current?.shelfId;
    if (!shelfId) return;
    const peers = data.books.filter((b) => b.shelfId === shelfId && b.id !== item.id),
      beforeId = target?.id || null;
    await work(() =>
      repository.place(
        item.id,
        shelfId,
        { beforeId, expectedIds: peers.map((b) => b.id) },
        item.shelfId,
      ),
    );
  }
  const defaults: ShelfAppearance = { width: 11.8, depth: 2.6, spacing: 0.5, color: '#ad855f' };
  return (
    <section className="collection-organizer">
      <h3>Arrange your collection</h3>
      <p>
        Drag a handle to move an object before another object, or to the end of any shelf. Drag
        shelf handles to rearrange shelves. Keyboard: Space to pick up, arrows to move, Space to
        place, Escape to cancel. Edit also offers an exact placement selector.
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={(e) => setActive(String(e.active.id))}
        onDragCancel={() => setActive('')}
        onDragEnd={(e) => void end(e)}
      >
        <SortableContext
          items={data.shelves.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {data.shelves.map((s) => (
            <Sortable key={s.id} id={s.id} kind="shelf" label={`shelf ${s.name}`} disabled={busy}>
              <header>
                <strong>{s.name}</strong>
                <button
                  type="button"
                  onClick={() =>
                    setShelfDraft({ ...s, appearance: { ...defaults, ...s.appearance } })
                  }
                >
                  Edit shelf
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleting(s.id);
                    setDestination(data.shelves.find((v) => v.id !== s.id)?.id || '');
                  }}
                >
                  Delete shelf
                </button>
              </header>
              <SortableContext
                items={data.books.filter((b) => b.shelfId === s.id).map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                {data.books
                  .filter((b) => b.shelfId === s.id)
                  .map((b) => (
                    <Sortable key={b.id} id={b.id} kind="object" label={b.title} disabled={busy}>
                      <i
                        className={`organizer-object-shape type-${objectType(b).geometry}`}
                        style={{
                          background: b.color,
                          width: Math.max(12, footprint(b).width * 16),
                          height: Math.max(25, b.height * 18),
                        }}
                      />
                      <div>
                        <small>
                          {objectType(b).label} · {b.published ? 'Published' : 'Private draft'}
                        </small>
                        <h4>{b.title}</h4>
                      </div>
                      <div className="organizer-actions">
                        <button
                          type="button"
                          aria-label={`Edit ${b.title}`}
                          onClick={() => onEdit(b)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void work(() => repository.save({ ...b, published: !b.published }))
                          }
                        >
                          {b.published ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (
                              confirm(
                                `Delete “${b.title}”? Uploaded originals remain private until cleaned up.`,
                              )
                            )
                              void work(() => repository.remove(b.id));
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </Sortable>
                  ))}
              </SortableContext>
              <EndDrop shelf={s} />
            </Sortable>
          ))}
        </SortableContext>
        <DragOverlay>
          {active && (
            <div className="collection-drag-overlay">
              {data.books.find((b) => b.id === active)?.title ||
                data.shelves.find((s) => s.id === active)?.name}
            </div>
          )}
        </DragOverlay>
      </DndContext>
      {shelfDraft && (
        <section className="shelf-edit-panel" role="dialog" aria-label="Shelf appearance">
          <h3>Edit shelf</h3>
          <label>
            Name
            <input
              value={shelfDraft.name}
              maxLength={100}
              onChange={(e) => setShelfDraft({ ...shelfDraft, name: e.target.value })}
            />
          </label>
          {(['width', 'depth', 'spacing'] as const).map((key) => (
            <label key={key}>
              Shelf {key}
              <input
                type="number"
                step=".1"
                min={key === 'width' ? 6 : key === 'depth' ? 1 : 0.2}
                max={key === 'width' ? 20 : key === 'depth' ? 8 : 2}
                value={shelfDraft.appearance?.[key]}
                onChange={(e) =>
                  setShelfDraft({
                    ...shelfDraft,
                    appearance: { ...shelfDraft.appearance, [key]: Number(e.target.value) },
                  })
                }
              />
            </label>
          ))}
          <label>
            Wood tint
            <input
              type="color"
              value={shelfDraft.appearance?.color}
              onChange={(e) =>
                setShelfDraft({
                  ...shelfDraft,
                  appearance: { ...shelfDraft.appearance, color: e.target.value },
                })
              }
            />
          </label>
          <button
            disabled={busy || !shelfDraft.name.trim()}
            onClick={() =>
              void work(async () => {
                await repository.saveShelf(shelfDraft.name, shelfDraft.id, shelfDraft.appearance);
                setShelfDraft(null);
              })
            }
          >
            Save shelf
          </button>
          <button disabled={busy} onClick={() => setShelfDraft(null)}>
            Cancel
          </button>
        </section>
      )}
      {deleting && (
        <section className="shelf-edit-panel" role="dialog" aria-label="Confirm shelf deletion">
          <h3>Delete {data.shelves.find((s) => s.id === deleting)?.name}?</h3>
          {data.books.some((b) => b.shelfId === deleting) ? (
            <>
              <p>
                All contents will move to the end of the selected shelf, preserving object IDs and
                files.
              </p>
              <label>
                Move contents to
                <select value={destination} onChange={(e) => setDestination(e.target.value)}>
                  {data.shelves
                    .filter((s) => s.id !== deleting)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </label>
              {!destination && <p>Create another shelf before deleting this one.</p>}
            </>
          ) : (
            <p>This shelf is empty.</p>
          )}
          <button
            disabled={busy || (!destination && data.books.some((b) => b.shelfId === deleting))}
            onClick={() =>
              void work(async () => {
                await repository.removeShelf(deleting, destination || undefined);
                setDeleting('');
              })
            }
          >
            Confirm deletion
          </button>
          <button disabled={busy} onClick={() => setDeleting('')}>
            Cancel
          </button>
        </section>
      )}
    </section>
  );
}
