import { useEffect, useState } from 'react';
import { blankMines, MINE_COUNT, MINE_SIZE, neighbors, revealMine, seedMines } from './engines';
import { Flag, RotateCw } from 'lucide-react';
export default function Minesweeper() {
  const [board, setBoard] = useState(blankMines);
  const [status, setStatus] = useState<'ready' | 'running' | 'won' | 'lost'>('ready');
  const [seconds, setSeconds] = useState(0);
  const [flagMode, setFlagMode] = useState(false);
  const flags = board.filter((c) => c.flagged).length;
  useEffect(() => {
    if (status !== 'running') return;
    const timer = setInterval(() => setSeconds((s) => Math.min(999, s + 1)), 1000);
    return () => clearInterval(timer);
  }, [status]);
  function restart() {
    setBoard(blankMines());
    setStatus('ready');
    setSeconds(0);
  }
  function flag(index: number) {
    if (status === 'won' || status === 'lost' || board[index].revealed) return;
    setBoard((b) => b.map((c, i) => (i === index ? { ...c, flagged: !c.flagged } : c)));
  }
  function reveal(index: number) {
    if (status === 'won' || status === 'lost' || board[index].flagged) return;
    let next = status === 'ready' ? seedMines(index, board) : board;
    const targets =
      next[index].revealed &&
      neighbors(index).filter((i) => next[i].flagged).length === next[index].count
        ? neighbors(index).filter((i) => !next[i].flagged)
        : [index];
    if (next[index].revealed && targets[0] === index) return;
    for (const i of targets) next = revealMine(next, i);
    if (next.some((c) => c.mine && c.revealed)) {
      setStatus('lost');
      next = next.map((c) => (c.mine ? { ...c, revealed: true } : c));
    } else if (
      next.filter((c) => c.revealed && !c.mine).length ===
      MINE_SIZE * MINE_SIZE - MINE_COUNT
    ) {
      setStatus('won');
      next = next.map((c) => (c.mine ? { ...c, flagged: true } : c));
    } else setStatus('running');
    setBoard(next);
  }
  return (
    <div className="minesweeper-app">
      <div className="mine-menu">
        <button onClick={restart}>New game</button>
        <button className={flagMode ? 'pressed' : ''} onClick={() => setFlagMode(!flagMode)}>
          <Flag size={13} />
          {flagMode ? 'Flag mode' : 'Reveal mode'}
        </button>
        <span>Beginner · 9 × 9</span>
      </div>
      <div className="mine-cabinet">
        <div className="mine-scoreboard">
          <output aria-label="Mines remaining">
            {String(MINE_COUNT - flags).padStart(3, '0')}
          </output>
          <button aria-label="Restart Minesweeper" onClick={restart}>
            {status === 'lost' ? '☹' : status === 'won' ? '😎' : '☺'}
          </button>
          <output aria-label="Minesweeper timer">{String(seconds).padStart(3, '0')}</output>
        </div>
        <div className="mine-grid" role="grid" aria-label="Minesweeper board" data-status={status}>
          {board.map((c, i) => (
            <button
              key={i}
              role="gridcell"
              aria-label={`Cell ${Math.floor(i / MINE_SIZE) + 1},${(i % MINE_SIZE) + 1}: ${c.flagged ? 'flagged' : c.revealed ? (c.mine ? 'mine' : c.count + ' adjacent mines') : 'covered'}`}
              className={`${c.revealed ? 'revealed' : ''} ${c.mine && c.revealed ? 'mine' : ''} number-${c.count}`}
              onClick={() => (flagMode ? flag(i) : reveal(i))}
              onContextMenu={(e) => {
                e.preventDefault();
                flag(i);
              }}
            >
              {c.flagged ? '⚑' : c.revealed ? (c.mine ? '✹' : c.count || '') : ''}
            </button>
          ))}
        </div>
      </div>
      <p className="mine-status" role="status">
        {status === 'won'
          ? 'FIELD CLEARED. Nicely done.'
          : status === 'lost'
            ? 'A small explosion. Another chance awaits.'
            : status === 'ready'
              ? 'The first step is always safe.'
              : 'A little logic goes a long way.'}
      </p>
      <p className="arcade-hint">
        Click to reveal · Right-click to flag
        <br />
        On touch screens, switch to Flag mode.
      </p>
      <button className="xp-button" onClick={restart}>
        <RotateCw size={13} />
        Restart
      </button>
    </div>
  );
}
