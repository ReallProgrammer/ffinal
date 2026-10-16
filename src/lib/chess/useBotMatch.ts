import { useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { readStorage, writeStorage } from '../storage';
export interface BotMatch {
  pgn: string;
  timeControl: number;
  whiteMs: number;
  blackMs: number;
  anchor: number | null;
  result: string;
}
export function botClock(state: BotMatch, now = Date.now()) {
  const game = new Chess();
  if (state.pgn) game.loadPgn(state.pgn);
  const elapsed =
    state.timeControl && state.anchor && !state.result ? Math.max(0, now - state.anchor) : 0;
  return {
    whiteMs: Math.max(0, state.whiteMs - (game.turn() === 'w' ? elapsed : 0)),
    blackMs: Math.max(0, state.blackMs - (game.turn() === 'b' ? elapsed : 0)),
  };
}
function settle(state: BotMatch): BotMatch {
  const clocks = botClock(state),
    game = new Chess();
  if (state.pgn) game.loadPgn(state.pgn);
  let result =
    state.result ||
    (game.isCheckmate()
      ? `${game.turn() === 'w' ? 'Black' : 'White'} wins by checkmate`
      : game.isDraw()
        ? 'Draw'
        : '');
  if (!result && state.timeControl && state.anchor && (!clocks.whiteMs || !clocks.blackMs)) {
    const winner = game.turn() === 'w' ? 'b' : 'w';
    const bareKing =
      game
        .board()
        .flat()
        .filter((p) => p?.color === winner).length === 1;
    result =
      bareKing || game.isInsufficientMaterial()
        ? 'Draw on time — insufficient mating material'
        : `${winner === 'w' ? 'White' : 'Black'} wins on time`;
  }
  return { ...state, ...clocks, anchor: result ? null : state.anchor ? Date.now() : null, result };
}
function initial(): BotMatch {
  const saved = readStorage<BotMatch | null>('pc-chess-match', null);
  try {
    if (
      saved &&
      [0, 180, 300, 600, 900].includes(saved.timeControl) &&
      [saved.whiteMs, saved.blackMs].every((v) => Number.isFinite(v) && v >= 0) &&
      (saved.anchor === null || Number.isFinite(saved.anchor)) &&
      typeof saved.result === 'string'
    ) {
      const game = new Chess();
      if (saved.pgn) game.loadPgn(saved.pgn);
      return settle(saved);
    }
  } catch {
    /* Discard corrupt local data. */
  }
  const pgn = readStorage('pc-chess-bot', '');
  const game = new Chess();
  try {
    if (pgn) game.loadPgn(pgn);
  } catch {
    game.reset();
  }
  return {
    pgn: game.history().length ? game.pgn() : '',
    timeControl: 600,
    whiteMs: 600000,
    blackMs: 600000,
    anchor: null,
    result: game.isCheckmate()
      ? `${game.turn() === 'w' ? 'Black' : 'White'} wins by checkmate`
      : game.isDraw()
        ? 'Draw'
        : '',
  };
}
export function useBotMatch(active: boolean) {
  const [state, setState] = useState(initial),
    current = useRef(state);
  const save = (next: BotMatch) => {
    current.current = next;
    setState(next);
    writeStorage('pc-chess-match', next);
    writeStorage('pc-chess-bot', next.pgn);
  };
  function start() {
    const value = current.current;
    if (!value.anchor && !value.result && value.timeControl) save({ ...value, anchor: Date.now() });
  }
  useEffect(() => {
    if (!active) return;
    if (current.current.pgn) start();
    const timer = setInterval(() => {
      const next = settle(current.current);
      if (next.result !== current.current.result) save(next);
    }, 150);
    return () => {
      clearInterval(timer);
      save({ ...settle(current.current), anchor: null });
    };
  }, [active]);
  function play(move: { from: string; to: string; promotion?: string }, expectedPgn?: string) {
    if (expectedPgn !== undefined && current.current.pgn !== expectedPgn) return;
    const next = settle(current.current);
    if (next.result) {
      save(next);
      return;
    }
    const game = new Chess();
    if (next.pgn) game.loadPgn(next.pgn);
    game.move(move);
    const result = game.isCheckmate()
      ? `${game.turn() === 'w' ? 'Black' : 'White'} wins by checkmate`
      : game.isDraw()
        ? 'Draw'
        : '';
    save({ ...next, pgn: game.pgn(), anchor: result ? null : Date.now(), result });
  }
  function newGame(timeControl: number) {
    save({
      pgn: '',
      timeControl,
      whiteMs: timeControl * 1000,
      blackMs: timeControl * 1000,
      anchor: null,
      result: '',
    });
  }
  return { state, start, play, newGame, clock: botClock(state) };
}
