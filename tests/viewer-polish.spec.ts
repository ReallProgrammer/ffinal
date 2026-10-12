import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
async function openCollection(page: Page) {
  await page.goto('/');
  await page.locator('.boot-screen').waitFor();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.locator('.start-menu').getByRole('button', { name: 'Run…', exact: true }).click();
  await page.locator('.run-app input').fill('shelf');
  await page.locator('.run-app input').press('Enter');
  await expect(page.locator('.library-heading')).toBeVisible();
}
test('animated preparation, object-sized zoom limits, right-drag panning and clearer collection navigation', async ({
  page,
  context,
}, info) => {
  test.skip(!process.env.LIBRARY_TEST_CREDENTIALS, 'Real local backend required');
  test.setTimeout(180000);
  const base = process.env.LIBRARY_TEST_API || 'http://127.0.0.1:8787/api/v1';
  const credentials = JSON.parse(await readFile(process.env.LIBRARY_TEST_CREDENTIALS!, 'utf8'));
  const login = await context.request.post(base + '/session', { data: credentials });
  expect(login.ok()).toBe(true);
  const headers = { Authorization: 'Bearer ' + (await login.json()).token };
  const items: { id: string; title: string }[] = [],
    assets: string[] = [];
  let shelf = '',
    sibling = '',
    release = () => {};
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const suffix = info.project.name + '-' + Date.now();
  try {
    const created = await context.request.post(base + '/admin/shelves', {
      headers,
      data: { name: 'Professional viewer fixtures ' + suffix },
    });
    expect(created.status()).toBe(201);
    shelf = (await created.json()).id;
    const adjacent = await context.request.post(base + '/admin/shelves', {
      headers,
      data: { name: 'Adjacent empty shelf ' + suffix },
    });
    expect(adjacent.status()).toBe(201);
    sibling = (await adjacent.json()).id;
    const upload = async (kind: string, name: string, mimeType: string) => {
      const r = await context.request.post(base + '/admin/uploads', {
        headers,
        multipart: {
          kind,
          file: { name, mimeType, buffer: await readFile('/tmp/library-fixtures/' + name) },
        },
      });
      expect(r.status()).toBe(201);
      const id = (await r.json()).id;
      assets.push(id);
      return id;
    };
    const front = await upload('front', 'cover.png', 'image/png'),
      model = await upload('model', 'triangle.gltf', 'model/gltf+json');
    for (const objectType of ['book', 'certificate', 'model']) {
      const title = 'Viewer ' + objectType + ' ' + suffix;
      const r = await context.request.post(base + '/admin/items', {
        headers,
        data: {
          objectType,
          title,
          shelfId: shelf,
          width: objectType === 'certificate' ? 3.5 : 2,
          height: 2.8,
          thickness: objectType === 'model' ? 1.6 : 0.22,
          color: '#456789',
          published: true,
          front,
          model: objectType === 'model' ? model : null,
          presentation:
            objectType === 'certificate'
              ? { frame: true, frameStyle: 'black', frameColor: '#35463a', frameWidth: 0.1 }
              : {},
        },
      });
      expect(r.status()).toBe(201);
      items.push({ id: (await r.json()).id, title });
    }
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(base + '/assets/' + front + '*', async (route) => {
      await gate;
      await route.continue();
    });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openCollection(page);
    const categories = page.getByRole('navigation', { name: 'Collection categories' });
    await expect(categories.getByRole('button').first()).toHaveText('All Collections');
    await expect(categories.getByRole('button').nth(1)).toHaveText('Certificates/Achievements');
    await expect(categories.getByRole('button').first()).toHaveAttribute('aria-pressed', 'true');
    await page.getByLabel('Choose shelf').selectOption(shelf);
    await expect(categories.getByRole('button')).toHaveText([
      'All Collections',
      'Certificates/Achievements',
      'Books',
      '3D Objects',
    ]);
    await page.getByLabel('Next shelf', { exact: true }).click();
    await expect(page.getByLabel('Choose shelf')).toHaveValue(sibling);
    await expect(categories.getByRole('button')).toHaveText(['All Collections']);
    await page.getByLabel('Previous shelf', { exact: true }).click();
    await expect(page.getByLabel('Choose shelf')).toHaveValue(shelf);
    const chooser = (await page.getByLabel('Choose shelf').boundingBox())!;
    const sceneBox = (await page.locator('.library-canvas').boundingBox())!;
    expect(chooser.x - sceneBox.x).toBeLessThan(90);
    await expect(page.locator('.library-canvas [data-loading-phase]')).toHaveCount(1);
    const loader = page.locator('.library-canvas [data-loading-phase]');
    const phase = await loader.getAttribute('data-loading-phase');
    await expect.poll(() => loader.getAttribute('data-loading-phase')).not.toBe(phase);
    release();
    for (const item of items) {
      await page
        .locator('.library-index')
        .getByRole('button', { name: new RegExp(item.title) })
        .click();
      await expect(page.locator('.library-book-details')).toHaveAttribute(
        'data-artwork-ready',
        'true',
        { timeout: 30000 },
      );
      if (item.title.includes('certificate')) {
        await expect(page.locator('.library-book-details')).not.toContainText('Unknown');
        await expect(page.locator('.library-book-details')).not.toContainText(
          'Issuing organization',
        );
      }
      const viewer = page.locator('.library-canvas [data-view-minimum]');
      await expect(viewer).toHaveCount(1);
      await page.waitForTimeout(1800);
      const bounds = (await page.locator('.library-canvas canvas').boundingBox())!;
      await page.mouse.move(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.5);
      for (let step = 0; step < 65; step++) await page.mouse.wheel(0, -400);
      await expect
        .poll(
          async () =>
            Number(await viewer.getAttribute('data-view-orbit-distance')) /
            Number(await viewer.getAttribute('data-view-minimum')),
        )
        .toBeLessThan(1.08);
      await expect
        .poll(
          async () =>
            Number(await viewer.getAttribute('data-view-distance')) -
            Number(await viewer.getAttribute('data-view-minimum')),
        )
        .toBeGreaterThanOrEqual(-0.01);
      for (let step = 0; step < 65; step++) await page.mouse.wheel(0, 400);
      await expect
        .poll(
          async () =>
            Number(await viewer.getAttribute('data-view-orbit-distance')) /
            Number(await viewer.getAttribute('data-view-maximum')),
        )
        .toBeGreaterThan(0.98);
      await expect
        .poll(
          async () =>
            Number(await viewer.getAttribute('data-view-distance')) -
            Number(await viewer.getAttribute('data-view-maximum')) -
            Number(await viewer.getAttribute('data-view-radius')) * 0.55,
        )
        .toBeLessThanOrEqual(0.01);
      await page.getByRole('button', { name: 'Reset library view' }).click();
      await page.waitForTimeout(1800);
      const x = Number(await viewer.getAttribute('data-view-target-x'));
      await page.mouse.move(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.5);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + bounds.height * 0.5, {
        steps: 10,
      });
      await page.mouse.up({ button: 'right' });
      await expect
        .poll(async () => Math.abs(Number(await viewer.getAttribute('data-view-target-x')) - x))
        .toBeGreaterThan(0.02);
      expect(Number(await viewer.getAttribute('data-view-target-offset'))).toBeLessThanOrEqual(
        Number(await viewer.getAttribute('data-view-radius')) * 0.55 + 0.01,
      );
      if (item.title.includes('certificate')) {
        await page.mouse.move(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(bounds.x + bounds.width * 0.72, bounds.y + bounds.height * 0.5, {
          steps: 10,
        });
        await page.mouse.up();
        await page.waitForTimeout(700);
        const angle = Number(await viewer.getAttribute('data-view-azimuth'));
        const distance = Number(await viewer.getAttribute('data-view-orbit-distance'));
        await page.getByRole('button', { name: 'Zoom in on library' }).click();
        await expect
          .poll(async () => Number(await viewer.getAttribute('data-view-orbit-distance')))
          .toBeLessThan(distance);
        expect(
          Math.abs(Number(await viewer.getAttribute('data-view-azimuth')) - angle),
        ).toBeLessThan(0.025);
        await page.getByLabel('Auto rotate', { exact: true }).check();
        await expect
          .poll(async () =>
            Math.abs(Number(await viewer.getAttribute('data-view-azimuth')) - angle),
          )
          .toBeGreaterThan(0.06);
        await page.getByLabel('Auto rotate', { exact: true }).uncheck();
        await page.screenshot({
          path: `/workspace/artifacts/viewer-${info.project.name}-certificate-side.png`,
        });
      }
      await page.getByRole('button', { name: 'Return to shelf', exact: true }).click();
    }
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  } finally {
    release();
    for (const item of items)
      await context.request.delete(base + '/admin/items/' + item.id, { headers });
    if (shelf) await context.request.delete(base + '/admin/shelves/' + shelf, { headers });
    if (sibling) await context.request.delete(base + '/admin/shelves/' + sibling, { headers });
    for (const id of assets)
      await context.request.delete(base + '/admin/assets/' + id, { headers });
    await context.request.delete(base + '/session', { headers });
  }
});
test('owner removes unused uploads and managed genres immediately or in batches without popup dialogs', async ({
  page,
  context,
}, info) => {
  test.skip(!process.env.LIBRARY_TEST_CREDENTIALS, 'Real local backend required');
  test.setTimeout(120000);
  const base = process.env.LIBRARY_TEST_API || 'http://127.0.0.1:8787/api/v1';
  const credentials = JSON.parse(await readFile(process.env.LIBRARY_TEST_CREDENTIALS!, 'utf8'));
  const login = await context.request.post(base + '/session', { data: credentials });
  expect(login.ok()).toBe(true);
  const headers = { Authorization: 'Bearer ' + (await login.json()).token };
  const assets: string[] = [],
    genres: string[] = [];
  const suffix = info.project.name + '-' + Date.now();
  const dialogs: string[] = [];
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  try {
    for (const name of ['first', 'second']) {
      const r = await context.request.post(base + '/admin/uploads', {
        headers,
        multipart: {
          kind: 'front',
          file: {
            name: name + '-' + suffix + '.png',
            mimeType: 'image/png',
            buffer: await readFile('/tmp/library-fixtures/cover.png'),
          },
        },
      });
      expect(r.status()).toBe(201);
      assets.push((await r.json()).id);
    }
    await openCollection(page);
    await page.getByRole('button', { name: 'Owner access', exact: true }).click();
    await page.getByLabel('Owner email', { exact: true }).fill(credentials.email);
    await page.getByLabel('Password', { exact: true }).fill(credentials.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.locator('.library-admin')).toBeVisible();
    const styles = await page.locator('.library-management-tools button').evaluateAll((buttons) =>
      buttons.slice(0, 2).map((button) => {
        const s = getComputedStyle(button);
        return [s.borderWidth, s.borderStyle, s.borderRadius, s.height];
      }),
    );
    expect(styles[0]).toEqual(styles[1]);
    await page.getByRole('button', { name: 'Unused uploads', exact: true }).click();
    for (const name of ['first', 'second'])
      await page
        .getByLabel('Select upload ' + name + '-' + suffix + '.png', { exact: true })
        .check();
    await page.getByRole('button', { name: 'Delete selected uploads', exact: true }).click();
    for (const name of ['first', 'second'])
      await expect(
        page.getByLabel('Select upload ' + name + '-' + suffix + '.png', { exact: true }),
      ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Delete all unused uploads', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Manage genres', exact: true }).click();
    for (const name of ['Immediate', 'Bulk A', 'Bulk B']) {
      await page.getByLabel('Genre name', { exact: true }).fill(name + ' ' + suffix);
      await page.getByRole('button', { name: 'Add genre', exact: true }).click();
      await expect(page.locator('.genre-options')).toContainText(name + ' ' + suffix);
    }
    const data = await (await context.request.get(base + '/admin/collection', { headers })).json();
    genres.push(
      ...data.genres
        .filter((genre: any) => genre.name.endsWith(suffix))
        .map((genre: any) => genre.id),
    );
    await page
      .locator('.genre-option')
      .filter({ hasText: 'Immediate ' + suffix })
      .getByRole('button', { name: 'Rename', exact: true })
      .click();
    await page.getByLabel('Genre name', { exact: true }).fill('Renamed ' + suffix);
    await page.getByRole('button', { name: 'Save genre name', exact: true }).click();
    await expect(page.locator('.genre-options')).toContainText('Renamed ' + suffix);
    await page
      .locator('.genre-option')
      .filter({ hasText: 'Renamed ' + suffix })
      .getByRole('button', { name: /^Delete genre / })
      .click();
    await expect(page.locator('.genre-options')).not.toContainText('Renamed ' + suffix);
    await expect(page.locator('.genre-options')).not.toContainText('Immediate ' + suffix);
    for (const name of ['Bulk A', 'Bulk B'])
      await page
        .getByLabel('Select genre ' + name + ' ' + suffix + ' for deletion', { exact: true })
        .check();
    await page.getByRole('button', { name: 'Delete selected genres', exact: true }).click();
    await expect(page.locator('.genre-options')).not.toContainText(suffix);
    await expect(
      page.getByRole('button', { name: 'Delete all genres', exact: true }),
    ).toBeVisible();
    expect(dialogs).toEqual([]);
  } finally {
    for (const id of genres)
      await context.request.delete(base + '/admin/genres/' + id, { headers });
    for (const id of assets)
      await context.request.delete(base + '/admin/assets/' + id, { headers });
    await context.request.delete(base + '/session', { headers });
  }
});
