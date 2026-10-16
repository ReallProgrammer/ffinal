import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { desktop, runApp, terminalCommand } from './helpers/entry';
const credentials = () => JSON.parse(readFileSync(process.env.LIBRARY_TEST_CREDENTIALS!, 'utf8'));
test('terminal flag hunt unlocks the portfolio shell before UIstart and survives refresh', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('.boot-screen').waitFor();
  await page.keyboard.press('Enter');
  const terminal = page.locator('.linux-terminal'),
    output = page.locator('.linux-output');
  await expect(terminal).toHaveAttribute('data-entry-phase', 'locked');
  await expect(page.locator('.desktop')).toHaveCount(0);
  await terminalCommand(page, 'UIstart');
  await expect(output).toContainText('UI locked');
  await terminalCommand(page, '-flag wrong');
  await expect(output).toContainText('Flag not accepted');
  for (const command of [
    'ls',
    'cat README.txt',
    'cd training',
    'cat briefing.txt',
    'cd archive',
    'ls -a',
    'cd .cache',
    'cat ctf.txt',
  ])
    await terminalCommand(page, command);
  await expect(output).toContainText('FLAG{follow_the_trail}');
  await terminalCommand(page, '-flag FLAG{follow_the_trail}');
  await expect(terminal).toHaveAttribute('data-entry-phase', 'unlocked');
  await expect(output).toContainText('Type UIstart');
  await expect(page.locator('.desktop')).toHaveCount(0);
  await terminalCommand(page, 'cat CV.txt');
  await expect(output).toContainText('Cybersecurity');
  await terminalCommand(page, 'UIstart');
  await expect(page.locator('.xp-logon')).toBeVisible();
  await page.locator('.xp-logon').getByRole('button', { name: 'Guest', exact: false }).click();
  await expect(page.locator('.desktop')).toBeVisible();
  await page.reload();
  await page.locator('.boot-screen').waitFor();
  await page.keyboard.press('Enter');
  await expect(page.locator('.desktop')).toBeVisible();
  await expect(terminal).toHaveCount(0);
});
test('tray widgets replace one another and desktop selection stays below windows', async ({
  page,
}, info) => {
  await desktop(page);
  for (const name of ['Volume settings', 'Connection status', 'Date and time', 'Volume settings']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.tray-popup')).toHaveCount(1);
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('.tray-popup')).toHaveCount(0);
  if (info.project.name === 'desktop') {
    const win = page.locator('[data-app="explorer"]').first();
    const box = (await win.boundingBox())!;
    await page.mouse.move(1100, 30);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
    await expect(page.locator('.desktop-selection')).toBeVisible();
    expect(
      await page.evaluate(
        ({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('.os-window')),
        { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      ),
    ).toBe(true);
    await page.mouse.up();
    await expect(page.locator('.desktop-selection')).toHaveCount(0);
  }
});
test('suspicious link cycles a labelled harmless simulation and can be dismissed', async ({
  page,
}) => {
  await desktop(page);
  await runApp(page, 'browser');
  await page.getByRole('button', { name: 'Get Aurora Screensaver', exact: false }).click();
  await expect(page.locator('.trojan-simulation')).toContainText('AURORA');
  await expect(page.locator('.trojan-simulation')).toContainText('All clear', { timeout: 12000 });
  await page.getByRole('button', { name: 'Replay sequence' }).click();
  await expect(page.locator('.trojan-simulation')).toContainText('Connecting');
  await page.keyboard.press('Escape');
  await expect(page.locator('.trojan-simulation')).toHaveCount(0);
});
test('chess bot responds legally at each difficulty and retains the game', async ({ page }) => {
  await desktop(page);
  await runApp(page, 'chess');
  const app = page.locator('.chess-app');
  for (const difficulty of ['beginner', 'casual', 'club']) {
    await app.getByLabel('Bot difficulty').selectOption(difficulty);
    await app.getByRole('button', { name: 'New game', exact: true }).click();
    await app.getByRole('button', { name: 'e2 white pawn', exact: true }).click();
    await app.getByRole('button', { name: 'e4 legal move', exact: true }).click();
    await expect(app.locator('.chess-status')).toHaveText('White to move', { timeout: 10000 });
    await expect(app.getByRole('button', { name: 'e4 white pawn', exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem('pc-chess-bot') || '""')),
    ).toMatch(/1\. e4 \S+/);
  }
  await page.screenshot({ path: '/tmp/os-chess-' + test.info().project.name + '.png' });
  await desktop(page);
  await runApp(page, 'chess');
  await expect(
    page.locator('.chess-app').getByRole('button', { name: 'e4 white pawn', exact: true }),
  ).toBeVisible();
});
test('owner dashboard joins a visitor and both boards exchange moves', async ({
  page,
  browser,
}, info) => {
  test.skip(
    !process.env.LIBRARY_TEST_CREDENTIALS || info.project.name === 'mobile',
    'Real local owner credentials and two desktop participants required',
  );
  test.setTimeout(60000);
  const other = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const owner = await other.newPage();
  try {
    await desktop(page);
    await runApp(page, 'chess');
    await page.getByRole('button', { name: 'Play the owner', exact: true }).click();
    const nickname = 'Browser visitor ' + Date.now();
    await page.getByLabel('Your display name').fill(nickname);
    await page.getByRole('button', { name: 'Request a match', exact: true }).click();
    await expect(page.locator('.chess-status')).toContainText('Waiting for the owner');
    await desktop(owner, '/?chess=owner');
    const auth = credentials();
    await owner.getByLabel('Owner email').fill(auth.email);
    await owner.getByLabel('Password', { exact: true }).fill(auth.password);
    await owner.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(owner.locator('.chess-alert-status')).toContainText('Phone alerts');
    await expect(owner.getByText(nickname, { exact: true })).toBeVisible();
    await owner
      .locator('.chess-dashboard article')
      .filter({ hasText: nickname })
      .getByRole('button', { name: 'Join match' })
      .click();
    await expect(page.locator('.chess-status')).toHaveText('White to move', { timeout: 10000 });
    await page.getByRole('button', { name: 'e2 white pawn', exact: true }).click();
    await page.getByRole('button', { name: 'e4 legal move', exact: true }).click();
    await expect(owner.locator('.chess-status')).toHaveText('Black to move', { timeout: 10000 });
    await owner.getByRole('button', { name: 'e7 black pawn', exact: true }).click();
    await owner.getByRole('button', { name: 'e5 legal move', exact: true }).click();
    await expect(page.getByRole('button', { name: 'e5 black pawn', exact: true })).toBeVisible({
      timeout: 10000,
    });
    await owner.getByRole('button', { name: 'Resign match' }).click();
    await expect(page.locator('.chess-status')).toContainText('Visitor wins by resignation', {
      timeout: 10000,
    });
  } finally {
    await other.close();
  }
});
test('MP3 and MP4 play locally and persist after reloading', async ({ page }) => {
  await desktop(page);
  await runApp(page, 'media');
  const app = page.locator('.media-player');
  await app.getByRole('button', { name: 'On this device' }).click();
  await app
    .getByLabel('Add MP3 / MP4 files')
    .setInputFiles(['tests/fixtures/tone.mp3', 'tests/fixtures/film.mp4']);
  await expect(app.locator('.media-playlist li')).toHaveCount(2);
  for (const [name, tag] of [
    ['tone', 'audio'],
    ['film', 'video'],
  ]) {
    await app.locator('.media-playlist').getByRole('button', { name, exact: true }).click();
    const element = app.locator(tag);
    await expect(element).toBeVisible();
    await expect
      .poll(() => element.evaluate((e: HTMLMediaElement) => e.readyState))
      .toBeGreaterThanOrEqual(1);
    await element.evaluate((e: HTMLMediaElement) => e.play());
    await expect
      .poll(() => element.evaluate((e: HTMLMediaElement) => e.currentTime))
      .toBeGreaterThan(0.1);
    await element.evaluate((e: HTMLMediaElement) => {
      e.pause();
      e.currentTime = 2;
    });
    await expect
      .poll(() => element.evaluate((e: HTMLMediaElement) => e.currentTime))
      .toBeGreaterThanOrEqual(1.9);
  }
  await page.screenshot({ path: '/tmp/os-media-' + test.info().project.name + '.png' });
  await desktop(page);
  await runApp(page, 'media');
  await app.getByRole('button', { name: 'On this device' }).click();
  await expect(app.locator('.media-playlist li')).toHaveCount(2);
  await app.getByRole('button', { name: 'Delete tone', exact: true }).click();
  await expect(app.locator('.media-playlist li')).toHaveCount(1);
});

test('owner uploads and publishes playable media without exposing the private draft', async ({
  page,
  request,
}, info) => {
  test.skip(
    !process.env.LIBRARY_TEST_CREDENTIALS || info.project.name === 'mobile',
    'Owner upload integration runs on desktop',
  );
  const api = process.env.LIBRARY_TEST_API || 'http://127.0.0.1:8787/api/v1';
  let id = '',
    auth = '';
  const title = 'Browser media ' + Date.now();
  try {
    await desktop(page);
    await runApp(page, 'media');
    const app = page.locator('.media-player');
    await app.getByRole('button', { name: 'Manage library' }).click();
    const owner = credentials();
    await app.getByLabel('Owner email').fill(owner.email);
    await app.getByLabel('Password', { exact: true }).fill(owner.password);
    const login = page.waitForResponse(
      (r) => r.url().endsWith('/session') && r.request().method() === 'POST',
    );
    await app.getByRole('button', { name: 'Sign in', exact: true }).click();
    auth = 'Bearer ' + (await (await login).json()).token;
    await app.getByLabel('Media title', { exact: true }).fill(title);
    const uploaded = page.waitForResponse((r) => r.url().endsWith('/admin/media/uploads'));
    await app.getByLabel('Upload shared media').setInputFiles('tests/fixtures/film.mp4');
    const response = await uploaded;
    expect(response.status()).toBe(201);
    id = (await response.json()).id;
    expect((await request.get(api + '/media/' + id + '/content')).status()).toBe(404);
    const row = app.locator('.media-playlist li').filter({ hasText: title });
    await expect(row).toContainText('Private');
    await row.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(row).toContainText('Published');
    await app.getByRole('button', { name: 'Shared library', exact: true }).click();
    await app.locator('.media-playlist').getByRole('button', { name: title, exact: true }).click();
    await expect
      .poll(() => app.locator('video').evaluate((v: HTMLVideoElement) => v.readyState))
      .toBeGreaterThanOrEqual(1);
    await app.locator('video').evaluate((v: HTMLVideoElement) => v.play());
    await expect
      .poll(() => app.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime))
      .toBeGreaterThan(0.1);
    expect(
      (
        await request.get(api + '/media/' + id + '/content', { headers: { Range: 'bytes=0-99' } })
      ).status(),
    ).toBe(206);
  } finally {
    if (id && auth)
      await request.delete(api + '/admin/media/' + id, { headers: { Authorization: auth } });
    if (auth) await request.delete(api + '/session', { headers: { Authorization: auth } });
  }
});
