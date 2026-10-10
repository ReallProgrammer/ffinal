import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
export default function ZoomSurface({
  children,
  label = 'Zoomable artwork',
}: {
  children: ReactNode;
  label?: string;
}) {
  const root = useRef<HTMLDivElement>(null),
    [view, setView] = useState({ scale: 1, x: 0, y: 0 }),
    state = useRef(view),
    points = useRef(new Map<number, { x: number; y: number }>());
  state.current = view;
  const change = (next: typeof view) => {
    state.current = next;
    setView(next);
  };
  function zoomAt(x: number, y: number, factor: number) {
    const r = root.current?.getBoundingClientRect();
    if (!r) return;
    const old = state.current,
      scale = Math.max(1, Math.min(6, old.scale * factor)),
      f = scale / old.scale,
      px = x - r.left - r.width / 2,
      py = y - r.top - r.height / 2;
    change(
      scale === 1
        ? { scale: 1, x: 0, y: 0 }
        : { scale, x: px - (px - old.x) * f, y: py - (py - old.y) * f },
    );
  }
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  }, []);
  return (
    <div
      className="zoom-surface"
      ref={root}
      aria-label={label}
      onPointerDown={(e) => {
        points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }}
      onPointerMove={(e) => {
        const old = points.current.get(e.pointerId);
        if (!old) return;
        if (state.current.scale > 1 && Math.hypot(e.clientX - old.x, e.clientY - old.y) > 3)
          e.currentTarget.setPointerCapture(e.pointerId);
        const before = [...points.current.values()];
        points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const after = [...points.current.values()];
        if (before.length === 2) {
          const dist = (v: typeof before) => Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y);
          const center = { x: (after[0].x + after[1].x) / 2, y: (after[0].y + after[1].y) / 2 };
          zoomAt(center.x, center.y, dist(after) / Math.max(1, dist(before)));
        } else if (state.current.scale > 1)
          change({
            ...state.current,
            x: state.current.x + e.clientX - old.x,
            y: state.current.y + e.clientY - old.y,
          });
      }}
      onPointerUp={(e) => points.current.delete(e.pointerId)}
      onPointerCancel={(e) => points.current.delete(e.pointerId)}
    >
      <div
        className="zoom-content"
        style={{ transform: `translate(${view.x}px,${view.y}px) scale(${view.scale})` }}
      >
        {children}
      </div>
      <div className="zoom-tools" onPointerDown={(e) => e.stopPropagation()}>
        <span>{Math.round(view.scale * 100)}%</span>
        <button type="button" onClick={() => change({ scale: 1, x: 0, y: 0 })}>
          Reset zoom
        </button>
      </div>
    </div>
  );
}
