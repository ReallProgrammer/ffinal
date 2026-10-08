import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  newSnake,
  stepSnake,
  turnSnake,
  seedMines,
  revealMine,
  neighbors,
  MINE_COUNT,
} from '../src/components/games/engines';
async function boot(page: Page) {
  await page.goto('/');
  await page.locator('.boot-screen').waitFor();
}
async function desktop(page: Page) {
  await boot(page);
  await page.keyboard.press('Enter');
  await expect(page.locator('.desktop')).toBeVisible();
}
async function run(page: Page, app: string) {
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.locator('.start-menu').getByRole('button', { name: 'Run…', exact: true }).click();
  const field = page.locator('.run-app input');
  await field.fill(app);
  await field.press('Enter');
}
async function command(page: Page, line: string) {
  const field = page.getByRole('textbox', { name: 'Linux command', exact: true });
  await field.fill(line);
  await field.press('Enter');
}

test('normal full boot starts black, progresses through POST and loading, then desktop', async ({
  page,
}, info) => {
  test.skip(
    info.project.name === 'mobile',
    'Same state machine; other boot paths also run on mobile.',
  );
  test.setTimeout(35_000);
  await boot(page);
  await expect(page.locator('[data-system-mode="BOOT"]')).toBeVisible();
  await expect(page.locator('.post-brand')).toHaveCount(0);
  await expect(page.locator('[data-system-mode="BIOS"]')).toBeVisible({ timeout: 4000 });
  await expect(page.locator('.post-diagnostics')).toContainText('Initializing system firmware');
  await expect(page.locator('[data-system-mode="OS_LOADING"]')).toBeVisible({ timeout: 13000 });
  await expect(page.locator('.desktop')).toBeVisible({ timeout: 6000 });
});

test('ESC opens setup, F10 confirms settings, and reboot closes the old session', async ({
  page,
}) => {
  await boot(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-system-mode="BIOS_SETUP"]')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('F10');
  await expect(page.locator('.firmware-modal')).toContainText('Save configuration and reboot?');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-system-mode="SHUTDOWN"]')).toBeVisible();
  await expect(page.locator('[data-system-mode="BOOT"]')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('.desktop')).toBeVisible();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('pc-settings') || '{}').crt),
  ).toBe(false);
});

test('F12 keyboard boot menu launches Linux without a desktop', async ({ page }) => {
  await boot(page);
  await page.keyboard.press('F12');
  await expect(page.locator('[data-system-mode="BOOT_MENU"]')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-system-mode="BIOS"]')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('.linux-terminal')).toBeVisible();
  await expect(page.locator('.desktop')).toHaveCount(0);
  await command(page, 'pwd');
  await expect(page.locator('.linux-output')).toContainText('/home/guest');
});

test('secret Linux boot supports real file commands, pipes, Snake and reboot', async ({ page }) => {
  await boot(page);
  await page.keyboard.press('Control+Alt+t');
  await expect(page.locator('.linux-terminal')).toBeVisible();
  for (const cmd of [
    'ls',
    'cd projects',
    'pwd',
    'cd ..',
    'cat CV.txt',
    'mkdir experiments',
    'echo "first line" > experiments/note.txt',
    'echo "second line" >> experiments/note.txt',
    'cp experiments/note.txt experiments/copy.txt',
    'mv experiments/copy.txt experiments/moved.txt',
    'cat experiments/moved.txt | grep second',
    'neofetch',
  ])
    await command(page, cmd);
  const output = page.locator('.linux-output');
  await expect(output).toContainText('Cybersecurity');
  await expect(output).toContainText('second line');
  await expect(output).toContainText('Kernel: 6.8.0-curiosity');
  await command(page, 'snake');
  await expect(page.locator('.terminal-snake')).toBeVisible();
  await page.locator('.terminal-snake').getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('.snake-board')).toHaveAttribute('data-status', 'running');
  await page.keyboard.press('w');
  await page.keyboard.press('q');
  await expect(page.locator('.linux-input')).toBeVisible();
  await command(page, 'reboot');
  await expect(page.locator('[data-system-mode="SHUTDOWN"]')).toBeVisible();
  await expect(page.locator('[data-system-mode="BOOT"]')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('.desktop')).toBeVisible();
  await expect(page.locator('.linux-terminal')).toHaveCount(0);
});

test('Linux mutations persist across a page refresh and errors do not destroy files', async ({
  page,
}) => {
  await boot(page);
  await page.keyboard.press('Control+Alt+t');
  await command(page, 'echo "keep me" > saved.txt');
  await command(page, 'mkdir -p one/two');
  await command(page, 'cp -r one one/two/recursive');
  await expect(page.locator('.linux-output')).toContainText(
    'Cannot copy or move a directory into itself',
  );
  await page.reload();
  await page.locator('.boot-screen').waitFor();
  await page.keyboard.press('Control+Alt+t');
  await command(page, 'cat saved.txt');
  await expect(page.locator('.linux-output')).toContainText('keep me');
  await command(page, 'rm saved.txt');
  await command(page, 'cat saved.txt');
  await expect(page.locator('.linux-output')).toContainText('No such file or directory');
});

test('drag selection intersects actual desktop icons and Ctrl-click toggles selection', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'mobile', 'Mouse rectangle behavior tested with a mouse.');
  await desktop(page);
  await page.getByRole('button', { name: 'Show desktop', exact: true }).click();
  await page.mouse.move(8, 15);
  await page.mouse.down();
  await page.mouse.move(111, 205, { steps: 10 });
  await expect(page.getByTestId('desktop-selection')).toBeVisible();
  await expect(page.locator('.desktop-icon.selected')).toHaveCount(2);
  await page.mouse.up();
  await expect(page.getByTestId('desktop-selection')).toHaveCount(0);
  await expect(page.locator('.desktop-icon.selected')).toHaveCount(2);
  await page.locator('[data-desktop-id="documents"] button').click({ modifiers: ['Control'] });
  await expect(page.locator('.desktop-icon.selected')).toHaveCount(1);
  await page.mouse.click(700, 100);
  await expect(page.locator('.desktop-icon.selected')).toHaveCount(0);
});

test('desktop group drag moves both selected icons', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'Multi-select drag uses desktop mouse modifiers.');
  await desktop(page);
  await page.getByRole('button', { name: 'Show desktop', exact: true }).click();
  const one = page.locator('[data-desktop-id="documents"]'),
    two = page.locator('[data-desktop-id="internet"]');
  await one.getByRole('button').click();
  await two.getByRole('button').click({ modifiers: ['Control'] });
  const a = (await one.boundingBox())!,
    b = (await two.boundingBox())!;
  await page.mouse.move(a.x + 40, a.y + 30);
  await page.mouse.down();
  await page.mouse.move(a.x + 210, a.y + 55, { steps: 12 });
  await page.mouse.up();
  expect((await one.boundingBox())!.x - a.x).toBeCloseTo(170);
  expect((await two.boundingBox())!.x - b.x).toBeCloseTo(170);
});

test('Shelf uploads real files, edits metadata, reorders, persists, downloads, and deletes', async ({
  page,
}) => {
  await desktop(page);
  await run(page, 'shelf');
  const shelf = page.locator('.shelf-app');
  await shelf.getByRole('button', { name: 'Arrange collection', exact: true }).click();
  await shelf.locator('input[type=file]').setInputFiles([
    {
      name: 'memory.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('A keepsake that survives refresh.'),
    },
    {
      name: 'certificate.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF'),
    },
  ]);
  await expect(shelf.locator('.shelf-slot')).toHaveCount(2);
  await shelf.getByRole('button', { name: 'Edit memory', exact: true }).click();
  await shelf.getByLabel('Name', { exact: true }).fill('First memory');
  await shelf.getByLabel('Description').fill('A tiny story from today.');
  await shelf.getByLabel('Category', { exact: true }).fill('Memories');
  await shelf.getByRole('button', { name: 'Save object' }).click();
  await expect(shelf.locator('.shelf-label').first()).toHaveText('First memory');
  await shelf.getByRole('button', { name: 'Move First memory right' }).click();
  await expect(shelf.locator('.shelf-label').last()).toHaveText('First memory');
  await page.reload();
  await page.locator('.boot-screen').waitFor();
  await page.keyboard.press('Enter');
  await run(page, 'shelf');
  const again = page.locator('.shelf-app');
  await expect(again.locator('.shelf-slot')).toHaveCount(2);
  await again.locator('.shelf-artifact').last().click();
  await expect(again.locator('.shelf-view-content')).toContainText(
    'A keepsake that survives refresh.',
  );
  const download = page.waitForEvent('download');
  await again.getByRole('button', { name: 'Download', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('memory.txt');
  await again.getByRole('button', { name: 'Close item viewer' }).click();
  await again.getByRole('button', { name: 'Arrange collection', exact: true }).click();
  page.once('dialog', (d) => d.accept());
  await again.getByRole('button', { name: 'Delete First memory' }).click();
  await expect(again.locator('.shelf-slot')).toHaveCount(1);
});

test('Shelf image can become a persistent custom wallpaper', async ({ page }) => {
  await desktop(page);
  await run(page, 'shelf');
  const shelf = page.locator('.shelf-app');
  await shelf.getByRole('button', { name: 'Arrange collection', exact: true }).click();
  await shelf.locator('input[type=file]').setInputFiles({
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await shelf.locator('.shelf-artifact').click();
  await shelf.getByRole('button', { name: 'Set as wallpaper' }).click();
  await expect(page.locator('.user-wallpaper')).toBeVisible();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('pc-settings') || '{}').wallpaper),
  ).toBe('custom');
});

test('Snake supports play, pause, restart and a real collision', async ({ page }) => {
  await desktop(page);
  await run(page, 'snake');
  const game = page.locator('.snake-game');
  await game.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(game.locator('.snake-board')).toHaveAttribute('data-status', 'running');
  await game.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(game.locator('.snake-board')).toHaveAttribute('data-status', 'paused');
  await game.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(game.locator('.snake-board')).toHaveAttribute('data-status', 'ready');
  await game.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(game.locator('.snake-board')).toHaveAttribute('data-status', 'over', {
    timeout: 6000,
  });
});

test('Pong moves a real ball, pauses and restarts', async ({ page }) => {
  await desktop(page);
  await run(page, 'pong');
  const game = page.locator('.pong-game');
  const ball = game.locator('.pong-board svg rect').last();
  const before = await ball.getAttribute('x');
  await game.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(game.locator('.pong-board')).toHaveAttribute('data-status', 'running');
  await expect(ball).not.toHaveAttribute('x', before!);
  await game.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(game.locator('.pong-board')).toHaveAttribute('data-status', 'paused');
  const paused = await ball.getAttribute('x');
  await page.waitForTimeout(100);
  await expect(ball).toHaveAttribute('x', paused!);
  await game.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(game.locator('.pong-board')).toHaveAttribute('data-status', 'ready');
  await expect(game.locator('.arcade-score')).toContainText('0 : 0');
});

test('Minesweeper has safe first reveal, flags, counter, timer and restart', async ({
  page,
}, info) => {
  await desktop(page);
  await run(page, 'minesweeper');
  const game = page.locator('.minesweeper-app');
  const cells = game.getByRole('gridcell');
  if (info.project.name === 'mobile') {
    await game.getByRole('button', { name: 'Reveal mode' }).click();
    await cells.nth(80).tap();
    await game.getByRole('button', { name: 'Flag mode' }).click();
  } else await cells.nth(80).click({ button: 'right' });
  await expect(game.getByLabel('Mines remaining')).toHaveText('009');
  await cells.nth(0).click();
  await expect(game.locator('.mine-grid')).toHaveAttribute('data-status', 'running');
  await expect(cells.nth(0)).toHaveAttribute('aria-label', 'Cell 1,1: 0 adjacent mines');
  await expect(game.getByLabel('Minesweeper timer')).not.toHaveText('000', { timeout: 3000 });
  await game.getByRole('button', { name: 'Restart Minesweeper' }).click();
  await expect(game.locator('.mine-grid')).toHaveAttribute('data-status', 'ready');
  await expect(game.getByLabel('Mines remaining')).toHaveText('010');
});

test('Alt-Tab visual switcher, Alt-F4 and Task Manager control real windows', async ({ page }) => {
  await desktop(page);
  await run(page, 'calc');
  await run(page, 'notepad');
  await page.keyboard.down('Alt');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('dialog', { name: 'Application switcher' })).toBeVisible();
  await page.keyboard.up('Alt');
  await expect(page.locator('[data-app="calculator"]')).toHaveClass(/active/);
  await page.keyboard.press('Alt+F4');
  await expect(page.locator('[data-app="calculator"]')).toHaveCount(0);
  await page.keyboard.press('Control+Shift+Escape');
  await expect(page.locator('.task-manager')).toBeVisible();
  await page.locator('.task-manager-list tbody tr').first().click();
  await page.getByRole('button', { name: 'End Task', exact: true }).click();
  await expect(page.locator('.task-manager-list tbody tr')).toHaveCount(
    await page.locator('.os-window:not([data-app="taskmanager"])').count(),
  );
});

test('F5 keeps unsaved notes and browser shortcuts remain available', async ({ page }) => {
  await desktop(page);
  await run(page, 'notepad');
  const editor = page
    .locator('[data-app="notepad"]')
    .last()
    .getByRole('textbox', { name: 'Notepad document' });
  await editor.fill('Do not destroy this unsaved work.');
  await page.keyboard.press('F5');
  await expect(editor).toHaveValue('Do not destroy this unsaved work.');
  const prevented = await page.evaluate(() => {
    const e = new KeyboardEvent('keydown', {
      key: 'l',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(e);
    return e.defaultPrevented;
  });
  expect(prevented).toBe(false);
});

test('Recovery clears temporary files, resets icons, and starts Safe Mode without deleting Shelf', async ({
  page,
}) => {
  await boot(page);
  await page.keyboard.press('Control+Alt+t');
  await command(page, 'echo "temporary" > /tmp/old.txt');
  await command(page, 'reboot');
  await page.locator('[data-system-mode="BOOT"]').waitFor();
  await page.keyboard.press('F12');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('.recovery-screen')).toBeVisible();
  await page.getByRole('button', { name: 'Clear Temporary Data' }).click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('pc-linux-fs-v2') || '{}')['/tmp/old.txt'],
    ),
  ).toBeUndefined();
  await page.getByRole('button', { name: 'Reset Desktop', exact: true }).click();
  await page.getByRole('button', { name: 'Safe Mode', exact: true }).click();
  await page.keyboard.press('Enter');
  await expect(page.locator('.safe-mode-label')).toBeVisible();
  await expect(page.locator('.computer-screen')).not.toHaveClass(/crt-enabled/);
});

test('Snake engine implements eating, growth, reversal guard, and collision', () => {
  let s = { ...newSnake(), status: 'running' as const, food: { x: 11, y: 8 } };
  const ate = stepSnake(s, () => 0);
  expect(ate.score).toBe(10);
  expect(ate.body).toHaveLength(4);
  expect(turnSnake(s, 'left').nextDirection).toBe('right');
  expect(
    stepSnake({
      ...s,
      body: [
        { x: 21, y: 8 },
        { x: 20, y: 8 },
      ],
      food: { x: 0, y: 0 },
    }).status,
  ).toBe('over');
  expect(ate.food).not.toEqual(ate.body[0]);
});

test('Minesweeper engine guarantees first-click safety and correct neighboring counts', () => {
  const board = seedMines(40, undefined, () => 0.42);
  expect(board.filter((c) => c.mine)).toHaveLength(MINE_COUNT);
  for (const i of [40, ...neighbors(40)]) expect(board[i].mine).toBe(false);
  board.forEach((cell, i) =>
    expect(cell.count).toBe(neighbors(i).filter((n) => board[n].mine).length),
  );
  const revealed = revealMine(board, 40);
  expect(revealed.filter((c) => c.revealed).length).toBeGreaterThan(1);
  expect(revealed.some((c) => c.revealed && c.mine)).toBe(false);
});

test('game context menu creates a working desktop shortcut', async ({ page }) => {
  await desktop(page);
  await run(page, 'games');
  await page.locator('.game-snake').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Create desktop shortcut', exact: true }).click();
  await page.getByRole('button', { name: 'Show desktop', exact: true }).click();
  const shortcut = page
    .locator('.desktop-icon')
    .filter({ has: page.getByRole('button', { name: 'Snake', exact: true }) });
  await expect(shortcut).toBeVisible();
  await shortcut.getByRole('button').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.snake-game')).toBeVisible();
});

test('file drag, desktop copy/cut/paste, recycle and restore persist actual locations', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'mobile', 'Native mouse drag and keyboard clipboard workflow.');
  await desktop(page);
  await page.locator('[data-desktop-id="documents"] button').dblclick();
  const explorer = page.locator('.os-window.active');
  const source = explorer.locator('[data-file-id="cv"]');
  await expect(source).toBeVisible();
  await source.dragTo(page.locator('.desktop-surface'), { targetPosition: { x: 220, y: 60 } });
  const icon = page.locator('[data-desktop-id="cv"]');
  await expect(icon).toBeVisible();
  await icon.getByRole('button').click();
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await expect(
    page.locator('.desktop-icon button').filter({ hasText: 'CV.txt - Copy' }),
  ).toHaveCount(1);
  await icon.getByRole('button').click();
  await page.keyboard.press('Delete');
  await expect(icon).toHaveCount(0);
  await page.locator('[data-desktop-id="recycle"] button').dblclick();
  const recycled = page.locator('.os-window.active [data-file-id="cv"]');
  await recycled.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Restore', exact: true }).click();
  await expect(icon).toBeVisible();
  await icon.getByRole('button').click();
  await page.keyboard.press('Control+x');
  await page.locator('[data-desktop-id="documents"] button').dblclick();
  await page.locator('.os-window.active .title-bar').click();
  await page.keyboard.press('Control+v');
  await expect(icon).toHaveCount(0);
  await expect(page.locator('.os-window.active [data-file-id="cv"]')).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('pc-files-v2') || '[]').find(
          (f: { id: string }) => f.id === 'cv',
        ).parent,
    ),
  ).toBe('documents');
  const copy = page
    .locator('.desktop-icon')
    .filter({ has: page.getByRole('button', { name: 'CV.txt - Copy', exact: true }) });
  const from = (await copy.boundingBox())!;
  const to = (await page
    .locator('.os-window.active [data-folder-drop="documents"]')
    .first()
    .boundingBox())!;
  await page.mouse.move(from.x + 35, from.y + 30);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width - 30, to.y + to.height - 30, { steps: 15 });
  await page.mouse.up();
  await expect(copy).toHaveCount(0);
  await expect(
    page.locator('.os-window.active .file-item').filter({ hasText: 'CV.txt - Copy' }),
  ).toHaveCount(1);
});

test('Minesweeper reaches both loss and victory with a reproducible board', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.42;
  });
  await desktop(page);
  await run(page, 'minesweeper');
  const cells = page.getByRole('gridcell');
  const board = seedMines(0, undefined, () => 0.42);
  await cells.nth(0).click();
  await cells.nth(board.findIndex((c) => c.mine)).click();
  await expect(page.locator('.mine-grid')).toHaveAttribute('data-status', 'lost');
  await page.getByRole('button', { name: 'Restart Minesweeper' }).click();
  await cells.nth(0).click();
  for (let i = 0; i < board.length; i++)
    if (!board[i].mine && (await cells.nth(i).getAttribute('aria-label'))?.endsWith('covered'))
      await cells.nth(i).click();
  await expect(page.locator('.mine-grid')).toHaveAttribute('data-status', 'won');
  await expect(page.getByLabel('Mines remaining')).toHaveText('000');
});

test('desktop context menu supports keyboard submenus and stays on screen', async ({ page }) => {
  await desktop(page);
  await page.getByRole('button', { name: 'Show desktop', exact: true }).click();
  const viewport = page.viewportSize()!;
  await page
    .locator('.desktop-surface')
    .click({ button: 'right', position: { x: viewport.width - 10, y: viewport.height - 100 } });
  const menu = page.locator('.enhanced-context');
  await expect(menu).toBeVisible();
  const bounds = (await menu.boundingBox())!;
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.enhanced-submenu')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('.desktop-icon').filter({ hasText: 'New Document.txt' })).toHaveCount(
    1,
  );
});
