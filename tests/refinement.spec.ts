import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test('owner saves wrap art, layers, interior files and exact placement; visitors inspect a hinged case', async ({
  page,
  context,
}, info) => {
  test.skip(!process.env.LIBRARY_TEST_CREDENTIALS, 'Real local backend required');
  test.setTimeout(240000);
  const base = process.env.LIBRARY_TEST_API || 'http://127.0.0.1:8787/api/v1',
    credentials = JSON.parse(await readFile(process.env.LIBRARY_TEST_CREDENTIALS!, 'utf8'));
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let headers: Record<string, string> = {},
    id = '',
    shelf = '',
    shelf2 = '';
  const assetIds: string[] = [];
  const name = 'Refined case ' + info.project.name + '-' + Date.now();
  try {
    await page.goto('/');
    await page.locator('.boot-screen').waitFor();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.locator('.start-menu').getByRole('button', { name: 'Run…', exact: true }).click();
    await page.locator('.run-app input').fill('shelf');
    await page.locator('.run-app input').press('Enter');
    await page.getByRole('button', { name: 'Owner access', exact: true }).click();
    await page.getByLabel('Owner email', { exact: true }).fill(credentials.email);
    await page.getByLabel('Password', { exact: true }).fill(credentials.password);
    const login = page.waitForResponse(
      (r) => r.url() === base + '/session' && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    headers = { Authorization: 'Bearer ' + (await (await login).json()).token };
    for (const suffix of [' A', ' B']) {
      await page.getByLabel('Shelf name', { exact: true }).fill(name + suffix);
      await page.getByRole('button', { name: 'Add shelf', exact: true }).click();
      await expect(page.locator('.collection-organizer')).toContainText(name + suffix);
    }
    const initial = await (
      await context.request.get(base + '/admin/collection', { headers })
    ).json();
    shelf = initial.shelves.find((s: any) => s.name === name + ' A').id;
    shelf2 = initial.shelves.find((s: any) => s.name === name + ' B').id;
    await page.getByRole('button', { name: '＋ Add to Collection', exact: true }).click();
    await page
      .locator('.collection-type-grid')
      .getByRole('button', { name: /^PlayStation 5 game/ })
      .click();
    await page.getByLabel('Title', { exact: true }).fill(name);
    await page.getByLabel('Shelf', { exact: true }).selectOption(shelf);
    await page
      .getByLabel('Upload full wrap', { exact: true })
      .setInputFiles('/tmp/library-fixtures/cover.png');
    await expect(
      page.getByRole('button', { name: 'Confirm split & apply surfaces' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Confirm split & apply surfaces' }).click();
    await expect(
      page
        .locator('.library-upload')
        .filter({ has: page.getByLabel('Upload front', { exact: true }) }),
    ).toContainText('front —');
    await page
      .getByLabel('Upload disc', { exact: true })
      .setInputFiles('/tmp/library-fixtures/revised.png');
    await expect(
      page
        .locator('.library-upload')
        .filter({ has: page.getByLabel('Upload disc', { exact: true }) }),
    ).toContainText('Ready');
    await page
      .getByLabel('Upload manual', { exact: true })
      .setInputFiles('/tmp/library-fixtures/four-pages.pdf');
    await expect(
      page
        .locator('.library-upload')
        .filter({ has: page.getByLabel('Upload manual', { exact: true }) }),
    ).toContainText('Ready');
    await page.getByLabel('Reading access').selectOption('public');
    await page.getByRole('button', { name: 'Add text', exact: true }).click();
    await page.getByLabel('Layer text', { exact: true }).fill('COLLECTOR');
    await page.getByLabel('rotation', { exact: true }).fill('12');
    await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
    await page.getByRole('button', { name: 'Delete layer', exact: true }).click();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.locator('.cover-layer')).toHaveCount(2);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(page.locator('.cover-layer')).toHaveCount(1);
    if (info.project.name === 'desktop') {
      const layer = page.locator('.cover-layer').first();
      await layer.scrollIntoViewIfNeeded();
      const b = (await layer.boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2 + 25, b.y + b.height / 2 + 10, { steps: 5 });
      await page.mouse.up();
      await page.getByRole('button', { name: 'Undo', exact: true }).click();
    }
    await page.getByLabel('Tags (comma separated)').fill('games, collection');
    await page.getByLabel('Published — visible to visitors').check();
    await page.screenshot({
      path: `/workspace/artifacts/refinement-${info.project.name}-editor.png`,
    });
    await page.getByRole('button', { name: 'Save & publish', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit ' + name, exact: true })).toBeVisible({
      timeout: 20000,
    });
    const saved = await (await context.request.get(base + '/admin/collection', { headers })).json();
    const item = saved.books.find((b: any) => b.title === name);
    expect(item.layers.front).toHaveLength(1);
    expect(item.layers.front[0].text).toBe('COLLECTOR');
    expect(item.tags).toEqual(['games', 'collection']);
    expect(item.artwork.manual).toBeTruthy();
    id = item.id;
    for (const a of [item.front, item.spine, item.back, ...Object.values(item.artwork)] as any[])
      if (a) assetIds.push(a.id);
    // Cancel keyboard pickup; verify pointer placement separately on desktop.
    const handle = page.getByRole('button', { name: 'Drag ' + name, exact: true });
    await handle.focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Escape');
    await expect(page.locator('.collection-drag-overlay')).toHaveCount(0);
    if (info.project.name === 'desktop') {
      const drop = page.getByText('Drop at end of ' + name + ' B', { exact: true });
      await drop.scrollIntoViewIfNeeded();
      const a = (await handle.boundingBox())!,
        b = (await drop.boundingBox())!;
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 15 });
      await page.mouse.up();
      await expect
        .poll(async () => {
          const d = await (
            await context.request.get(base + '/admin/collection', { headers })
          ).json();
          return d.books.find((v: any) => v.id === id).shelfId;
        })
        .toBe(shelf2);
    }
    await page.getByRole('button', { name: 'Edit ' + name, exact: true }).click();
    await page.getByLabel('Shelf', { exact: true }).selectOption(shelf2);
    await page.getByLabel('Insertion position', { exact: true }).selectOption('');
    await page.getByRole('button', { name: 'Save & publish', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit ' + name, exact: true })).toBeVisible();
    expect(
      (
        await (await context.request.get(base + '/admin/collection', { headers })).json()
      ).books.find((b: any) => b.id === id).shelfId,
    ).toBe(shelf2);
    await page.getByRole('button', { name: 'Public collection', exact: true }).click();
    await page
      .getByRole('navigation', { name: 'Collection categories' })
      .getByRole('button', { name: 'Games', exact: true })
      .click();
    await expect(page.getByRole('button', { name: 'Index', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Collection sound volume')).toHaveCount(0);
    await page.getByLabel('Search collection').fill(name);
    await page
      .locator('.library-index')
      .getByRole('button', { name: new RegExp('^' + name) })
      .click();
    await expect(page.locator('.library-book-details')).toHaveAttribute(
      'data-artwork-ready',
      'true',
      { timeout: 30000 },
    );
    await page.getByRole('button', { name: 'Open case', exact: true }).click();
    await page.waitForTimeout(900);
    await page.screenshot({
      path: `/workspace/artifacts/refinement-${info.project.name}-open-case.png`,
    });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Open case', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'View flat artwork', exact: true }).click();
    const zoom = page.locator('.artwork-viewer .zoom-surface');
    const box = (await zoom.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.4);
    await page.mouse.wheel(0, -500);
    await expect(page.locator('.artwork-viewer .zoom-tools')).not.toContainText('100%');
    await page.getByRole('button', { name: 'Reset zoom', exact: true }).click();
    await expect(page.locator('.artwork-viewer .zoom-tools')).toContainText('100%');
    await page.getByRole('button', { name: 'Close artwork', exact: true }).click();
    await page.getByRole('button', { name: 'Read manual', exact: true }).click();
    await expect(page.locator('.pdf-reader')).toBeVisible();
    await page.getByRole('button', { name: 'Open document cover', exact: true }).click();
    await expect(page.getByRole('img', { name: 'Document page 1', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close reader', exact: true }).click();
    await page.getByRole('button', { name: 'Return to shelf', exact: true }).click();
    expect(errors).toEqual([]);
  } finally {
    if (id) await context.request.delete(base + '/admin/items/' + id, { headers });
    for (const s of [shelf, shelf2])
      if (s) await context.request.delete(base + '/admin/shelves/' + s, { headers });
    for (const a of assetIds)
      await context.request.delete(base + '/admin/assets/' + a, { headers });
    if (headers.Authorization) await context.request.delete(base + '/session', { headers });
  }
});

test('visitors combine and remove independent genre filters', async ({ page, context }, info) => {
  test.skip(!process.env.LIBRARY_TEST_CREDENTIALS, 'Real local backend required');
  test.setTimeout(90000);
  const base = process.env.LIBRARY_TEST_API || 'http://127.0.0.1:8787/api/v1';
  const credentials = JSON.parse(await readFile(process.env.LIBRARY_TEST_CREDENTIALS!, 'utf8'));
  const login = await context.request.post(base + '/session', { data: credentials });
  expect(login.ok()).toBe(true);
  const headers = { Authorization: 'Bearer ' + (await login.json()).token };
  const suffix = info.project.name + '-' + Date.now();
  const genres: { id: string; name: string }[] = [],
    items: string[] = [];
  let shelf = '',
    front = '';
  try {
    const response = await context.request.post(base + '/admin/shelves', {
      headers,
      data: { name: 'Genre filtering ' + suffix },
    });
    expect(response.status()).toBe(201);
    shelf = (await response.json()).id;
    const uploaded = await context.request.post(base + '/admin/uploads', {
      headers,
      multipart: {
        kind: 'front',
        file: {
          name: 'cover.png',
          mimeType: 'image/png',
          buffer: await readFile('/tmp/library-fixtures/cover.png'),
        },
      },
    });
    expect(uploaded.status()).toBe(201);
    front = (await uploaded.json()).id;
    for (const name of ['Computing ', 'Security ']) {
      const created = await context.request.post(base + '/admin/genres', {
        headers,
        data: { name: name + suffix },
      });
      expect(created.status()).toBe(201);
      genres.push(await created.json());
    }
    for (const [name, genreIds] of [
      ['Computing only', [genres[0].id]],
      ['Security only', [genres[1].id]],
      ['Both subjects', genres.map((g) => g.id)],
    ] as [string, string[]][]) {
      const created = await context.request.post(base + '/admin/items', {
        headers,
        data: {
          title: name + ' ' + suffix,
          objectType: 'book',
          shelfId: shelf,
          width: 1.65,
          height: 2.35,
          thickness: 0.25,
          color: '#406451',
          published: true,
          front,
          genreIds,
        },
      });
      expect(created.status()).toBe(201);
      items.push((await created.json()).id);
    }
    await page.goto('/');
    await page.locator('.boot-screen').waitFor();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.locator('.start-menu').getByRole('button', { name: 'Run…', exact: true }).click();
    await page.locator('.run-app input').fill('shelf');
    await page.locator('.run-app input').press('Enter');
    await page.getByRole('button', { name: 'All Collections', exact: true }).click();
    await page.getByLabel('Choose shelf').selectOption(shelf);
    await expect(page.locator('.library-index button')).toHaveCount(3);
    await page.getByLabel('Filter genre', { exact: true }).selectOption(genres[0].id);
    await expect(page.locator('.library-index button')).toHaveCount(2);
    await expect(page.locator('.library-index')).not.toContainText('Security only');
    await page.getByLabel('Filter genre', { exact: true }).selectOption(genres[1].id);
    await expect(page.locator('.library-index button')).toHaveCount(3);
    await page.getByRole('button', { name: genres[0].name + ' ×', exact: true }).click();
    await expect(page.locator('.library-index button')).toHaveCount(2);
    await expect(page.locator('.library-index')).not.toContainText('Computing only');
    await page.getByRole('button', { name: 'Clear genres', exact: true }).click();
    await expect(page.locator('.library-index button')).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  } finally {
    for (const id of items) await context.request.delete(base + '/admin/items/' + id, { headers });
    for (const genre of genres)
      await context.request.delete(base + '/admin/genres/' + genre.id, { headers });
    if (front) await context.request.delete(base + '/admin/assets/' + front, { headers });
    if (shelf) await context.request.delete(base + '/admin/shelves/' + shelf, { headers });
    await context.request.delete(base + '/session', { headers });
  }
});
