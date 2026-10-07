import { useEffect, useRef, useState } from 'react';
export interface MenuItem {
  label: string;
  action?: () => void;
  shortcut?: string;
  disabled?: boolean;
  checked?: boolean;
  separator?: boolean;
}
export default function MenuBar({ menus }: { menus: { label: string; items: MenuItem[] }[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  return (
    <div className="menu-bar" ref={ref} role="menubar">
      {menus.map((menu) => (
        <div className="menu-wrap" key={menu.label}>
          <button
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={open === menu.label}
            className={open === menu.label ? 'selected' : ''}
            onClick={() => setOpen(open === menu.label ? null : menu.label)}
            onMouseEnter={() => open && setOpen(menu.label)}
          >
            {menu.label}
          </button>
          {open === menu.label && (
            <div className="dropdown-menu" role="menu">
              {menu.items.map((item, i) =>
                item.separator ? (
                  <hr key={i} />
                ) : (
                  <button
                    role="menuitem"
                    disabled={item.disabled}
                    key={i}
                    onClick={() => {
                      item.action?.();
                      setOpen(null);
                    }}
                  >
                    <span>
                      {item.checked ? '✓ ' : ''}
                      {item.label}
                    </span>
                    <small>{item.shortcut}</small>
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
