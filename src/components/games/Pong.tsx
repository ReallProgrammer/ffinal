import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCw } from 'lucide-react';
type PongState = {
  ball: { x: number; y: number; vx: number; vy: number };
  player: number;
  cpu: number;
  score: [number, number];
  status: 'ready' | 'running' | 'paused' | 'over';
};
const fresh = (): PongState => ({
  ball: { x: 300, y: 160, vx: 250, vy: 120 },
  player: 125,
  cpu: 125,
  score: [0, 0],
  status: 'ready',
});
export default function Pong({ active = true }: { active?: boolean }) {
  const [game, setGame] = useState(fresh);
  const state = useRef(game);
  const keys = useRef(new Set<string>());
  const board = useRef<HTMLDivElement>(null);
  const update = (fn: (g: PongState) => PongState) =>
    setGame((g) => {
      const next = fn(g);
      state.current = next;
      return next;
    });
  const start = () =>
    update((g) =>
      g.status === 'over' ? { ...fresh(), status: 'running' } : { ...g, status: 'running' },
    );
  const pause = () =>
    update((g) => ({
      ...g,
      status: g.status === 'running' ? 'paused' : g.status === 'paused' ? 'running' : g.status,
    }));
  useEffect(() => {
    if (!active) {
      update((g) => (g.status === 'running' ? { ...g, status: 'paused' } : g));
      keys.current.clear();
      return;
    }
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input,textarea') || e.ctrlKey || e.altKey || e.metaKey)
        return;
      if (['ArrowUp', 'ArrowDown', 'w', 's'].includes(e.key)) {
        e.preventDefault();
        keys.current.add(e.key);
      }
      if (e.code === 'Space') {
        e.preventDefault();
        pause();
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key);
    const blur = () => {
      keys.current.clear();
      update((g) => (g.status === 'running' ? { ...g, status: 'paused' } : g));
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [active]);
  useEffect(() => {
    if (!active || game.status !== 'running') return;
    let frame = 0,
      last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.033);
      last = now;
      const g = state.current;
      if (g.status !== 'running') return;
      let player = g.player;
      if (keys.current.has('ArrowUp') || keys.current.has('w')) player -= 330 * dt;
      if (keys.current.has('ArrowDown') || keys.current.has('s')) player += 330 * dt;
      player = Math.max(0, Math.min(250, player));
      let cpu =
        g.cpu +
        Math.sign(g.ball.y - (g.cpu + 35)) * Math.min(Math.abs(g.ball.y - (g.cpu + 35)), 135 * dt);
      cpu = Math.max(0, Math.min(250, cpu));
      let ball = { ...g.ball, x: g.ball.x + g.ball.vx * dt, y: g.ball.y + g.ball.vy * dt };
      if (ball.y < 7 || ball.y > 313) {
        ball.y = Math.max(7, Math.min(313, ball.y));
        ball.vy *= -1;
      }
      if (
        ball.vx < 0 &&
        ball.x < 35 &&
        ball.x > 15 &&
        ball.y >= player - 7 &&
        ball.y <= player + 77
      ) {
        ball.x = 35;
        ball.vx = Math.min(430, Math.abs(ball.vx) * 1.055);
        ball.vy = (ball.y - player - 35) * 6;
      }
      if (ball.vx > 0 && ball.x > 565 && ball.x < 585 && ball.y >= cpu - 7 && ball.y <= cpu + 77) {
        ball.x = 565;
        ball.vx = -Math.min(430, Math.abs(ball.vx) * 1.055);
        ball.vy = (ball.y - cpu - 35) * 6;
      }
      const score: [number, number] = [...g.score];
      if (ball.x < 0 || ball.x > 600) {
        score[ball.x > 600 ? 0 : 1]++;
        ball = { x: 300, y: 160, vx: ball.x > 600 ? -240 : 240, vy: 120 };
      }
      const next: PongState = {
        ball,
        player,
        cpu,
        score,
        status: score.some((s) => s >= 5) ? 'over' : 'running',
      };
      state.current = next;
      setGame(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, game.status]);
  const pointer = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && game.status !== 'running') return;
    const svg = board.current!.querySelector('svg')!;
    const point = svg.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;
    const local = point.matrixTransform(svg.getScreenCTM()!.inverse());
    const y = Math.max(0, Math.min(250, local.y - 35));
    update((g) => ({ ...g, player: y }));
  };
  return (
    <div className="pong-game arcade-game">
      <div className="arcade-heading">
        <div>
          <small>AN OLD FRIEND, ONE MORE ROUND</small>
          <h1>Pong</h1>
        </div>
        <div className="arcade-score">
          <small>YOU : COMPUTER</small>
          <b>
            {game.score[0]} : {game.score[1]}
          </b>
        </div>
      </div>
      <div
        ref={board}
        className="pong-board"
        data-status={game.status}
        onPointerMove={pointer}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pointer(e);
        }}
      >
        <svg
          viewBox="0 0 600 320"
          aria-label={`Pong board, player ${game.score[0]}, computer ${game.score[1]}`}
          role="img"
        >
          <path d="M300 0V320" stroke="#809a7433" strokeWidth="3" strokeDasharray="10 12" />
          <rect x="20" y={game.player} width="9" height="70" fill="#d8e5b2" />
          <rect x="571" y={game.cpu} width="9" height="70" fill="#b0c497" />
          <rect x={game.ball.x - 6} y={game.ball.y - 6} width="12" height="12" fill="#f4edb8" />
        </svg>
        {game.status !== 'running' && (
          <div className="arcade-overlay">
            <b>
              {game.status === 'over'
                ? game.score[0] === 5
                  ? 'YOU WIN!'
                  : 'COMPUTER WINS'
                : game.status === 'paused'
                  ? 'PAUSED'
                  : 'FIRST TO FIVE'}
            </b>
            <span>
              {game.status === 'ready'
                ? 'Simple things. Endless rematches.'
                : 'Ready for another round?'}
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
          onClick={pause}
          disabled={!['running', 'paused'].includes(game.status)}
        >
          <Pause size={13} />
          Pause
        </button>
        <button className="xp-button" onClick={() => update(() => fresh())}>
          <RotateCw size={13} />
          Restart
        </button>
      </div>
      <p className="arcade-hint">Move the mouse or touch the court · ↑ ↓ / W S · Space to pause</p>
    </div>
  );
}
