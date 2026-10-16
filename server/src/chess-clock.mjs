import { Chess } from 'chess.js';
export function clockValues(row, now = Date.now()) {
  const elapsed =
    row.status === 'active' && row.time_control > 0 && row.clock_updated_at
      ? Math.max(0, now - new Date(row.clock_updated_at).getTime())
      : 0;
  const turn = row.fen.split(' ')[1];
  return {
    whiteMs: Math.max(0, Number(row.white_ms) - (turn === 'w' ? elapsed : 0)),
    blackMs: Math.max(0, Number(row.black_ms) - (turn === 'b' ? elapsed : 0)),
  };
}
export function timeoutResult(fen) {
  const game = new Chess(fen),
    winner = game.turn() === 'w' ? 'b' : 'w';
  const pieces = game
    .board()
    .flat()
    .filter((piece) => piece?.color === winner);
  if (pieces.length === 1 || game.isInsufficientMaterial())
    return 'Draw on time — insufficient mating material';
  return winner === 'w' ? 'Visitor wins on time' : 'Owner wins on time';
}
export async function settleClock(db, row, now = Date.now()) {
  if (row.status !== 'active' || !row.time_control || !row.clock_updated_at) return false;
  const remaining = clockValues(row, now);
  if (remaining.whiteMs > 0 && remaining.blackMs > 0) return false;
  Object.assign(
    row,
    (
      await db.query(
        "UPDATE chess_matches SET status='finished', result=$2, white_ms=$3, black_ms=$4, clock_updated_at=NULL, version=version+1, updated_at=now() WHERE id=$1 RETURNING *",
        [row.id, timeoutResult(row.fen), remaining.whiteMs, remaining.blackMs],
      )
    ).rows[0],
  );
  return true;
}
