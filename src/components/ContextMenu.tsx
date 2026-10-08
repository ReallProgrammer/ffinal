import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';
export interface ContextAction {
  label: string;
  action?: () => void;
  disabled?: boolean;
  children?: ContextAction[];
  separator?: boolean;
}
export default function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: ContextAction[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });
  const [submenu, setSubmenu] = useState<number | null>(null);
  useLayoutEffect(() => {
    const box = ref.current!.getBoundingClientRect();
    setPosition({
      x: Math.max(4, Math.min(x, innerWidth - box.width - 4)),
      y: Math.max(4, Math.min(y, innerHeight - box.height - 4)),
    });
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [x, y]);
  useEffect(() => {
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', esc);
    };
  }, [onClose]);
  function activate(item: ContextAction) {
    item.action?.();
    onClose();
  }
  return createPortal(
    <div
      ref={ref}
      className="context-menu enhanced-context"
      role="menu"
      style={{ left: position.x, top: position.y }}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        const buttons = [
          ...ref.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
        ];
        const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          buttons[
            (current + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
          ]?.focus();
        }
        if (e.key === 'ArrowRight') {
          const index = Number((document.activeElement as HTMLElement).dataset.index);
          if (items[index]?.children) {
            e.preventDefault();
            setSubmenu(index);
            setTimeout(
              () =>
                ref.current?.querySelector<HTMLButtonElement>('.enhanced-submenu button')?.focus(),
              0,
            );
          }
        }
        if (e.key === 'ArrowLeft' && submenu !== null) {
          e.preventDefault();
          ref.current?.querySelector<HTMLButtonElement>(`button[data-index="${submenu}"]`)?.focus();
          setSubmenu(null);
        }
      }}
    >
      {items.map((item, i) =>
        item.separator ? (
          <hr key={i} />
        ) : (
          <div
            className="context-sub-wrap"
            key={i}
            onMouseEnter={() => setSubmenu(item.children ? i : null)}
          >
            <button
              role="menuitem"
              data-index={i}
              disabled={item.disabled}
              aria-haspopup={item.children ? 'menu' : undefined}
              aria-expanded={item.children ? submenu === i : undefined}
              onClick={() =>
                item.children ? setSubmenu(submenu === i ? null : i) : activate(item)
              }
            >
              {item.label}
              {item.children && <ChevronRight size={13} />}
            </button>
            {item.children && submenu === i && (
              <div
                className={`context-menu enhanced-submenu ${position.x + 400 > innerWidth ? 'opens-left' : ''}`}
                role="menu"
              >
                {item.children.map((child, j) => (
                  <button
                    role="menuitem"
                    key={j}
                    disabled={child.disabled}
                    onClick={() => activate(child)}
                  >
                    {child.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ),
      )}
    </div>,
    document.body,
  );
}
