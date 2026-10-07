import { useEffect, useState } from 'react';
import { files } from '../../data/filesystem';
import { useDesktop } from '../../lib/DesktopContext';
import Icon from '../Icon';
import type { AppId, WindowData } from '../../types';
export function SearchApp() {
  const [query, setQuery] = useState('');
  const { openFile } = useDesktop();
  const results = query.trim()
    ? files.filter(
        (f) =>
          f.name.toLowerCase().includes(query.toLowerCase()) ||
          f.content?.toLowerCase().includes(query.toLowerCase()),
      )
    : [];
  return (
    <div className="search-app">
      <div className="utility-heading">
        <Icon name="search" size={44} />
        <div>
          <h1>What are you looking for?</h1>
          <p>A file, a thought, a small discovery.</p>
        </div>
      </div>
      <label>
        All or part of the file name or content:
        <input
          autoFocus
          aria-label="Search files"
          placeholder="Try skills, projects, or curiosity…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <p className="search-summary">
        {query
          ? `${results.length} result${results.length === 1 ? '' : 's'} found`
          : 'Your search starts here.'}
      </p>
      <div className="search-results">
        {results.map((f) => (
          <button key={f.id} onClick={() => openFile(f)}>
            <Icon name={f.icon} size={30} />
            <span>
              <b>{f.name}</b>
              <small>
                {f.kind === 'folder' ? 'File folder' : 'Document'} · {f.parent}
              </small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
export function RunApp({ window: w }: { window: WindowData }) {
  const [command, setCommand] = useState('');
  const [error, setError] = useState('');
  const { launch, close, bsod } = useDesktop();
  function run() {
    const apps: Record<string, AppId> = {
      cmd: 'terminal',
      terminal: 'terminal',
      notepad: 'notepad',
      calc: 'calculator',
      calculator: 'calculator',
      explorer: 'explorer',
      iexplore: 'browser',
      browser: 'browser',
      control: 'settings',
      settings: 'settings',
      search: 'search',
      game: 'game',
    };
    const value = command.trim().toLowerCase();
    if (value === 'bsod') {
      bsod();
      close(w.id);
      return;
    }
    if (apps[value]) {
      launch(apps[value]);
      close(w.id);
    } else setError(`Cannot find “${command}”. Try cmd, notepad, calc, explorer, or control.`);
  }
  return (
    <form
      className="run-app"
      onSubmit={(e) => {
        e.preventDefault();
        run();
      }}
    >
      <div>
        <Icon name="computer" size={38} />
        <p>Type the name of a program, and this computer will open it for you.</p>
      </div>
      <label>
        Open:
        <input autoFocus value={command} onChange={(e) => setCommand(e.target.value)} />
      </label>
      {error && <p className="run-error">{error}</p>}
      <footer>
        <button className="xp-button" disabled={!command.trim()}>
          OK
        </button>
        <button type="button" className="xp-button" onClick={() => close(w.id)}>
          Cancel
        </button>
      </footer>
    </form>
  );
}
const symbols = ['✿', '★', '☀', '☂', '♫', '✳', '☕', '☘'];
function newDeck() {
  return [...symbols, ...symbols]
    .map((symbol, i) => ({ symbol, id: i }))
    .sort(() => Math.random() - 0.5);
}
export function Game() {
  const [deck, setDeck] = useState(newDeck);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const { beep } = useDesktop();
  const won = matched.length === 16;
  useEffect(() => {
    if (open.length !== 2) return;
    const [a, b] = open;
    const match = deck[a].symbol === deck[b].symbol;
    const t = setTimeout(
      () => {
        if (match) setMatched((m) => [...m, a, b]);
        setOpen([]);
      },
      match ? 280 : 800,
    );
    return () => clearTimeout(t);
  }, [open, deck]);
  return (
    <div className="game-app">
      <span className="eyebrow">YOU FOUND A LITTLE DETOUR.</span>
      <h1>Memory lane.</h1>
      <p>A moment away from the open tabs. Match the pairs.</p>
      <div className="game-score">
        <span>{moves} moves</span>
        <span>{matched.length / 2} / 8 pairs</span>
      </div>
      <div className="memory-grid">
        {deck.map((card, i) => (
          <button
            key={card.id}
            aria-label={`Card ${i + 1}${open.includes(i) || matched.includes(i) ? ': ' + card.symbol : ''}`}
            className={matched.includes(i) ? 'matched' : open.includes(i) ? 'flipped' : ''}
            disabled={open.includes(i) || matched.includes(i) || open.length === 2}
            onClick={() => {
              beep('click');
              setOpen((v) => [...v, i]);
              if (open.length === 1) setMoves((m) => m + 1);
            }}
          >
            {open.includes(i) || matched.includes(i) ? card.symbol : '?'}
          </button>
        ))}
      </div>
      {won ? (
        <p className="game-win">All the pieces found their place. Nicely done. ✧</p>
      ) : (
        <p className="game-hint">No timer. No rush. Just a little curiosity.</p>
      )}
      <button
        className="xp-button"
        onClick={() => {
          setDeck(newDeck());
          setOpen([]);
          setMatched([]);
          setMoves(0);
        }}
      >
        New game
      </button>
    </div>
  );
}
export function DialogApp({ window: w }: { window: WindowData }) {
  const { close } = useDesktop();
  return (
    <div className="dialog-app">
      <div>
        <span className="dialog-error-icon">!</span>
        <p>
          {w.params.message ||
            'This program has performed an unexpectedly delightful operation.\n\nNo files were harmed. Carry on exploring.'}
        </p>
      </div>
      <button autoFocus className="xp-button" onClick={() => close(w.id)}>
        OK
      </button>
      <small>A simulated system message. Your computer is fine.</small>
    </div>
  );
}
