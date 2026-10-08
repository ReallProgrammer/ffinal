import ContextMenu from '../ContextMenu';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  Plus,
  Pencil,
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  FolderOpen,
} from 'lucide-react';
import Icon from '../Icon';
import { useDesktop } from '../../lib/DesktopContext';
import { downloadShelf, isSafeImage, shelfFile, shelfRepository } from '../../lib/shelf/repository';
import type { ShelfItem, ShelfRepository } from '../../lib/shelf/repository';
import MenuBar from '../MenuBar';
function useBlobUrl(blob?: Blob) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!blob) {
      setUrl('');
      return;
    }
    const value = URL.createObjectURL(blob);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [blob]);
  return url;
}
function Artifact({ item }: { item: ShelfItem }) {
  const url = useBlobUrl(isSafeImage(item.type) ? item.blob : undefined);
  return url ? (
    <div className="shelf-photo">
      <img src={url} alt={item.name} />
      <span>{item.name}</span>
    </div>
  ) : (
    <div
      className={`shelf-object ${item.type === 'application/pdf' ? 'shelf-book' : 'shelf-document'}`}
    >
      <Icon name={item.type === 'application/pdf' ? 'certificate' : 'file'} size={42} />
      <b>{item.name}</b>
      <small>{item.filename.split('.').pop()?.toUpperCase()}</small>
    </div>
  );
}
function Viewer({
  item,
  close,
  wallpaper,
}: {
  item: ShelfItem;
  close: () => void;
  wallpaper: () => void;
}) {
  const url = useBlobUrl(item.blob);
  const [text, setText] = useState('');
  useEffect(() => {
    let active = true;
    if (item.type.startsWith('text/') || /\.(txt|md|csv|log|json)$/i.test(item.filename))
      void item.blob.text().then((t) => {
        if (active) setText(t.slice(0, 200000));
      });
    return () => {
      active = false;
    };
  }, [item]);
  return (
    <div className="shelf-viewer">
      <header>
        <div>
          <b>{item.name}</b>
          <small>
            {item.category} · {(item.size / 1024).toFixed(1)} KB
          </small>
        </div>
        <button aria-label="Close item viewer" onClick={close}>
          <X size={19} />
        </button>
      </header>
      <div className="shelf-view-content">
        {isSafeImage(item.type) ? (
          <img src={url} alt={item.description || item.name} />
        ) : item.type === 'application/pdf' ? (
          <object type="application/pdf" data={url} aria-label={item.name}>
            <p>Your browser cannot display this PDF here.</p>
            <button className="xp-button" onClick={() => downloadShelf(item)}>
              Download PDF
            </button>
          </object>
        ) : text ? (
          <pre>{text}</pre>
        ) : (
          <div className="shelf-file-fallback">
            <Icon name="file" size={72} />
            <h2>{item.filename}</h2>
            <p>
              This file is kept safely in your collection.
              <br />
              Download it to open it with an appropriate application.
            </p>
          </div>
        )}
      </div>
      <footer>
        <p>{item.description || 'A small piece of your story.'}</p>
        {isSafeImage(item.type) && (
          <button className="xp-button" onClick={wallpaper}>
            Set as wallpaper
          </button>
        )}
        <button className="xp-button" onClick={() => downloadShelf(item)}>
          <ArrowDownToLine size={13} /> Download
        </button>
      </footer>
    </div>
  );
}
export default function Shelf({ repository = shelfRepository }: { repository?: ShelfRepository }) {
  const { notify, setSettings } = useDesktop();
  const [items, setItems] = useState<ShelfItem[]>([]);
  const [editing, setEditing] = useState(false);
  const [filter, setFilter] = useState('All objects');
  const [selected, setSelected] = useState('');
  const [viewer, setViewer] = useState<ShelfItem | null>(null);
  const [draft, setDraft] = useState<ShelfItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [drop, setDrop] = useState(false);
  const [dragId, setDragId] = useState('');
  const [context, setContext] = useState<{ id: string; x: number; y: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    try {
      setItems(await repository.list());
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [repository]);
  useEffect(() => {
    void load();
    window.addEventListener('pc-shelf-change', load);
    window.addEventListener('pc-refresh', load);
    return () => {
      window.removeEventListener('pc-shelf-change', load);
      window.removeEventListener('pc-refresh', load);
    };
  }, [load]);
  async function upload(files: FileList | File[]) {
    if (!editing) {
      notify('Choose Arrange collection to add your own objects.');
      return;
    }
    setBusy(true);
    try {
      const all = Array.from(files);
      for (let i = 0; i < all.length; i++)
        await repository.put(shelfFile(all[i], items.length + i));
      await load();
      notify(`${all.length} object${all.length === 1 ? '' : 's'} added to your shelf.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(item: ShelfItem) {
    if (!window.confirm(`Remove “${item.name}” from this browser’s collection?`)) return;
    try {
      await repository.remove(item.id);
      if (viewer?.id === item.id) setViewer(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function reorder(id: string, target: string) {
    const ids = items.map((i) => i.id);
    const from = ids.indexOf(id),
      to = ids.indexOf(target);
    if (from < 0 || to < 0 || from === to) return;
    ids.splice(from, 1);
    ids.splice(to, 0, id);
    try {
      await repository.reorder(ids);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
    setDragId('');
  }
  const categories = ['All objects', ...new Set(items.map((i) => i.category))];
  const visible = items.filter((i) => filter === 'All objects' || i.category === filter);
  const current = items.find((i) => i.id === context?.id);
  const wallpaper = (item: ShelfItem) => {
    setSettings({ wallpaper: 'custom', customWallpaper: item.id });
    notify('Your desktop has a new view.');
  };
  return (
    <div
      className={`shelf-app app-column ${busy ? 'is-busy' : ''}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDrop(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrop(false);
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files.length) {
          e.preventDefault();
          setDrop(false);
          void upload(e.dataTransfer.files);
        }
      }}
    >
      <MenuBar
        menus={[
          {
            label: 'Collection',
            items: [
              { label: 'Arrange collection', checked: editing, action: () => setEditing(!editing) },
              { label: 'Add objects…', disabled: !editing, action: () => input.current?.click() },
              { label: 'Refresh', action: () => void load() },
            ],
          },
          {
            label: 'Help',
            items: [
              {
                label: 'About this collection',
                action: () =>
                  notify(
                    'Objects are stored in IndexedDB on this browser. Arrange collection lets you add and edit them. A shared online collection needs a connected backend; local objects are not published to other visitors.',
                  ),
              },
            ],
          },
        ]}
      />
      <header className="shelf-heading">
        <div>
          <span className="eyebrow">A FEW THINGS WORTH KEEPING</span>
          <h1>The personal shelf.</h1>
          <p>Small memories. Favorite things. A story in objects.</p>
        </div>
        <BookOpen size={36} />
      </header>
      <div className="shelf-tools">
        <select
          aria-label="Shelf category"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button
          className={`xp-button ${editing ? 'pressed' : ''}`}
          onClick={() => setEditing(!editing)}
        >
          <Pencil size={12} />
          {editing ? 'Done arranging' : 'Arrange collection'}
        </button>
        {editing && (
          <button className="xp-button" onClick={() => input.current?.click()}>
            <Plus size={13} />
            Add objects
          </button>
        )}
        <input
          type="file"
          ref={input}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void upload(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {editing && (
        <div className="shelf-local-note">
          This browser’s collection · drag to reorder, or use the arrow buttons. Files stay on this
          device.
        </div>
      )}
      {error && (
        <div className="app-inline-error" role="alert">
          {error}
          <button onClick={() => void load()}>Retry</button>
        </div>
      )}
      <div className={`shelf-room ${drop ? 'drop-active' : ''}`}>
        <div className="shelf-objects">
          {visible.map((item) => (
            <div
              className={`shelf-slot ${selected === item.id ? 'selected' : ''} ${dragId === item.id ? 'dragging' : ''}`}
              key={item.id}
              draggable={editing}
              onDragStart={(e) => {
                setDragId(item.id);
                e.dataTransfer.setData('application/x-shelf-item', item.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => setDragId('')}
              onDragOver={(e) => {
                if (editing && e.dataTransfer.types.includes('application/x-shelf-item'))
                  e.preventDefault();
              }}
              onDrop={(e) => {
                const id = e.dataTransfer.getData('application/x-shelf-item');
                if (id) {
                  e.preventDefault();
                  e.stopPropagation();
                  void reorder(id, item.id);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setContext({
                  id: item.id,
                  x: Math.max(4, Math.min(e.clientX, innerWidth - 215)),
                  y: Math.max(4, Math.min(e.clientY, innerHeight - 255)),
                });
              }}
            >
              <button
                className="shelf-artifact"
                onClick={() => {
                  setSelected(item.id);
                  setViewer(item);
                }}
              >
                <Artifact item={item} />
              </button>
              <span className="shelf-label">{item.name}</span>
              {editing && (
                <div className="shelf-item-actions">
                  <button
                    aria-label={`Move ${item.name} left`}
                    disabled={items.indexOf(item) === 0}
                    onClick={() => void reorder(item.id, items[items.indexOf(item) - 1].id)}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button aria-label={`Edit ${item.name}`} onClick={() => setDraft({ ...item })}>
                    <Pencil size={12} />
                  </button>
                  <button aria-label={`Delete ${item.name}`} onClick={() => void remove(item)}>
                    <X size={13} />
                  </button>
                  <button
                    aria-label={`Move ${item.name} right`}
                    disabled={items.indexOf(item) === items.length - 1}
                    onClick={() => void reorder(item.id, items[items.indexOf(item) + 1].id)}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        {visible.length === 0 && (
          <div className="empty-shelf">
            <div className="shelf-empty-frame">
              <Icon name="certificate" size={58} />
            </div>
            <h2>A little room for your story.</h2>
            <p>
              {items.length
                ? 'No objects in this category.'
                : 'The shelf is waiting for its first keepsake.'}
            </p>
            <button
              onClick={() => {
                setEditing(true);
                input.current?.click();
              }}
            >
              Add your first object <Plus size={12} />
            </button>
          </div>
        )}
        {drop && (
          <div className="shelf-drop-message">
            <FolderOpen size={35} />
            {editing ? 'Drop your keepsakes here' : 'Choose Arrange collection first'}
          </div>
        )}
      </div>
      <footer className="status-bar">
        <span>
          {items.length} objects · {busy ? 'Saving…' : 'Collection ready'}
        </span>
        <span>Local collection</span>
      </footer>
      {viewer && (
        <Viewer item={viewer} close={() => setViewer(null)} wallpaper={() => wallpaper(viewer)} />
      )}
      {draft && (
        <div className="app-modal-backdrop">
          <form
            className="app-modal shelf-edit"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await repository.put({
                  ...draft,
                  name: draft.name.trim() || draft.filename,
                  category: draft.category.trim() || 'Artifacts',
                });
                setDraft(null);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <h3>Edit object</h3>
            <label>
              Name
              <input
                required
                maxLength={100}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              Description
              <textarea
                maxLength={2000}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>
            <label>
              Category
              <input
                maxLength={60}
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              />
            </label>
            <button className="xp-button" disabled={busy}>
              Save object
            </button>
            <button type="button" className="xp-button" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </form>
        </div>
      )}
      {context && current && (
        <ContextMenu
          x={context.x}
          y={context.y}
          onClose={() => setContext(null)}
          items={[
            { label: 'Open', action: () => setViewer(current) },
            { label: 'Download', action: () => downloadShelf(current) },
            ...(isSafeImage(current.type)
              ? [{ label: 'Set as wallpaper', action: () => wallpaper(current) }]
              : []),
            {
              label: 'Edit details',
              action: () => {
                setEditing(true);
                setDraft({ ...current });
              },
            },
            { label: 'Delete', action: () => void remove(current) },
            {
              label: 'Properties',
              action: () =>
                notify(
                  `${current.filename}\n${current.type}\n${current.size.toLocaleString()} bytes\nAdded ${new Date(current.createdAt).toLocaleDateString()}`,
                ),
            },
          ]}
        />
      )}
    </div>
  );
}
