export interface Point {
  x: number;
  y: number;
}
export type Direction = 'up' | 'down' | 'left' | 'right';
export interface SnakeModel {
  body: Point[];
  direction: Direction;
  nextDirection: Direction;
  food: Point;
  score: number;
  status: 'ready' | 'running' | 'paused' | 'over' | 'won';
}
export const SNAKE_WIDTH = 22,
  SNAKE_HEIGHT = 16;
export function snakeFood(body: Point[], random = Math.random): Point {
  const empty: Point[] = [];
  for (let y = 0; y < SNAKE_HEIGHT; y++)
    for (let x = 0; x < SNAKE_WIDTH; x++)
      if (!body.some((p) => p.x === x && p.y === y)) empty.push({ x, y });
  return empty[Math.floor(random() * empty.length)] || { x: -1, y: -1 };
}
export function newSnake(): SnakeModel {
  const body = [
    { x: 10, y: 8 },
    { x: 9, y: 8 },
    { x: 8, y: 8 },
  ];
  return {
    body,
    direction: 'right',
    nextDirection: 'right',
    food: snakeFood(body),
    score: 0,
    status: 'ready',
  };
}
export function turnSnake(s: SnakeModel, next: Direction): SnakeModel {
  const reverse: Record<Direction, Direction> = {
    up: 'down',
    down: 'up',
    left: 'right',
    right: 'left',
  };
  return next === reverse[s.direction] ? s : { ...s, nextDirection: next };
}
export function stepSnake(s: SnakeModel, random = Math.random): SnakeModel {
  if (s.status !== 'running') return s;
  const delta = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  }[s.nextDirection];
  const head = { x: s.body[0].x + delta.x, y: s.body[0].y + delta.y };
  const eating = head.x === s.food.x && head.y === s.food.y;
  const collision = (eating ? s.body : s.body.slice(0, -1)).some(
    (p) => p.x === head.x && p.y === head.y,
  );
  if (head.x < 0 || head.x >= SNAKE_WIDTH || head.y < 0 || head.y >= SNAKE_HEIGHT || collision)
    return { ...s, status: 'over' };
  const body = [head, ...s.body];
  if (!eating) body.pop();
  const won = body.length === SNAKE_WIDTH * SNAKE_HEIGHT;
  return {
    ...s,
    body,
    direction: s.nextDirection,
    score: s.score + (eating ? 10 : 0),
    food: eating ? snakeFood(body, random) : s.food,
    status: won ? 'won' : 'running',
  };
}
export interface MineCell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  count: number;
}
export const MINE_SIZE = 9,
  MINE_COUNT = 10;
export function blankMines(): MineCell[] {
  return Array.from({ length: MINE_SIZE * MINE_SIZE }, () => ({
    mine: false,
    revealed: false,
    flagged: false,
    count: 0,
  }));
}
export function neighbors(index: number) {
  const result: number[] = [];
  const x = index % MINE_SIZE,
    y = Math.floor(index / MINE_SIZE);
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx,
        yy = y + dy;
      if (xx >= 0 && xx < MINE_SIZE && yy >= 0 && yy < MINE_SIZE) result.push(yy * MINE_SIZE + xx);
    }
  return result;
}
export function seedMines(first: number, current = blankMines(), random = Math.random) {
  const board = current.map((c) => ({ ...c }));
  const safe = new Set([first, ...neighbors(first)]);
  const options = board.map((_, i) => i).filter((i) => !safe.has(i));
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  for (const index of options.slice(0, MINE_COUNT)) board[index].mine = true;
  board.forEach((c, i) => (c.count = neighbors(i).filter((n) => board[n].mine).length));
  return board;
}
export function revealMine(board: MineCell[], index: number): MineCell[] {
  const next = board.map((c) => ({ ...c }));
  const queue = [index];
  const visited = new Set<number>();
  while (queue.length) {
    const i = queue.pop()!;
    if (visited.has(i)) continue;
    visited.add(i);
    const cell = next[i];
    if (cell.flagged || cell.revealed) continue;
    cell.revealed = true;
    if (!cell.mine && cell.count === 0) queue.push(...neighbors(i));
  }
  return next;
}
