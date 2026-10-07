import { useRef, useState } from 'react';
import type { AppId, IconName } from '../../types';
import { useDesktop } from '../../lib/DesktopContext';
import { readStorage, writeStorage } from '../../lib/storage';
import Icon from '../Icon';
interface DesktopItem {
  id: string;
  label: string;
  icon: IconName;
  app: AppId;
  params?: Record<string, string>;
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
];
export default function DesktopIcons({
  selected,
  setSelected,
  arrange,
}: {
  selected: string;
  setSelected: (id: string) => void;
  arrange: number;
}) {
  const { launch, notify } = useDesktop();
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() =>
    readStorage('pc-icon-positions', {}),
  );
  const [labels, setLabels] = useState<Record<string, string>>(() =>
    readStorage('pc-icon-labels', {}),
  );
  const [context, setContext] = useState<{ item: DesktopItem; x: number; y: number } | null>(null);
  const [renaming, setRenaming] = useState('');
  const [name, setName] = useState('');
  const drag = useRef<{
    id: string;
    x: number;
    y: number;
    ox: number;
    oy: number;
    moved: boolean;
  } | null>(null);
  const suppress = useRef(false);
  const lastArrange = useRef(arrange);
  if (lastArrange.current !== arrange) {
    lastArrange.current = arrange;
    setPositions({});
    writeStorage('pc-icon-positions', {});
  }
  function rename() {
    if (name.trim()) {
      const next = { ...labels, [renaming]: name.trim().slice(0, 32) };
      setLabels(next);
      writeStorage('pc-icon-labels', next);
    }
    setRenaming('');
  }
  return (
    <>
      <div className="desktop-icons" onPointerDown={() => setContext(null)}>
        {desktopItems.map((item, i) => {
          const base = { x: i >= 6 ? 120 : 22, y: i >= 6 ? 24 : 24 + i * 91 };
          const p = positions[item.id] || base;
          return (
            <div
              key={item.id}
              className={`desktop-icon ${selected === item.id ? 'selected' : ''}`}
              style={{
                left: Math.min(p.x, innerWidth - 95),
                top: Math.min(p.y, innerHeight - 140),
              }}
            >
              <button
                aria-label={item.label}
                onClick={(e) => {
                  if (suppress.current) {
                    suppress.current = false;
                    return;
                  }
                  setSelected(item.id);
                  if (e.detail === 0 || matchMedia('(pointer: coarse)').matches)
                    launch(item.app, item.params);
                }}
                onDoubleClick={() => launch(item.app, item.params)}
                onKeyDown={(e) => {
                  if (e.key === 'F2') {
                    setRenaming(item.id);
                    setName(labels[item.id] || item.label);
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    launch(item.app, item.params);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelected(item.id);
                  setContext({
                    item,
                    x: Math.min(e.clientX, innerWidth - 195),
                    y: Math.min(e.clientY, innerHeight - 185),
                  });
                }}
                onPointerDown={(e) => {
                  if (e.button !== 0 || renaming) return;
                  drag.current = {
                    id: item.id,
                    x: e.clientX,
                    y: e.clientY,
                    ox: p.x,
                    oy: p.y,
                    moved: false,
                  };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  const g = drag.current;
                  if (!g || g.id !== item.id) return;
                  const dx = e.clientX - g.x,
                    dy = e.clientY - g.y;
                  if (Math.abs(dx) + Math.abs(dy) > 7) g.moved = true;
                  if (g.moved)
                    setPositions((old) => ({
                      ...old,
                      [g.id]: {
                        x: Math.max(0, Math.min(innerWidth - 92, g.ox + dx)),
                        y: Math.max(0, Math.min(innerHeight - 135, g.oy + dy)),
                      },
                    }));
                }}
                onPointerUp={() => {
                  if (drag.current?.moved) {
                    suppress.current = true;
                    writeStorage('pc-icon-positions', positions);
                  }
                  drag.current = null;
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
                    if (e.key === 'Enter') rename();
                    if (e.key === 'Escape') setRenaming('');
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      {context && (
        <>
          <div className="menu-dismiss" onPointerDown={() => setContext(null)} />
          <div className="context-menu" style={{ left: context.x, top: context.y }}>
            <button
              className="bold"
              onClick={() => {
                launch(context.item.app, context.item.params);
                setContext(null);
              }}
            >
              Open
            </button>
            <hr />
            <button
              onClick={() => {
                setRenaming(context.item.id);
                setName(labels[context.item.id] || context.item.label);
                setContext(null);
              }}
            >
              Rename
            </button>
            <button
              onClick={() => {
                notify(
                  `${labels[context.item.id] || context.item.label}\nDesktop shortcut · Personal Computer`,
                );
                setContext(null);
              }}
            >
              Properties
            </button>
          </div>
        </>
      )}
    </>
  );
}
