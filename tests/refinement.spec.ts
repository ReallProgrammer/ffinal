import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test('owner saves wrap art, layers, interior files and exact placement; visitors browse a separate photo gallery', async ({
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
    await expect(page.locator('[placeholder="Unknown"]')).toHaveCount(0);
    await expect(page.getByLabel('Genre category', { exact: true })).toHaveValue('games');
    await page.getByLabel('Genre name', { exact: true }).fill('Disposable ' + name);
    await page.getByRole('button', { name: 'Add genre', exact: true }).click();
    const genreRow = page.locator('.genre-option').filter({ hasText: 'Disposable ' + name });
    await expect(genreRow.getByRole('checkbox')).toHaveCount(1);
    await genreRow.getByRole('checkbox').check();
    await genreRow.getByRole('button', { name: /^Delete genre/ }).click();
    await expect(genreRow).toHaveCount(0);
    // The image toolbar uploads a separate transparent layer without needing base artwork.
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Add image', exact: true }).click();
    const decalUpload = page.waitForResponse(
      (r) => r.url() === base + '/admin/uploads' && r.request().method() === 'POST',
    );
    await (await chooser).setFiles('/tmp/library-fixtures/revised.png');
    assetIds.push((await (await decalUpload).json()).id);
    await expect(page.locator('.cover-layer img')).toBeVisible();
    await expect(page.getByRole('tab', { name: /^front Add$/ })).toBeVisible();
    await expect(page.locator('.layer-canvas')).not.toHaveCSS(
      'background-color',
      'rgb(56, 85, 72)',
    );
    await expect(page.locator('.book-preview')).toHaveAttribute('data-textures-ready', 'true', {
      timeout: 20000,
    });
    await page.getByRole('button', { name: 'Delete layer', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill(name);
    await page.getByLabel('Shelf', { exact: true }).selectOption(shelf);
    await page.getByRole('tab', { name: /Full wrap/ }).click();
    await page
      .getByLabel('Upload full wrap', { exact: true })
      .setInputFiles('/tmp/library-fixtures/cover.png');
    await expect(page.getByRole('tab', { name: /front Added/ })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('tab', { name: /spine Added/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /back Added/ })).toBeVisible();
    await page.getByRole('tab', { name: /^disc/ }).click();
    await page
      .getByLabel('Upload disc', { exact: true })
      .setInputFiles('/tmp/library-fixtures/revised.png');
    await expect(
      page
        .locator('.library-upload')
        .filter({ has: page.getByLabel('Upload disc', { exact: true }) }),
    ).toContainText('Ready');
    await page.getByRole('tab', { name: /^manual/ }).click();
    await page
      .getByLabel('Upload manual', { exact: true })
      .setInputFiles('/tmp/library-fixtures/four-pages.pdf');
    await expect(
      page
        .locator('.library-upload')
        .filter({ has: page.getByLabel('Upload manual', { exact: true }) }),
    ).toContainText('Ready');
    await page.getByLabel('Reading access').selectOption('public');
    for (const file of ['cover.png', 'revised.png']) {
      await page
        .getByLabel('Upload gallery photo', { exact: true })
        .setInputFiles('/tmp/library-fixtures/' + file);
      await expect(page.locator('.collection-photo-list li')).toHaveCount(
        file === 'cover.png' ? 1 : 2,
      );
    }
    await expect(page.getByRole('button', { name: 'Add image', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Add text', exact: true }).click();
    await page.getByLabel('Edit layer text', { exact: true }).fill('COLLECTOR');
    await expect(page.getByLabel('Edit layer text', { exact: true })).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    );
    await expect(page.getByLabel('Edit layer text', { exact: true })).toHaveCSS(
      'border-top-width',
      '0px',
    );
    await expect(page.locator('.layer-properties input[type=number]')).toHaveCount(0);
    const rotationHandle = page.getByRole('button', { name: 'Rotate layer', exact: true });
    await rotationHandle.scrollIntoViewIfNeeded();
    const handleBox = (await rotationHandle.boundingBox())!;
    const layerBox = (await page.locator('.cover-layer').first().boundingBox())!;
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(layerBox.x + layerBox.width + 35, layerBox.y + layerBox.height / 2, {
      steps: 15,
    });
    await page.mouse.up();
    await expect(page.locator('.cover-layer').first()).not.toHaveCSS(
      'transform',
      'matrix(1, 0, 0, 1, 0, 0)',
    );

    await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
    await page.getByRole('button', { name: 'Delete layer', exact: true }).click();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.locator('.cover-layer')).toHaveCount(2);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(page.locator('.cover-layer')).toHaveCount(1);
    if (info.project.name === 'desktop') {
      await page.getByLabel('Edit layer text', { exact: true }).click();
      const layer = page.getByRole('button', { name: 'Move layer', exact: true });
      await layer.scrollIntoViewIfNeeded();
      const b = (await layer.boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2 + 25, b.y + b.height / 2 + 10, { steps: 5 });
      await page.mouse.up();
      await page.getByRole('button', { name: 'Undo', exact: true }).click();
    }
    await page
      .locator('.layer-canvas')
      .screenshot({ path: `/workspace/artifacts/corrections-${info.project.name}-layers.png` });
    await page
      .locator('.book-preview')
      .screenshot({ path: `/workspace/artifacts/corrections-${info.project.name}-case.png` });
    const caseButton = (await page
      .getByRole('button', { name: 'Open case', exact: true })
      .boundingBox())!;
    expect(caseButton.height).toBeLessThan(60);
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
    expect(item.gallery).toHaveLength(2);
    expect(item.gallery[0].filename).toBe('cover.png');
    expect(item.layers.front).toHaveLength(1);
    await expect(page.locator('.organizer-category-illustration img')).toHaveCount(0);
    expect(item.layers.front[0].text).toBe('COLLECTOR');
    expect(item.tags).toEqual(['games', 'collection']);
    expect(item.artwork.manual).toBeTruthy();
    id = item.id;
    for (const a of [
      item.front,
      item.spine,
      item.back,
      ...item.gallery,
      ...Object.values(item.artwork),
    ] as any[])
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
    await page.getByLabel('Choose shelf').selectOption(shelf2);
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
    await expect(page.getByRole('button', { name: 'Close case', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close case', exact: true }).click();
    await expect(page.getByLabel('Collection photos').getByRole('button')).toHaveCount(2);
    await page.getByRole('button', { name: 'View flat artwork', exact: true }).click();
    await expect(page.getByLabel('Artwork gallery').getByRole('button')).toHaveCount(2);
    await page.getByLabel('Next artwork', { exact: true }).click();
    await expect(page.locator('.artwork-gallery-footer')).toContainText('Photo 2');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.artwork-gallery-footer')).toContainText('Photo 1');
    await expect(page.locator('.artwork-viewer img[draggable=false]')).toBeVisible();
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
