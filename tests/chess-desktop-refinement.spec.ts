import { test, expect } from '@playwright/test';
import { Chess } from 'chess.js';
import { desktop, runApp } from './helpers/entry';
import { arrangeIconGrid } from '../src/lib/desktop-grid';

test('grid ignores legacy saved positions and keeps icons aligned on resize', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'pc-icon-positions',
      JSON.stringify({
        computer: { x: 900, y: 800 },
        documents: { x: 900, y: 800 },
        internet: { x: 900, y: 800 },
      }),
    ),
  );
  await desktop(page);
  for (const [width, height] of [
    [1440, 900],
    [390, 700],
    [640, 360],
    [320, 568],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await expect
      .poll(async () =>
        page.locator('.desktop-surface').evaluate((el) => {
          const icons = [...el.querySelectorAll<HTMLElement>('[data-desktop-id]')].map((e) => ({
            x: e.offsetLeft,
            y: e.offsetTop,
            w: e.offsetWidth,
            h: e.offsetHeight,
          }));
          return icons.every(
            (a, i) =>
              a.x >= 0 &&
              a.x + a.w <= el.clientWidth &&
              (a.x - 16) % 98 === 0 &&
              (a.y - 18) % 100 === 0 &&
              icons
                .slice(i + 1)
                .every(
                  (b) =>
                    a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y,
                ),
          );
        }),
      )
      .toBe(true);
  }
  const layout = arrangeIconGrid(
    Array.from({ length: 30 }, (_, i) => '' + i),
    {},
    320,
    350,
  );
  expect(new Set(Object.values(layout).map((p) => `${p.x},${p.y}`)).size).toBe(30);
  expect(Math.max(...Object.values(layout).map((p) => p.y))).toBeGreaterThan(350);
});

test('chess clocks, themes and history preserve the live board', async ({ page }) => {
  await desktop(page);
  await runApp(page, 'chess');
  const app = page.locator('.chess-app');
  await app.getByLabel('New game clock').selectOption('180');
  await app.getByRole('button', { name: 'New game', exact: true }).click();
  await expect(app.getByLabel('White clock')).toHaveText('3:00');
  await app.getByLabel('Board theme').selectOption('ocean');
  await expect(app).toHaveAttribute('data-chess-theme', 'ocean');
  await app.getByLabel('Bot difficulty').selectOption('beginner');
  await app.getByRole('button', { name: 'e2 white pawn', exact: true }).click();
  await expect(app.getByLabel('White clock')).not.toHaveText('3:00');
  await app.getByRole('button', { name: 'e4 legal move', exact: true }).click();
  await expect(app.locator('.chess-status')).toHaveText('White to move', { timeout: 10000 });
  await expect(app.getByRole('button', { name: 'Review move 1: e4', exact: true })).toBeVisible();
  await app.getByRole('button', { name: 'First position', exact: true }).click();
  await expect(app.getByRole('button', { name: 'e2 white pawn', exact: true })).toBeDisabled();
  await app.getByRole('button', { name: 'Next move', exact: true }).click();
  await expect(app.getByRole('button', { name: 'e4 white pawn', exact: true })).toBeDisabled();
  await app.getByRole('button', { name: 'Live board', exact: true }).click();
  await expect(app.getByRole('button', { name: 'e4 white pawn', exact: true })).toBeEnabled();
  await page.screenshot({ path: '/tmp/chess-refinement-' + test.info().project.name + '.png' });
  await desktop(page);
  await runApp(page, 'chess');
  await expect(app).toHaveAttribute('data-chess-theme', 'ocean');
  await expect(app.getByRole('button', { name: 'Review move 1: e4', exact: true })).toBeVisible();
});

for (const outcome of ['win', 'lose', 'draw', 'timeout']) {
  test(`chess ${outcome} shows a result dialog and allows move review`, async ({ page }) => {
    const game = new Chess();
    for (const move of outcome === 'win'
      ? ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#']
      : outcome === 'lose'
        ? ['f3', 'e5', 'g4', 'Qh4#']
        : outcome === 'draw'
          ? ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8']
          : ['e4', 'e5'])
      game.move(move);
    await page.addInitScript(
      ({ pgn, timeout }) =>
        localStorage.setItem(
          'pc-chess-match',
          JSON.stringify({
            pgn,
            timeControl: 180,
            whiteMs: timeout ? 50 : 180000,
            blackMs: 180000,
            anchor: timeout ? Date.now() - 100 : null,
            result: '',
          }),
        ),
      { pgn: game.pgn(), timeout: outcome === 'timeout' },
    );
    await desktop(page);
    await runApp(page, 'chess');
    const dialog = page.getByRole('dialog', {
      name: outcome === 'win' ? 'You won!' : outcome === 'draw' ? 'A draw' : 'You lost',
      exact: true,
    });
    await expect(dialog).toBeVisible();
    if (outcome === 'timeout') await expect(dialog).toContainText('Black wins on time');
    await dialog.getByRole('button', { name: 'Review the moves' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.chess-review-note')).toContainText('Move 0');
    await page
      .locator('.chess-app')
      .getByRole('button', { name: 'Next move', exact: true })
      .click();
    await expect(page.locator('.chess-review-note')).toContainText('Move 1');
  });
}
