import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { AppId, IconName, FileEntry } from '../../types';
import { useDesktop } from '../../lib/DesktopContext';
import { readStorage, writeStorage } from '../../lib/storage';
import {
  addFileEntry,
  clipboardFiles,
  pasteFiles,
  fileClipboard,
  FILE_DRAG_TYPE,
  getFile,
  moveFiles,
  removeFiles,
  renameFile,
  useFiles,
} from '../../data/filesystem';
import Icon from '../Icon';
import ContextMenu from '../ContextMenu';
interface DesktopItem {
  id: string;
  label: string;
  icon: IconName;
  app: AppId;
  params?: Record<string, string>;
  file?: FileEntry;
}
export const desktopItems: DesktopItem[] = [
  { id: 'computer', label: 'My Computer', icon: 'computer', app: 'explorer' },
  {
    id: 'documents',
    label: 'My Documents',
    icon: 'documents',
    app: 'explorer',
    params: { folder: 'documents' },
  },
  { id: 'internet', label: 'Internet', icon: 'globe', app: 'browser' },
  {
    id: 'projects',
    label: 'My Projects',
    icon: 'folder',
    app: 'explorer',
    params: { folder: 'projects' },
  },
  { id: 'terminal', label: 'Command Prompt', icon: 'terminal', app: 'terminal' },
  {
    id: 'recycle',
    label: 'Recycle Bin',
    icon: 'recycle',
    app: 'explorer',
    params: { folder: 'recycle' },
  },
  {
    id: 'readme',
    label: 'READ ME.txt',
    icon: 'notepad',
    app: 'notepad',
    params: { file: 'readme' },
  },
  { id: 'shelf', label: 'My Shelf', icon: 'certificate', app: 'shelf' },
  { id: 'games', label: 'Games', icon: 'game', app: 'games' },
];
type Position = { x: number; y: number };
export default function DesktopIcons({
  selected,
  setSelected,
  arrange,
  focused,
}: {
  selected: string[];
  setSelected: (ids: string[]) => void;
  arrange: number;
  focused: boolean;
}) {
  const { launch, notify, openFile, focusWindow } = useDesktop();
  const allFiles = useFiles();
  const [positions, setPositions] = useState<Record<string, Position>>(() =>
    readStorage('pc-icon-positions', {}),
  );
  const [labels, setLabels] = useState<Record<string, string>>(() =>
    readStorage('pc-icon-labels', {}),
  );
  const [hidden, setHidden] = useState<string[]>(() => readStorage('pc-desktop-hidden', []));
  const [context, setContext] = useState<{ item: DesktopItem; x: number; y: number } | null>(null);
  const [renaming, setRenaming] = useState('');
  const [name, setName] = useState('');
  const [selection, setSelection] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dropTarget, setDropTarget] = useState('');
  const [size, setSize] = useState({ w: innerWidth, h: innerHeight });
  const surface = useRef<HTMLDivElement>(null);
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const drag = useRef<{
    id: string;
    x: number;
    y: number;
    items: Record<string, Position>;
    moved: boolean;
  } | null>(null);
  const marquee = useRef<{ x: number; y: number; base: string[] } | null>(null);
  const suppress = useRef(false);
  const anchor = useRef('');
  const lastArrange = useRef(arrange);
  const undoDelete = useRef<{ ids: string[]; hidden: string[] } | null>(null);
  const extra = allFiles
    .filter((f) => f.parent === 'desktop')
    .map((f) => ({
      id: f.id,
      label: f.name,
      icon: f.icon,
      app: (f.app || 'explorer') as AppId,
      params: f.params,
      file: f,
    }));
  const items = [...desktopItems.filter((i) => !hidden.includes(i.id)), ...extra];
  const rows = Math.max(3, Math.min(6, Math.floor((size.h - 140) / 91)));
  const pos = (item: DesktopItem, i: number) =>
    positions[item.id] || { x: 22 + Math.floor(i / rows) * 98, y: 24 + (i % rows) * 91 };
  useEffect(() => {
    const resize = () => setSize({ w: innerWidth, h: innerHeight });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    if (lastArrange.current === arrange) return;
    lastArrange.current = arrange;
    setPositions({});
    setLabels(readStorage('pc-icon-labels', {}));
    setHidden(readStorage('pc-desktop-hidden', []));
    writeStorage('pc-icon-positions', {});
    setSelected([]);
  }, [arrange, setSelected]);
  function open(item: DesktopItem) {
    if (item.file) openFile(item.file);
    else launch(item.app, item.params);
  }
  function rename() {
    if (name.trim()) {
      try {
        const item = items.find((i) => i.id === renaming);
        if (item?.file) renameFile(item.id, name.trim());
        else {
          const next = { ...labels, [renaming]: name.trim().slice(0, 64) };
          setLabels(next);
          writeStorage('pc-icon-labels', next);
        }
      } catch (e) {
        notify((e as Error).message);
      }
    }
    setRenaming('');
  }
  function deleteIcons(ids = selected) {
    const nextHidden = [...hidden];
    const recycled: string[] = [];
    try {
      for (const id of ids) {
        const item = items.find((i) => i.id === id);
        if (!item) continue;
        if (id === 'computer' || id === 'recycle') {
          notify('This system icon stays on the desktop.');
          continue;
        }
        if (item.file) {
          removeFiles([id]);
          recycled.push(id);
        } else {
          const key = 'shortcut-' + id;
          const previous = getFile(key);
          if (previous) moveFiles([key], 'recycle');
          else
            addFileEntry({
              id: key,
              name: labels[id] || item.label,
              kind: 'app',
              icon: item.icon,
              app: item.app,
              params: item.params,
              parent: 'recycle',
              originalParent: 'desktop',
            });
          recycled.push(key);
          nextHidden.push(id);
        }
      }
      undoDelete.current = { ids: recycled, hidden };
      setHidden([...new Set(nextHidden)]);
      writeStorage('pc-desktop-hidden', [...new Set(nextHidden)]);
      setSelected([]);
    } catch (e) {
      notify((e as Error).message);
    }
  }
  useEffect(() => {
    if (!focused) return;
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).matches('input,textarea,select') ||
        (e.target as HTMLElement).closest('[role="menu"]')
      )
        return;
      if (e.key === 'F2' && selected.length === 1) {
        e.preventDefault();
        const item = items.find((i) => i.id === selected[0]);
        if (item) {
          setRenaming(item.id);
          setName(labels[item.id] || item.label);
        }
      }
      if (e.key === 'Delete' && selected.length) {
        e.preventDefault();
        deleteIcons();
      }
      if ((e.ctrlKey || e.metaKey) && ['c', 'x', 'v'].includes(e.key.toLowerCase())) {
        const key = e.key.toLowerCase();
        const ids = selected.filter((id) => extra.some((item) => item.id === id));
        if (key === 'v' && fileClipboard) {
          e.preventDefault();
          try {
            pasteFiles('desktop');
          } catch (error) {
            notify((error as Error).message);
          }
        } else if (key !== 'v' && ids.length) {
          e.preventDefault();
          clipboardFiles(ids, key === 'x');
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelected(items.map((i) => i.id));
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && undoDelete.current) {
        e.preventDefault();
        try {
          const u = undoDelete.current;
          for (const id of u.ids) {
            if (id.startsWith('shortcut-')) removeFiles([id], true);
            else moveFiles([id], 'desktop');
          }
          setHidden(u.hidden);
          writeStorage('pc-desktop-hidden', u.hidden);
          undoDelete.current = null;
        } catch (error) {
          notify((error as Error).message);
        }
      }
      if (e.key === 'Escape') {
        setContext(null);
        setRenaming('');
        setSelection(null);
      }
      if (e.key === 'Enter' && !renaming) {
        e.preventDefault();
        selected.forEach((id) => {
          const item = items.find((i) => i.id === id);
          if (item) open(item);
        });
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [focused, selected, items, labels, renaming]);
  function itemAt(x: number, y: number) {
    return document
      .elementsFromPoint(x, y)
      .map((el) => el.closest<HTMLElement>('[data-desktop-id]'))
      .find((el) => el && !selected.includes(el.dataset.desktopId!));
  }
  const dropFiles = (e: React.DragEvent, parent: string) => {
    const data = e.dataTransfer.getData(FILE_DRAG_TYPE);
    if (!data) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      moveFiles(JSON.parse(data), parent);
    } catch (error) {
      notify((error as Error).message);
    }
    setDropTarget('');
  };
  return (
    <>
      <div
        ref={surface}
        className={`desktop-icons desktop-surface ${dragging ? 'icons-dragging' : ''}`}
        onPointerDown={(e) => {
          if (e.button !== 0 || (e.target as HTMLElement).closest('.desktop-icon')) return;
          e.preventDefault();
          setContext(null);
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left,
            y = e.clientY - rect.top;
          marquee.current = { x, y, base: e.ctrlKey || e.metaKey || e.shiftKey ? selected : [] };
          if (!e.ctrlKey && !e.metaKey && !e.shiftKey) setSelected([]);
          setSelection({ x, y, width: 0, height: 0 });
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const m = marquee.current;
          if (!m) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left,
            y = e.clientY - rect.top;
          const box = {
            x: Math.min(m.x, x),
            y: Math.min(m.y, y),
            width: Math.abs(x - m.x),
            height: Math.abs(y - m.y),
          };
          setSelection(box);
          const hit = items
            .filter((item) => {
              const element = [
                ...surface.current!.querySelectorAll<HTMLElement>('[data-desktop-id]'),
              ].find((el) => el.dataset.desktopId === item.id);
              if (!element) return false;
              const bounds = element.getBoundingClientRect();
              const p = { x: bounds.left - rect.left, y: bounds.top - rect.top };
              return (
                p.x < box.x + box.width &&
                p.x + bounds.width > box.x &&
                p.y < box.y + box.height &&
                p.y + bounds.height > box.y
              );
            })
            .map((i) => i.id);
          setSelected([...new Set([...m.base, ...hit])]);
        }}
        onPointerUp={() => {
          marquee.current = null;
          setSelection(null);
        }}
        onPointerCancel={() => {
          marquee.current = null;
          setSelection(null);
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(FILE_DRAG_TYPE)) e.preventDefault();
        }}
        onDrop={(e) => dropFiles(e, 'desktop')}
      >
        {items.map((item, i) => {
          const p = pos(item, i);
          return (
            <div
              data-desktop-id={item.id}
              key={item.id}
              className={`desktop-icon ${selected.includes(item.id) ? 'selected' : ''} ${dropTarget === item.id ? 'drop-target' : ''}`}
              style={
                {
                  left: Math.min(p.x, size.w - 95),
                  top: Math.min(p.y, size.h - 140),
                  '--icon-x': `${Math.min(p.x, size.w - 95)}px`,
                  '--icon-y': `${Math.min(p.y, size.h - 140)}px`,
                } as CSSProperties
              }
              onDragOver={(e) => {
                if (
                  e.dataTransfer.types.includes(FILE_DRAG_TYPE) &&
                  (item.id === 'recycle' || item.params?.folder || item.file?.kind === 'folder')
                ) {
                  e.preventDefault();
                  e.stopPropagation();
                  setDropTarget(item.id);
                }
              }}
              onDragLeave={() => setDropTarget('')}
              onDrop={(e) =>
                dropFiles(
                  e,
                  item.id === 'recycle'
                    ? 'recycle'
                    : item.file?.kind === 'folder'
                      ? item.id
                      : item.params?.folder || 'desktop',
                )
              }
            >
              <button
                aria-label={item.label}
                aria-pressed={selected.includes(item.id)}
                onClick={(e) => {
                  if (suppress.current) {
                    suppress.current = false;
                    return;
                  }
                  if (e.ctrlKey || e.metaKey)
                    setSelected(
                      selected.includes(item.id)
                        ? selected.filter((id) => id !== item.id)
                        : [...selected, item.id],
                    );
                  else if (e.shiftKey && anchor.current) {
                    const a = items.findIndex((i) => i.id === anchor.current);
                    setSelected(items.slice(Math.min(a, i), Math.max(a, i) + 1).map((i) => i.id));
                  } else {
                    setSelected([item.id]);
                    anchor.current = item.id;
                  }
                  if (e.detail === 0 || matchMedia('(pointer: coarse)').matches) open(item);
                }}
                onDoubleClick={(e) => {
                  if (e.ctrlKey || e.metaKey) return;
                  open(item);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    open(item);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!selected.includes(item.id)) setSelected([item.id]);
                  setContext({
                    item,
                    x: Math.max(4, Math.min(e.clientX, innerWidth - 205)),
                    y: Math.max(4, Math.min(e.clientY, innerHeight - 230)),
                  });
                }}
                onPointerDown={(e) => {
                  if (e.button !== 0 || renaming) return;
                  e.stopPropagation();
                  const ids = selected.includes(item.id) ? selected : [item.id];
                  drag.current = {
                    id: item.id,
                    x: e.clientX,
                    y: e.clientY,
                    items: Object.fromEntries(
                      items
                        .filter((v) => ids.includes(v.id))
                        .map((v) => [v.id, pos(v, items.indexOf(v))]),
                    ),
                    moved: false,
                  };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  const g = drag.current;
                  if (!g) return;
                  const dx = e.clientX - g.x,
                    dy = e.clientY - g.y;
                  if (Math.abs(dx) + Math.abs(dy) > 7) g.moved = true;
                  if (!g.moved) return;
                  setDragging(true);
                  setSelected(Object.keys(g.items));
                  const next = { ...positionsRef.current };
                  for (const [id, origin] of Object.entries(g.items))
                    next[id] = {
                      x: Math.max(0, Math.min(size.w - 92, origin.x + dx)),
                      y: Math.max(0, Math.min(size.h - 135, origin.y + dy)),
                    };
                  positionsRef.current = next;
                  setPositions(next);
                  setDropTarget(itemAt(e.clientX, e.clientY)?.dataset.desktopId || '');
                }}
                onPointerUp={(e) => {
                  const g = drag.current;
                  if (g?.moved) {
                    suppress.current = true;
                    writeStorage('pc-icon-positions', positionsRef.current);
                    const target = itemAt(e.clientX, e.clientY)?.dataset.desktopId;
                    if (target === 'recycle') deleteIcons(Object.keys(g.items));
                    else {
                      const targetItem = items.find((i) => i.id === target);
                      const folder = document
                        .elementsFromPoint(e.clientX, e.clientY)
                        .map((el) => el.closest<HTMLElement>('[data-folder-drop]'))
                        .find(Boolean)?.dataset.folderDrop;
                      const parent =
                        folder ||
                        (targetItem?.file?.kind === 'folder'
                          ? targetItem.id
                          : targetItem?.params?.folder);
                      if (parent) {
                        const ids = Object.keys(g.items).filter((id) =>
                          extra.some((i) => i.id === id),
                        );
                        if (ids.length)
                          try {
                            moveFiles(ids, parent);
                            const targetWindow = document
                              .elementsFromPoint(e.clientX, e.clientY)
                              .map((el) => el.closest<HTMLElement>('[data-window-id]'))
                              .find(Boolean)?.dataset.windowId;
                            if (targetWindow) focusWindow(targetWindow);
                          } catch (error) {
                            notify((error as Error).message);
                          }
                      }
                    }
                  }
                  drag.current = null;
                  setDragging(false);
                  setDropTarget('');
                }}
                onPointerCancel={() => {
                  drag.current = null;
                  setDragging(false);
                  setDropTarget('');
                }}
              >
                <Icon name={item.icon} size={45} />
                {renaming !== item.id && <span>{labels[item.id] || item.label}</span>}
              </button>
              {renaming === item.id && (
                <input
                  className="icon-rename"
                  autoFocus
                  aria-label="Rename desktop icon"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={rename}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') rename();
                    if (e.key === 'Escape') setRenaming('');
                  }}
                />
              )}
            </div>
          );
        })}
        {selection && (
          <div
            className="desktop-selection"
            data-testid="desktop-selection"
            style={{
              left: selection.x,
              top: selection.y,
              width: selection.width,
              height: selection.height,
            }}
          />
        )}
      </div>
      {context && (
        <ContextMenu
          x={context.x}
          y={context.y}
          onClose={() => setContext(null)}
          items={[
            { label: 'Open', action: () => open(context.item) },
            {
              label: 'Rename',
              action: () => {
                setRenaming(context.item.id);
                setName(labels[context.item.id] || context.item.label);
              },
            },
            {
              label: 'Copy',
              disabled: !context.item.file,
              action: () => clipboardFiles(selected.filter((id) => extra.some((i) => i.id === id))),
            },
            {
              label: 'Cut',
              disabled: !context.item.file,
              action: () =>
                clipboardFiles(
                  selected.filter((id) => extra.some((i) => i.id === id)),
                  true,
                ),
            },
            {
              label: 'Delete',
              disabled: ['computer', 'recycle'].includes(context.item.id),
              action: () =>
                deleteIcons(selected.includes(context.item.id) ? selected : [context.item.id]),
            },
            {
              label: 'Properties',
              action: () =>
                notify(
                  `${labels[context.item.id] || context.item.label}\nDesktop ${context.item.file ? 'file' : 'shortcut'} · ${selected.length} selected`,
                ),
            },
          ]}
        />
      )}
    </>
  );
}
