export interface IconPosition {
  x: number;
  y: number;
}
export const ICON_GRID = { x: 16, y: 18, width: 98, height: 100 };
export function arrangeIconGrid(
  ids: string[],
  preferred: Record<string, IconPosition>,
  width: number,
  height: number,
) {
  const g = ICON_GRID;
  const columns = Math.max(1, Math.floor((width - 2 * g.x) / g.width));
  const rows = Math.max(
    1,
    Math.floor((height - 2 * g.y) / g.height),
    Math.ceil(ids.length / columns),
  );
  const used = new Set<number>();
  const result: Record<string, IconPosition> = {};
  ids.forEach((id, index) => {
    const saved = preferred[id];
    const col =
      saved && Number.isFinite(saved.x)
        ? Math.max(0, Math.min(columns - 1, Math.round((saved.x - g.x) / g.width)))
        : Math.floor(index / rows);
    const row =
      saved && Number.isFinite(saved.y)
        ? Math.max(0, Math.min(rows - 1, Math.round((saved.y - g.y) / g.height)))
        : index % rows;
    let slot = col * rows + row;
    if (used.has(slot)) {
      let distance = Infinity;
      for (let candidate = 0; candidate < columns * rows; candidate++) {
        if (used.has(candidate)) continue;
        const delta =
          Math.abs(Math.floor(candidate / rows) - col) + Math.abs((candidate % rows) - row);
        if (delta < distance) {
          distance = delta;
          slot = candidate;
        }
      }
    }
    used.add(slot);
    result[id] = { x: g.x + Math.floor(slot / rows) * g.width, y: g.y + (slot % rows) * g.height };
  });
  return result;
}
