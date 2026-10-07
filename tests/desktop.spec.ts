import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
async function desktop(page: Page) {
  await page.goto('/');
  await page.keyboard.press('Enter');
  await expect(page.locator('.desktop')).toBeVisible();
}
async function startApp(page: Page, name: string) {
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.locator('.start-menu').getByRole('button', { name, exact: false }).first().click();
}
async function run(page: Page, cmd: string) {
  await startApp(page, 'Run…');
  const input = page.locator('.run-app input');
  await input.fill(cmd);
  await input.press('Enter');
}

test('boot progressively appears and skips into the desktop', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.boot-screen')).toBeVisible();
  await expect(page.getByText('PERSONAL COMPUTER BIOS v2.04')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-app="explorer"]')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'A little curiosity. A lot of possibility.' }),
  ).toBeVisible();
});

test('explorer navigates folders, history, and opens actual documents', async ({ page }, info) => {
  await desktop(page);
  const explorer = page.locator('[data-app="explorer"]').first();
  const folder = explorer.locator('.file-item').filter({ hasText: 'My Documents' });
  if (info.project.name === 'mobile') await folder.tap();
  else await folder.dblclick();
  await expect(explorer.locator('.folder-heading')).toContainText('My Documents');
  await explorer.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(explorer.locator('.welcome-hero')).toBeVisible();
  await explorer.getByRole('button', { name: 'Forward', exact: true }).click();
  await expect(explorer.locator('.folder-heading')).toContainText('My Documents');
  const cv = explorer.locator('.file-item').filter({ hasText: 'CV.txt' });
  if (info.project.name === 'mobile') await cv.tap();
  else await cv.dblclick();
  await expect(
    page.locator('[data-app="notepad"]').last().getByRole('textbox', { name: 'Notepad document' }),
  ).toContainText('Cybersecurity');
});

test('notepad editing saves locally and downloads a copy', async ({ page }) => {
  await desktop(page);
  await run(page, 'notepad');
  const note = page.locator('[data-app="notepad"]').last();
  const editor = note.getByRole('textbox', { name: 'Notepad document' });
  await editor.fill('A meaningful saved note.\nSecond line.');
  await editor.press('Control+s');
  await expect(note.locator('.title-bar')).not.toContainText('*');
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('pc-notes') || '{}')['Untitled.txt']),
  ).toBe('A meaningful saved note.\nSecond line.');
  await note.getByRole('menuitem', { name: 'File', exact: true }).click();
  await note.getByRole('menuitem', { name: 'Save As…' }).click();
  await note.locator('.app-modal input').fill('my-note.txt');
  const download = page.waitForEvent('download');
  await note.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('my-note.txt');
  await expect(note.locator('.title-bar')).toContainText('my-note.txt');
});

test('calculator supports keyboard arithmetic, decimals, and zero division', async ({ page }) => {
  await desktop(page);
  await run(page, 'calc');
  const calc = page.locator('[data-app="calculator"]');
  await page.keyboard.type('12.5*4');
  await page.keyboard.press('Enter');
  await expect(calc.locator('output')).toHaveText('50');
  await page.keyboard.press('Escape');
  await page.keyboard.type('9/0');
  await page.keyboard.press('Enter');
  await expect(calc.locator('output')).toHaveText('Error');
  await calc.getByRole('button', { name: 'C', exact: true }).click();
  await page.keyboard.type('7+8-3');
  await page.keyboard.press('Enter');
  await expect(calc.locator('output')).toHaveText('12');
});

test('command prompt implements filesystem, history, errors, and recovery', async ({ page }) => {
  await desktop(page);
  await run(page, 'cmd');
  const cmd = page.getByRole('textbox', { name: 'Command prompt input' });
  for (const command of ['whoami', 'cd documents', 'dir', 'type Contact.txt']) {
    await cmd.fill(command);
    await cmd.press('Enter');
  }
  await expect(page.locator('.terminal-output')).toContainText('Real Otaku');
  await expect(page.locator('.terminal-output')).toContainText('Contact.txt');
  await expect(page.locator('.terminal-output')).toContainText(
    'https://github.com/ReallProgrammer',
  );
  await cmd.fill('unknown-command');
  await cmd.press('Enter');
  await expect(page.locator('.terminal-output')).toContainText('is not recognized');
  await cmd.press('ArrowUp');
  await expect(cmd).toHaveValue('unknown-command');
  await cmd.fill('bsod');
  await cmd.press('Enter');
  await expect(page.locator('.bsod')).toBeVisible();
  await page.getByRole('button', { name: 'Press ESC or click here to return' }).click();
  await expect(page.locator('.desktop')).toBeVisible();
  await expect(page.locator('.terminal')).toBeVisible();
});

test('browser has working local pages, back, forward, and external links', async ({ page }) => {
  await desktop(page);
  await run(page, 'browser');
  const browser = page.locator('[data-app="browser"]');
  await browser
    .locator('.site-header')
    .getByRole('button', { name: 'Projects', exact: true })
    .click();
  await expect(browser.getByRole('heading', { name: 'The things I make.' })).toBeVisible();
  await expect(browser.getByRole('link', { name: 'View source' })).toHaveAttribute(
    'href',
    'https://github.com/ReallProgrammer/ffinal',
  );
  await browser.getByRole('button', { name: 'Browser back', exact: true }).click();
  await expect(browser.getByRole('heading', { name: 'Built on curiosity.' })).toBeVisible();
  await browser.getByRole('button', { name: 'Browser forward', exact: true }).click();
  await expect(browser.getByRole('heading', { name: 'The things I make.' })).toBeVisible();
  const address = browser.getByRole('textbox');
  await address.fill('portfolio://contact');
  await address.press('Enter');
  await expect(browser.getByRole('heading', { name: 'Let’s make a connection.' })).toBeVisible();
});

test('window focus, minimize, maximize, restore, and close', async ({ page }) => {
  await desktop(page);
  await run(page, 'calc');
  const calc = page.locator('[data-app="calculator"]');
  await calc.getByRole('button', { name: 'Maximize Calculator', exact: true }).click();
  await expect(calc).toHaveClass(/maximized/);
  await calc.getByRole('button', { name: 'Restore Calculator', exact: true }).click();
  await expect(calc).not.toHaveClass(/maximized/);
  await calc.getByRole('button', { name: 'Minimize Calculator', exact: true }).click();
  await expect(calc).toBeHidden();
  await page.getByRole('button', { name: 'Taskbar: Calculator', exact: true }).click();
  await expect(calc).toBeVisible();
  await calc.getByRole('button', { name: 'Close Calculator', exact: true }).click();
  await expect(calc).toHaveCount(0);
});

test('settings persist and can skip boot on subsequent visits', async ({ page }) => {
  await desktop(page);
  await run(page, 'control');
  const settings = page.locator('[data-app="settings"]');
  await settings.getByRole('button', { name: 'After hours' }).click();
  await settings.getByLabel('That old monitor feeling').uncheck();
  await settings.getByLabel('Take the scenic route? Maybe next time.').check();
  await page.reload();
  await expect(page.locator('.desktop')).toBeVisible();
  await expect(page.locator('.wallpaper')).toHaveClass(/night/);
  await expect(page.locator('.computer-screen')).not.toHaveClass(/crt-enabled/);
  await expect(page.locator('.boot-screen')).toHaveCount(0);
});

test('search finds content and opens a result', async ({ page }) => {
  await desktop(page);
  await run(page, 'search');
  await page.getByRole('textbox', { name: 'Search files' }).fill('Skills');
  const search = page.locator('[data-app="search"]');
  await search.locator('.search-results').getByRole('button', { name: 'Skills.txt' }).click();
  await expect(page.locator('[data-app="notepad"]').last().getByRole('textbox')).toContainText(
    'MY TOOLBOX',
  );
});

test('hidden memory game matches pairs and restarts', async ({ page }) => {
  await desktop(page);
  await run(page, 'game');
  const cards = page.locator('.memory-grid button');
  await expect(cards).toHaveCount(16);
  await cards.nth(0).click();
  await cards.nth(1).click();
  await expect(page.locator('.game-score')).toContainText('1 moves');
  await expect(cards.nth(2)).toBeEnabled();
  await page.getByRole('button', { name: 'New game', exact: true }).click();
  await expect(page.locator('.game-score')).toContainText('0 moves');
  await expect(page.locator('.memory-grid .flipped')).toHaveCount(0);
});

test('no uncaught app errors or horizontal document overflow', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await desktop(page);
  for (const app of ['notepad', 'calc', 'browser', 'cmd', 'control', 'search', 'game'])
    await run(page, app);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/${info.project.name}-applications.png` });
});

test('desktop windows drag and resize', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'Mobile uses full-size touch-friendly windows.');
  await desktop(page);
  const explorer = page.locator('[data-app="explorer"]');
  const before = (await explorer.boundingBox())!;
  await page.mouse.move(before.x + 180, before.y + 15);
  await page.mouse.down();
  await page.mouse.move(before.x + 250, before.y + 65, { steps: 8 });
  await page.mouse.up();
  const after = (await explorer.boundingBox())!;
  expect(after.x - before.x).toBeCloseTo(70);
  expect(after.y - before.y).toBeCloseTo(50);
  const resize = await explorer.locator('.resize-se').boundingBox();
  await page.mouse.move(resize!.x + 5, resize!.y + 5);
  await page.mouse.down();
  await page.mouse.move(resize!.x + 55, resize!.y + 35, { steps: 8 });
  await page.mouse.up();
  const resized = (await explorer.boundingBox())!;
  expect(resized.width).toBeGreaterThan(after.width);
  expect(resized.height).toBeGreaterThan(after.height);
});

test('Start dismisses outside and supports keyboard navigation', async ({ page }) => {
  await desktop(page);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Start menu' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Start menu' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-app="notepad"]').last()).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Start menu' })).toHaveCount(0);
});

test('desktop icons can be renamed and repositioned', async ({ page }, info) => {
  test.skip(
    info.project.name === 'mobile',
    'Pointer-specific drag; touch opening is covered by Explorer tests.',
  );
  await desktop(page);
  const icon = page.locator('.desktop-icon').first();
  await icon.getByRole('button').click({ button: 'right' });
  await page.locator('.context-menu').getByRole('button', { name: 'Rename', exact: true }).click();
  await page.getByRole('textbox', { name: 'Rename desktop icon' }).fill('My Little Computer');
  await page.keyboard.press('Enter');
  await expect(icon).toContainText('My Little Computer');
  const bounds = (await icon.boundingBox())!;
  await page.mouse.move(bounds.x + 30, bounds.y + 30);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 110, bounds.y + 60, { steps: 10 });
  await page.mouse.up();
  const moved = (await icon.boundingBox())!;
  expect(moved.x - bounds.x).toBeCloseTo(80);
  expect(moved.y - bounds.y).toBeCloseTo(30);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('pc-icon-labels') || '{}').computer),
  ).toBe('My Little Computer');
});

test('simulated errors dismiss without breaking the app', async ({ page }) => {
  await desktop(page);
  await run(page, 'cmd');
  const input = page.getByRole('textbox', { name: 'Command prompt input' });
  await input.fill('error');
  await input.press('Enter');
  const dialog = page.locator('[data-app="dialog"]');
  await expect(dialog).toContainText('unexpectedly delightful operation');
  await dialog.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.terminal')).toBeVisible();
});

test('shutdown and power-on preserve saved settings', async ({ page }) => {
  await desktop(page);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Turn Off Computer', exact: true }).click();
  await page
    .locator('.power-dialog')
    .getByRole('button', { name: 'Turn Off', exact: true })
    .click();
  await expect(page.locator('.off-screen')).toBeVisible();
  await page.getByRole('button', { name: 'Power on', exact: true }).click();
  await expect(page.locator('.boot-screen')).toBeVisible();
  await page.locator('.boot-screen button').first().click();
  await expect(page.locator('.desktop')).toBeVisible();
});
