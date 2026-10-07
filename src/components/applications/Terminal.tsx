import { useEffect, useRef, useState } from 'react';
import { children, filePath, files, getFile } from '../../data/filesystem';
import { profile } from '../../data/profile';
import { readStorage } from '../../lib/storage';
import { useDesktop } from '../../lib/DesktopContext';
import type { WindowData } from '../../types';
export default function Terminal({ window: w, active }: { window: WindowData; active: boolean }) {
  const { close, launch, bsod, setSettings, settings, beep } = useDesktop();
  const [lines, setLines] = useState([
    'Personal Computer [Version 5.1.2600]',
    '(C) 2004–' + new Date().getFullYear() + ' A curious mind. All possibilities reserved.',
    '',
    'Type “help” to find your way around.',
    '',
  ]);
  const [input, setInput] = useState('');
  const [cwd, setCwd] = useState('disk');
  const [history, setHistory] = useState<string[]>([]);
  const [hi, setHi] = useState(-1);
  const [draft, setDraft] = useState('');
  const body = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const prompt = filePath(cwd).replace(/\\$/, '') + '\\>';
  useEffect(() => {
    if (active) field.current?.focus();
  }, [active]);
  useEffect(() => {
    body.current?.scrollTo(0, body.current.scrollHeight);
  }, [lines]);
  function resolve(path: string) {
    const lower = path.replace(/^"|"$/g, '').toLowerCase();
    if (lower === '..') return getFile(cwd)?.parent === 'computer' ? 'disk' : getFile(cwd)?.parent;
    if (lower === '/' || lower === '\\' || lower === 'c:' || lower === 'c:\\') return 'disk';
    return (
      files.find((f) => f.parent === cwd && (f.name.toLowerCase() === lower || f.id === lower))
        ?.id ||
      files.find(
        (f) => filePath(f.id).toLowerCase().replace(/\\$/, '') === lower.replace(/\\$/, ''),
      )?.id
    );
  }
  function execute(raw: string) {
    const [cmd, ...args] = raw.trim().split(/\s+/);
    const arg = args.join(' ');
    let result = '';
    switch (cmd.toLowerCase()) {
      case 'help':
        result =
          'AVAILABLE COMMANDS\n\n  dir              List the current directory\n  cd <folder>      Change directory (cd .. to go back)\n  type <file>      Read a text file\n  cls              Clear the screen\n  whoami / about   Meet the person behind the pixels\n  skills           Open the toolbox\n  education        Follow the learning journey\n  projects         Explore selected work\n  contact          Get in touch\n  ver / date / time / echo <text>\n  start <app>      Launch notepad, calc, explorer, or browser\n  exit             Close this window\n\n  Psst. Some commands are better discovered than documented.';
        break;
      case 'dir': {
        const entries = children(cwd);
        result = ` Directory of ${filePath(cwd)}\n\n${entries.map((f) => `${f.kind === 'folder' ? '<DIR>   ' : '        '} ${f.name}`).join('\n')}\n\n ${entries.length} item(s)`;
        break;
      }
      case 'cd': {
        if (!arg) {
          result = filePath(cwd);
          break;
        }
        const target = resolve(arg);
        if (target && getFile(target)?.kind === 'folder') {
          setCwd(target);
        } else result = 'The system cannot find the path specified.';
        break;
      }
      case 'type': {
        const target = resolve(arg);
        const file = getFile(target || '');
        result =
          file?.kind === 'text'
            ? (readStorage<Record<string, string>>('pc-notes', {})[file.name] ?? file.content ?? '')
            : 'The system cannot find the file specified.';
        break;
      }
      case 'cls':
        setLines([]);
        return;
      case 'whoami':
        result = profile.name + '\n' + profile.shortRole;
        break;
      case 'about':
        result = profile.about;
        break;
      case 'skills':
        result = 'MY TOOLBOX\n\n' + profile.skills.map((s) => '  + ' + s).join('\n');
        break;
      case 'education':
        result = profile.education;
        break;
      case 'projects':
        result = profile.projects
          .map((p) => p.name + '\n  ' + p.description + (p.url ? '\n  ' + p.url : ''))
          .join('\n\n');
        break;
      case 'contact':
        result = `GitHub: ${profile.github}\n${profile.email ? 'Email: ' + profile.email : 'Email has not been added yet.'}`;
        break;
      case 'ver':
        result = 'Personal Computer XP [Version 5.1.2600] — Curiosity Edition';
        break;
      case 'date':
        result = 'The current date is: ' + new Date().toLocaleDateString();
        break;
      case 'time':
        result = 'The current time is: ' + new Date().toLocaleTimeString();
        break;
      case 'echo':
        result = arg;
        break;
      case 'exit':
        close(w.id);
        return;
      case 'start': {
        const apps = {
          notepad: 'notepad',
          calc: 'calculator',
          calculator: 'calculator',
          explorer: 'explorer',
          browser: 'browser',
          game: 'game',
        } as const;
        const app = apps[arg.toLowerCase() as keyof typeof apps];
        if (app) {
          launch(app);
          result = 'Starting ' + arg + '…';
        } else result = 'Usage: start notepad | calc | explorer | browser | game';
        break;
      }
      case 'matrix':
        setSettings({ wallpaper: settings.wallpaper === 'night' ? 'bliss' : 'night' });
        result = 'Follow the white rabbit.\nWallpaper switched. Reality is still intact.';
        break;
      case 'sudo':
        result = 'Nice try. With great power comes great responsibility.\nBut this is Windows.';
        break;
      case 'secret':
      case 'game':
        launch('game');
        result = 'You found the arcade. Take a little break.';
        break;
      case 'bsod':
      case 'crash':
        bsod();
        result = 'A tiny, entirely simulated catastrophe.';
        break;
      case 'error':
        launch('dialog');
        result = 'An unexpected amount of nostalgia has occurred.';
        break;
      case 'hello':
        result = 'Hello, fellow internet explorer. Glad you’re here.';
        break;
      case '':
        break;
      default:
        result = `'${cmd}' is not recognized as an internal or external command,\noperable program or batch file. Type 'help' for available commands.`;
        beep('error');
    }
    setLines((l) => [...l.slice(-500), prompt + raw, ...(result ? ['', result, ''] : [])]);
  }
  return (
    <div
      className="terminal"
      ref={body}
      onClick={() => {
        if (!window.getSelection()?.toString()) field.current?.focus();
      }}
    >
      <div className="terminal-output" role="log" aria-live="polite">
        {lines.map((line, i) => (
          <div key={i}>{line || '\u00a0'}</div>
        ))}
      </div>
      <form
        className="terminal-command"
        onSubmit={(e) => {
          e.preventDefault();
          execute(input);
          if (input.trim()) setHistory((h) => [...h, input]);
          setInput('');
          setHi(-1);
          setDraft('');
        }}
      >
        <label htmlFor={`cmd-${w.id}`}>{prompt}</label>
        <input
          id={`cmd-${w.id}`}
          ref={field}
          aria-label="Command prompt input"
          autoComplete="off"
          spellCheck={false}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            beep('type');
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              if (hi === -1) setDraft(input);
              const next = hi === -1 ? history.length - 1 : Math.max(0, hi - 1);
              if (history[next] !== undefined) {
                setHi(next);
                setInput(history[next]);
              }
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (hi < 0) return;
              const next = hi + 1;
              if (next >= history.length) {
                setHi(-1);
                setInput(draft);
              } else {
                setHi(next);
                setInput(history[next]);
              }
            }
            if (e.key === 'Tab') {
              e.preventDefault();
              const parts = input.split(' ');
              const fragment = parts.at(-1)?.toLowerCase() || '';
              const match = children(cwd).find((f) => f.name.toLowerCase().startsWith(fragment));
              if (match) setInput([...parts.slice(0, -1), match.name].join(' '));
            }
          }}
        />
      </form>
    </div>
  );
}
