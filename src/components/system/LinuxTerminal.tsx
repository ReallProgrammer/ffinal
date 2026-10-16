import { useEffect, useRef, useState } from 'react';
import {
  ENTRY_FLAG,
  challengeHint,
  challengeFilesystem,
  flagCaptured,
} from '../../lib/entry-challenge';
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
  onStartUI,
}: {
  reboot: () => void;
  shutdown: () => void;
  onStartUI: () => void;
}) {
  const [unlocked, setUnlocked] = useState(flagCaptured);
  const [initialFilesystem] = useState(() =>
    unlocked ? new LinuxFilesystem() : challengeFilesystem(),
  );
  const fs = useRef(initialFilesystem);
  const started = useRef(Date.now());
  const [cwd, setCwd] = useState('/home/guest');
  const [input, setInput] = useState('');
  const [lines, setLines] = useState([
    'Portfolio Linux 6.8.0-curiosity (tty1)',
    '',
    'login: guest',
    'Last login: ' + new Date().toLocaleString(),
    '',
    unlocked
      ? 'Welcome, guest. Type help to explore the terminal site. Type UIstart to launch the UI.'
      : challengeHint,
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
    if (!unlocked) return;
    void shelfRepository
      .list()
      .then((items) => fs.current.mountShelf(items))
      .catch(() => {});
  }, [unlocked]);
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
    const words = raw.trim().split(/\s+/),
      command = words[0].toLowerCase();
    const answer = (text: string) => {
      setInput('');
      setHistory(nextHistory);
      setHistoryIndex(-1);
      setLines((l) => [...l.slice(-600), `${prompt} ${raw}`, text, '']);
    };
    if (command === 'uistart') {
      if (unlocked) {
        answer('Starting the graphical desktop…');
        onStartUI();
      } else
        answer(
          'UI locked. Find ctf.txt and submit its contents with -flag FLAG{...} first. Type hint for help.',
        );
      return;
    }
    if (command === '-flag') {
      if (unlocked)
        answer('Flag already captured. Type help to explore, or UIstart to launch the UI.');
      else if (words.length === 2 && words[1] === ENTRY_FLAG) {
        try {
          sessionStorage.setItem('pc-terminal-flag', 'captured');
        } catch {
          /* Current session still unlocks. */
        }
        fs.current = new LinuxFilesystem();
        setCwd('/home/guest');
        setUnlocked(true);
        answer(
          'FLAG CAPTURED — terminal access granted.\n\nWelcome to the real portfolio terminal. Type help for commands, cat CV.txt for my résumé, or ls to explore.\nType UIstart whenever you want to launch the UI.',
        );
      } else answer('Flag not accepted. Read ctf.txt and enter: -flag followed by the exact flag.');
      return;
    }
    if (!unlocked) {
      if (command === 'hint' || command === 'help') {
        answer(
          challengeHint +
            '\n\nCommands: ls, ls -a, cd DIRECTORY, cd .., pwd, cat FILE, find . -name ctf.txt, clear.\nYou can also move or edit the local challenge files with mv, cp, mkdir, touch, echo and >.\nSubmit: -flag FLAG{...}. Type reset-challenge if you lose a file.',
        );
        return;
      }
      if (command === 'reset-challenge') {
        fs.current = challengeFilesystem(true);
        setCwd('/home/guest');
        try {
          localStorage.removeItem('pc-ctf-fs-v1');
        } catch {
          /* fresh in-memory tree remains usable */
        }
        answer('Challenge files restored. ' + challengeHint);
        return;
      }
      const allowed = new Set([
        'ls',
        'cd',
        'pwd',
        'cat',
        'find',
        'clear',
        'echo',
        'mkdir',
        'touch',
        'mv',
        'cp',
        'rm',
        'head',
        'tail',
        'grep',
        'history',
        'man',
      ]);
      if (command && !allowed.has(command)) {
        answer('This boot shell is locked. Type help for the challenge commands.');
        return;
      }
      // Prevent invoking portfolio-only commands through a pipeline before the flag is captured.
      if (raw.split('|').some((part) => !allowed.has(part.trim().split(/\s+/)[0]) && part.trim())) {
        answer('Only challenge commands are available until you capture the flag.');
        return;
      }
    }
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
      const matches = [
        ...linuxCommands,
        'UIstart',
        '-flag',
        ...(!unlocked ? ['hint', 'reset-challenge'] : []),
      ].filter((c) => c.toLowerCase().startsWith(term.toLowerCase()));
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
    <div
      className="linux-terminal"
      data-system-mode="LINUX_TERMINAL"
      data-entry-phase={unlocked ? 'unlocked' : 'locked'}
    >
      <header>
        <span>
          PORTFOLIO LINUX <i /> tty1
        </span>
        <span>
          {unlocked ? 'guest session · UIstart launches the UI' : 'boot challenge · type help'}
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
