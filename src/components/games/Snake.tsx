import { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Pause, Play, RotateCw } from 'lucide-react';
import { newSnake, SNAKE_HEIGHT, SNAKE_WIDTH, stepSnake, turnSnake } from './engines';
import type { Direction } from './engines';
import { readStorage, writeStorage } from '../../lib/storage';
export default function Snake({
  active = true,
  terminal = false,
  onExit,
}: {
  active?: boolean;
  terminal?: boolean;
  onExit?: () => void;
}) {
  const [game, setGame] = useState(newSnake);
  const [best, setBest] = useState(() => readStorage<number>('pc-snake-best', 0));
  const start = () =>
    setGame((g) =>
      g.status === 'ready' || g.status === 'paused'
        ? { ...g, status: 'running' }
        : { ...newSnake(), status: 'running' },
    );
  const pause = () =>
    setGame((g) => ({
      ...g,
      status: g.status === 'running' ? 'paused' : g.status === 'paused' ? 'running' : g.status,
    }));
  const turn = (d: Direction) => setGame((g) => turnSnake(g, d));
  useEffect(() => {
    if (!active) {
      setGame((g) => (g.status === 'running' ? { ...g, status: 'paused' } : g));
      return;
    }
    if (game.status !== 'running') return;
    const timer = setInterval(
      () => setGame((g) => stepSnake(g)),
      Math.max(55, 165 - Math.floor(game.score / 10) * 6),
    );
    return () => clearInterval(timer);
  }, [active, game.status, game.score]);
  useEffect(() => {
    if (game.score > best) {
      setBest(game.score);
      writeStorage('pc-snake-best', game.score);
    }
  }, [game.score, best]);
  useEffect(() => {
    if (!active) return;
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input,textarea') || e.ctrlKey || e.altKey || e.metaKey)
        return;
      const map: Record<string, Direction> = {
        ArrowUp: 'up',
        w: 'up',
        ArrowDown: 'down',
        s: 'down',
        ArrowLeft: 'left',
        a: 'left',
        ArrowRight: 'right',
        d: 'right',
      };
      if (map[e.key]) {
        e.preventDefault();
        turn(map[e.key]);
      }
      if (e.code === 'Space') {
        e.preventDefault();
        pause();
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        start();
      }
      if (e.key.toLowerCase() === 'q' && onExit) {
        e.preventDefault();
        onExit();
      }
    };
    window.addEventListener('keydown', key);
    const blur = () => setGame((g) => (g.status === 'running' ? { ...g, status: 'paused' } : g));
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('blur', blur);
    };
  }, [active, onExit]);
  const board = Array.from(
    { length: SNAKE_HEIGHT },
    (_, y) =>
      '█' +
      Array.from({ length: SNAKE_WIDTH }, (_, x) =>
        game.body.some((p) => p.x === x && p.y === y)
          ? '▓'
          : game.food.x === x && game.food.y === y
            ? '@'
            : ' ',
      ).join('') +
      '█',
  ).join('\n');
  return (
    <div className={`snake-game arcade-game ${terminal ? 'terminal-snake' : ''}`}>
      <div className="arcade-heading">
        <div>
          <small>{terminal ? 'TTY ARCADE / SNAKE' : 'PERSONAL COMPUTER ARCADE'}</small>
          <h1>Snake</h1>
        </div>
        <div className="arcade-score">
          SCORE <b>{String(game.score).padStart(3, '0')}</b>
          <small>BEST {String(best).padStart(3, '0')}</small>
        </div>
      </div>
      <div
        className="snake-board"
        role="img"
        aria-label={`Snake board, ${game.status}, score ${game.score}`}
        data-status={game.status}
        data-length={game.body.length}
      >
        {terminal ? (
          <pre>
            {'█'.repeat(SNAKE_WIDTH + 2) + '\n' + board + '\n' + '█'.repeat(SNAKE_WIDTH + 2)}
          </pre>
        ) : (
          <svg viewBox={`0 0 ${SNAKE_WIDTH * 16} ${SNAKE_HEIGHT * 16}`}>
            <defs>
              <pattern id="snake-grid" width="16" height="16" patternUnits="userSpaceOnUse">
                <path d="M16 0H0V16" fill="none" stroke="#324431" strokeWidth=".5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#snake-grid)" />
            {game.body.map((p, i) => (
              <rect
                key={i}
                x={p.x * 16 + 1}
                y={p.y * 16 + 1}
                width="14"
                height="14"
                fill={i === 0 ? '#dce7a1' : '#a4be77'}
              />
            ))}
            <rect
              x={game.food.x * 16 + 4}
              y={game.food.y * 16 + 4}
              width="8"
              height="8"
              fill="#deb886"
            />
          </svg>
        )}
        {game.status !== 'running' && (
          <div className="arcade-overlay">
            <b>
              {game.status === 'ready'
                ? 'READY WHEN YOU ARE'
                : game.status === 'paused'
                  ? 'PAUSED'
                  : game.status === 'won'
                    ? 'YOU FILLED THE WORLD'
                    : 'GAME OVER'}
            </b>
            <span>
              {game.status === 'over'
                ? `${game.score} points. One more go?`
                : game.status === 'paused'
                  ? 'Take your time.'
                  : 'A familiar little obsession.'}
            </span>
          </div>
        )}
      </div>
      <div className="arcade-controls">
        <button className="xp-button" onClick={start}>
          <Play size={13} />
          {game.status === 'paused' ? 'Resume' : 'Start'}
        </button>
        <button
          className="xp-button"
          disabled={!['running', 'paused'].includes(game.status)}
          onClick={pause}
        >
          <Pause size={13} />
          {game.status === 'paused' ? 'Resume' : 'Pause'}
        </button>
        <button className="xp-button" onClick={() => setGame(newSnake())}>
          <RotateCw size={13} />
          Restart
        </button>
        {onExit && (
          <button className="xp-button" onClick={onExit}>
            Exit [Q]
          </button>
        )}
      </div>
      <div className="direction-pad" aria-label="Snake controls">
        <button aria-label="Snake up" onClick={() => turn('up')}>
          <ArrowUp size={18} />
        </button>
        <button aria-label="Snake left" onClick={() => turn('left')}>
          <ArrowLeft size={18} />
        </button>
        <button aria-label="Snake down" onClick={() => turn('down')}>
          <ArrowDown size={18} />
        </button>
        <button aria-label="Snake right" onClick={() => turn('right')}>
          <ArrowRight size={18} />
        </button>
      </div>
      <p className="arcade-hint">
        Arrow keys / WASD to move · Space to pause{terminal ? ' · Q to return' : ''}
      </p>
    </div>
  );
}
