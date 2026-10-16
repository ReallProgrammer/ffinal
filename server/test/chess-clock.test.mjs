import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { clockValues, timeoutResult } from '../src/chess-clock.mjs';
test('only an active timed game charges the side to move and clocks stop at zero', () => {
  const row = {
    status: 'active',
    time_control: 180,
    clock_updated_at: new Date(1000),
    white_ms: 5000,
    black_ms: 7000,
    fen: new Chess().fen(),
  };
  assert.deepEqual(clockValues(row, 3000), { whiteMs: 3000, blackMs: 7000 });
  assert.deepEqual(clockValues(row, 9000), { whiteMs: 0, blackMs: 7000 });
  for (const extra of [{ status: 'waiting' }, { status: 'finished' }, { time_control: 0 }])
    assert.deepEqual(clockValues({ ...row, ...extra }, 3000), { whiteMs: 5000, blackMs: 7000 });
  const game = new Chess();
  game.move('e4');
  assert.deepEqual(clockValues({ ...row, fen: game.fen() }, 3000), {
    whiteMs: 5000,
    blackMs: 5000,
  });
});
test('timeout declares the opponent winner or a draw without mating material', () => {
  assert.equal(timeoutResult(new Chess().fen()), 'Owner wins on time');
  assert.match(timeoutResult('7k/8/8/8/8/8/8/KQ6 w - - 0 1'), /^Draw on time/);
  assert.match(timeoutResult('7k/8/8/8/8/8/8/KN6 w - - 0 1'), /^Draw on time/);
});
