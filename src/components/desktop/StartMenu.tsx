import { useEffect, useRef, useState } from 'react';
import { ChevronRight, LogOut } from 'lucide-react';
import Icon from '../Icon';
import { useDesktop } from '../../lib/DesktopContext';
import { profile } from '../../data/profile';
import type { AppId, IconName } from '../../types';
export default function StartMenu({
  onClose,
  onPower,
}: {
  onClose: () => void;
  onPower: () => void;
}) {
  const { launch } = useDesktop();
  const [programs, setPrograms] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const open = (app: AppId, params?: Record<string, string>) => {
    launch(app, params);
    onClose();
  };
  const apps: { app: AppId; label: string; sub?: string; icon: IconName }[] = [
    { app: 'browser', label: 'Internet', sub: 'Explore the world wide web', icon: 'globe' },
    { app: 'notepad', label: 'Notepad', sub: 'A penny for your thoughts', icon: 'notepad' },
    {
      app: 'terminal',
      label: 'Command Prompt',
      sub: 'For the keyboard explorers',
      icon: 'terminal',
    },
    { app: 'calculator', label: 'Calculator', sub: 'It all adds up', icon: 'calculator' },
  ];
  useEffect(() => {
    const first = ref.current?.querySelector<HTMLButtonElement>('button');
    first?.focus();
  }, []);
  return (
    <div
      className="start-menu"
      ref={ref}
      role="dialog"
      aria-label="Start menu"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
          return;
        }
        if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
          e.preventDefault();
          const buttons = [
            ...ref.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
          ];
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          buttons[
            (index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
          ]?.focus();
        }
        if (e.key === 'ArrowRight') setPrograms(true);
        if (e.key === 'ArrowLeft') setPrograms(false);
      }}
    >
      <header>
        <span className="user-avatar">
          <Icon name="user" size={43} />
        </span>
        <div>
          <b>{profile.name}</b>
          <small>Good to have you here.</small>
        </div>
      </header>
      <div className="start-menu-body">
        <div className="start-left">
          {apps.map((a, i) => (
            <button
              key={a.app}
              className={i === 0 ? 'start-internet' : ''}
              onClick={() => open(a.app)}
            >
              <Icon name={a.icon} size={36} />
              <span>
                <b>{a.label}</b>
                <small>{a.sub}</small>
              </span>
            </button>
          ))}
          <hr />
          <button onClick={() => open('game')}>
            <Icon name="game" size={34} />
            <span>Take a little break</span>
          </button>
          <div
            className="all-programs-wrap"
            onMouseEnter={() => setPrograms(true)}
            onMouseLeave={() => setPrograms(false)}
          >
            <button
              className="all-programs"
              onClick={() => setPrograms(!programs)}
              aria-expanded={programs}
            >
              All Programs <ChevronRight size={20} />
            </button>
            {programs && (
              <div className="programs-submenu">
                {[
                  ...apps,
                  { app: 'game' as AppId, label: 'Memory Lane', icon: 'game' as IconName },
                  {
                    app: 'settings' as AppId,
                    label: 'Control Panel',
                    icon: 'settings' as IconName,
                  },
                ].map((a) => (
                  <button key={a.app} onClick={() => open(a.app)}>
                    <Icon name={a.icon} size={23} />
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="start-right">
          <button onClick={() => open('explorer', { folder: 'documents' })}>
            <Icon name="documents" size={26} />
            <b>My Documents</b>
          </button>
          <button onClick={() => open('explorer', { folder: 'projects' })}>
            <Icon name="folder" size={26} />
            <b>My Projects</b>
          </button>
          <button onClick={() => open('explorer')}>
            <Icon name="computer" size={26} />
            <b>My Computer</b>
          </button>
          <hr />
          <button onClick={() => open('settings')}>
            <Icon name="settings" size={25} />
            Control Panel
          </button>
          <button onClick={() => open('browser', { page: 'contact' })}>
            <Icon name="mail" size={25} />
            Connect with me
          </button>
          <hr />
          <button onClick={() => open('search')}>
            <Icon name="search" size={25} />
            Search
          </button>
          <button onClick={() => open('run')}>
            <Icon name="computer" size={25} />
            Run…
          </button>
        </div>
      </div>
      <footer>
        <button
          onClick={() => {
            onClose();
            onPower();
          }}
        >
          <LogOut size={20} /> Log Off
        </button>
        <button
          onClick={() => {
            onClose();
            onPower();
          }}
        >
          <Icon name="power" size={25} /> Turn Off Computer
        </button>
      </footer>
    </div>
  );
}
