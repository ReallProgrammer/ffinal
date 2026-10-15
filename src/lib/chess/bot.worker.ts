import { Chess } from 'chess.js';
const values: Record<string, number> = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 0 };
self.onmessage = ({ data }: { data: { pgn: string; difficulty: string } }) => {
  const game = new Chess();
  if (data.pgn) game.loadPgn(data.pgn);
  const legal = game.moves({ verbose: true });
  if (!legal.length) {
    self.postMessage(null);
    return;
  }
  if (data.difficulty === 'beginner') {
    const m = legal[Math.floor(Math.random() * legal.length)];
    self.postMessage({ from: m.from, to: m.to, promotion: m.promotion });
    return;
  }
  const deadline = performance.now() + (data.difficulty === 'casual' ? 450 : 1600);
  function evaluate() {
    let score = 0;
    for (const row of game.board())
      for (const piece of row)
        if (piece) {
          const x = piece.square.charCodeAt(0) - 97,
            y = Number(piece.square[1]) - 1;
          const center = 3.5 - Math.abs(x - 3.5) + 3.5 - Math.abs(y - 3.5);
          const advance = piece.type === 'p' ? (piece.color === 'w' ? y : 7 - y) * 7 : 0;
          score +=
            (piece.color === 'w' ? 1 : -1) *
            (values[piece.type] +
              advance +
              (piece.type === 'n' || piece.type === 'b' ? center * 9 : 0));
        }
    return score * (game.turn() === 'w' ? 1 : -1);
  }
  function search(depth: number, alpha: number, beta: number, ply: number): number {
    if (performance.now() > deadline) throw new Error('deadline');
    if (game.isCheckmate()) return -100000 + ply;
    if (game.isDraw()) return 0;
    if (!depth) return evaluate();
    const moves = game
      .moves({ verbose: true })
      .sort((a, b) => values[b.captured || 'k'] - values[a.captured || 'k']);
    for (const move of moves) {
      game.move(move);
      let score: number;
      try {
        score = -search(depth - 1, -beta, -alpha, ply + 1);
      } finally {
        game.undo();
      }
      if (score >= beta) return beta;
      alpha = Math.max(alpha, score);
    }
    return alpha;
  }
  let best = legal[0];
  for (let depth = 1; depth <= (data.difficulty === 'casual' ? 2 : 4); depth++) {
    let candidate = best,
      score = -Infinity;
    try {
      for (const move of legal) {
        game.move(move);
        let value: number;
        try {
          value = -search(depth - 1, -Infinity, Infinity, 1);
        } finally {
          game.undo();
        }
        if (value > score) {
          score = value;
          candidate = move;
        }
      }
      best = candidate;
    } catch {
      break;
    }
  }
  self.postMessage({ from: best.from, to: best.to, promotion: best.promotion });
};
