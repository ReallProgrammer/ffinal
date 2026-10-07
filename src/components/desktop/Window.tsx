import { useRef } from 'react';
import type { ReactNode } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';
import type { WindowData } from '../../types';
import Icon from '../Icon';
export default function Window({
  window: w,
  active,
  focus,
  update,
  close,
  children,
}: {
  window: WindowData;
  active: boolean;
  focus: () => void;
  update: (p: Partial<WindowData>) => void;
  close: () => void;
  children: ReactNode;
}) {
  const gesture = useRef<{
    x: number;
    y: number;
    ox: number;
    oy: number;
    width: number;
    height: number;
    edge: string;
  } | null>(null);
  const start = (e: React.PointerEvent, edge = 'move') => {
    if (w.maximized || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;
    focus();
    gesture.current = {
      x: e.clientX,
      y: e.clientY,
      ox: w.x,
      oy: w.y,
      width: w.width,
      height: w.height,
      edge,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const move = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.x,
      dy = e.clientY - g.y;
    if (g.edge === 'move')
      update({
        x: Math.max(0, Math.min(innerWidth - 100, g.ox + dx)),
        y: Math.max(0, Math.min(innerHeight - 92, g.oy + dy)),
      });
    else {
      const minW = w.app === 'calculator' ? 280 : 330;
      const minH = w.app === 'calculator' ? 390 : 230;
      const p: Partial<WindowData> = {};
      if (g.edge.includes('e')) p.width = Math.max(minW, Math.min(innerWidth - g.ox, g.width + dx));
      if (g.edge.includes('s'))
        p.height = Math.max(minH, Math.min(innerHeight - 48 - g.oy, g.height + dy));
      if (g.edge.includes('w')) {
        p.width = Math.max(minW, Math.min(g.width + g.ox, g.width - dx));
        p.x = g.ox + g.width - p.width;
      }
      if (g.edge.includes('n')) {
        p.height = Math.max(minH, Math.min(g.height + g.oy, g.height - dy));
        p.y = g.oy + g.height - p.height;
      }
      update(p);
    }
  };
  const end = () => {
    gesture.current = null;
  };
  return (
    <section
      className={`os-window ${active ? 'active' : 'inactive'} ${w.maximized ? 'maximized' : ''} app-${w.app}`}
      data-window-id={w.id}
      data-app={w.app}
      aria-label={w.title}
      style={{
        left: w.x,
        top: w.y,
        width: w.width,
        height: w.height,
        zIndex: w.z,
        display: w.minimized ? 'none' : undefined,
      }}
      onPointerDown={focus}
    >
      <header
        className="title-bar"
        onPointerDown={(e) => start(e)}
        onPointerMove={move}
        onPointerUp={end}
        onLostPointerCapture={end}
        onDoubleClick={() => update({ maximized: !w.maximized })}
      >
        <div className="window-title">
          <Icon name={w.icon} size={20} />
          <span>{w.title}</span>
        </div>
        <div className="window-controls">
          <button aria-label={`Minimize ${w.title}`} onClick={() => update({ minimized: true })}>
            <Minus size={15} />
          </button>
          <button
            aria-label={`${w.maximized ? 'Restore' : 'Maximize'} ${w.title}`}
            onClick={() => update({ maximized: !w.maximized })}
          >
            {w.maximized ? <Copy size={13} /> : <Square size={13} />}
          </button>
          <button className="close-button" aria-label={`Close ${w.title}`} onClick={close}>
            <X size={18} />
          </button>
        </div>
      </header>
      <div className="window-content">{children}</div>
      {!w.maximized &&
        ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map((edge) => (
          <div
            key={edge}
            className={`resize-handle resize-${edge}`}
            onPointerDown={(e) => start(e, edge)}
            onPointerMove={move}
            onPointerUp={end}
            onLostPointerCapture={end}
          />
        ))}
    </section>
  );
}
