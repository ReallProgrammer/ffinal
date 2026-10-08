import { useEffect, useRef, useState } from 'react';
import {
  LinuxFilesystem,
  linuxCommands,
  listLinux,
  normalizePath,
  basename,
  runShell,
} from '../../lib/linux';
import { shelfRepository } from '../../lib/shelf/repository';
import Snake from '../games/Snake';
import { useDesktop } from '../../lib/DesktopContext';
export default function LinuxTerminal({
  reboot,
  shutdown,
}: {
  reboot: () => void;
  shutdown: () => void;
}) {
  const fs = useRef(new LinuxFilesystem());
  const started = useRef(Date.now());
  const [cwd, setCwd] = useState('/home/guest');
  const [input, setInput] = useState('');
  const [lines, setLines] = useState([
    'Portfolio Linux 6.8.0-curiosity (tty1)',
    '',
    'login: guest',
    'Last login: ' + new Date().toLocaleString(),
    '',
    'Welcome, guest. Type help to find your bearings.',
    '',
  ]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [mode, setMode] = useState<'shell' | 'snake' | 'matrix'>('shell');
  const [matrixTick, setMatrixTick] = useState(0);
  const field = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const draft = useRef('');
  const { beep } = useDesktop();
  const shortPath = cwd.replace(/^\/home\/guest(?=\/|$)/, '~');
  const prompt = `guest@portfolio:${shortPath}$`;
  useEffect(() => {
    void shelfRepository
      .list()
      .then((items) => fs.current.mountShelf(items))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (mode === 'shell') field.current?.focus();
    area.current?.scrollTo(0, area.current.scrollHeight);
  }, [lines, mode]);
  useEffect(() => {
    if (mode !== 'matrix') return;
    const timer = setInterval(() => setMatrixTick((t) => t + 1), 160);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMode('shell');
      }
    };
    window.addEventListener('keydown', key);
    return () => {
      clearInterval(timer);
      window.removeEventListener('keydown', key);
    };
  }, [mode]);
  function execute() {
    const raw = input;
    const nextHistory = raw.trim() ? [...history, raw] : history;
    const result = runShell(
      raw,
      fs.current,
      cwd,
      nextHistory,
      (Date.now() - started.current) / 1000,
    );
    setHistory(nextHistory);
    setHistoryIndex(-1);
    setInput('');
    setCwd(result.cwd);
    if (result.action === 'clear') {
      setLines([]);
      return;
    }
    setLines((l) => [
      ...l.slice(-600),
      `${prompt} ${raw}`,
      ...(result.output ? [result.output, ''] : []),
    ]);
    if (result.action === 'snake' || result.action === 'matrix') setMode(result.action);
    if (result.action === 'reboot') reboot();
    if (result.action === 'shutdown') shutdown();
  }
  const complete = () => {
    const parts = input.split(' ');
    const term = parts.at(-1) || '';
    if (parts.length === 1) {
      const matches = linuxCommands.filter((c) => c.startsWith(term));
      if (matches.length === 1) setInput(matches[0] + ' ');
      else if (matches.length) setLines((l) => [...l, matches.join('  ')]);
    } else {
      const slash = term.lastIndexOf('/');
      const parent = normalizePath(slash >= 0 ? term.slice(0, slash + 1) : '.', cwd);
      const stem = slash >= 0 ? term.slice(slash + 1) : term;
      const matches = listLinux(fs.current.tree, parent).filter((p) =>
        basename(p).startsWith(stem),
      );
      if (matches.length === 1)
        setInput(
          parts.slice(0, -1).join(' ') +
            ' ' +
            (slash >= 0 ? term.slice(0, slash + 1) : '') +
            basename(matches[0]) +
            (fs.current.tree[matches[0]].type === 'dir' ? '/' : ''),
        );
      else if (matches.length) setLines((l) => [...l, matches.map(basename).join('  ')]);
    }
  };
  return (
    <div className="linux-terminal" data-system-mode="LINUX_TERMINAL">
      <header>
        <span>
          PORTFOLIO LINUX <i /> tty1
        </span>
        <span>
          guest session <button onClick={reboot}>Reboot to desktop</button>
        </span>
      </header>
      {mode === 'snake' ? (
        <Snake terminal onExit={() => setMode('shell')} />
      ) : mode === 'matrix' ? (
        <div className="matrix-screen">
          <pre>
            {Array.from({ length: 24 }, (_, y) =>
              Array.from({ length: 64 }, (_, x) =>
                (x * 17 + y * 31 + matrixTick * 7) % 13 < 8
                  ? String((x + y + matrixTick) % 2)
                  : ' ',
              ).join(''),
            ).join('\n')}
          </pre>
          <button onClick={() => setMode('shell')}>[ ESC ] Return to terminal</button>
        </div>
      ) : (
        <div
          ref={area}
          className="linux-scroll"
          onClick={() => {
            if (!window.getSelection()?.toString()) field.current?.focus();
          }}
        >
          <div className="linux-output" role="log" aria-live="polite">
            {lines.map((l, i) => (
              <div key={i}>{l || '\u00a0'}</div>
            ))}
          </div>
          <form
            className="linux-input"
            onSubmit={(e) => {
              e.preventDefault();
              execute();
            }}
          >
            <label htmlFor="linux-command">{prompt}</label>
            <input
              id="linux-command"
              ref={field}
              aria-label="Linux command"
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                beep('type');
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  if (historyIndex < 0) draft.current = input;
                  const next =
                    historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1);
                  if (next >= 0) {
                    setHistoryIndex(next);
                    setInput(history[next]);
                  }
                }
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  if (historyIndex < 0) return;
                  const next = historyIndex + 1;
                  if (next >= history.length) {
                    setInput(draft.current);
                    setHistoryIndex(-1);
                  } else {
                    setHistoryIndex(next);
                    setInput(history[next]);
                  }
                }
                if (e.key === 'Tab') {
                  e.preventDefault();
                  complete();
                }
                if (e.ctrlKey && e.key === 'c') {
                  e.preventDefault();
                  setLines((l) => [...l, prompt + ' ' + input + '^C']);
                  setInput('');
                }
                if (e.ctrlKey && e.key === 'l') {
                  e.preventDefault();
                  setLines([]);
                }
              }}
            />
          </form>
        </div>
      )}
      <footer>
        <span>Local virtual filesystem</span>
        <span>{shortPath}</span>
        <span>UTF-8</span>
      </footer>
    </div>
  );
}
