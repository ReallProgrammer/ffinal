import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import registry from '../server/src/object-types.json' with { type: 'json' };
test('all physical formats load actual surfaces, focus alone, return, and render PDF pages', async ({
  page,
  context,
}, info) => {
  test.skip(
    !process.env.LIBRARY_TEST_CREDENTIALS,
    'Requires the real local API and private test credentials.',
  );
  test.setTimeout(240000);
  const api = process.env.LIBRARY_TEST_API || 'http://127.0.0.1:8787/api/v1';
  const credentials = JSON.parse(await readFile(process.env.LIBRARY_TEST_CREDENTIALS!, 'utf8'));
  const login = await context.request.post(api + '/session', { data: credentials });
  expect(login.ok()).toBe(true);
  const headers = { Authorization: 'Bearer ' + (await login.json()).token };
  let shelf = '';
  const ids: string[] = [],
    assets: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const suffix = info.project.name + '-' + Date.now();
  async function upload(kind: string, file: string, mimeType: string) {
    const r = await context.request.post(api + '/admin/uploads', {
      headers,
      multipart: {
        kind,
        file: { name: file, mimeType, buffer: await readFile('/tmp/library-fixtures/' + file) },
      },
    });
    expect(r.status()).toBe(201);
    const id = (await r.json()).id;
    assets.push(id);
    return id;
  }
  try {
    shelf = (
      await (
        await context.request.post(api + '/admin/shelves', {
          headers,
          data: { name: 'Formats ' + suffix },
        })
      ).json()
    ).id;
    const front = await upload('front', 'cover.png', 'image/png'),
      back = await upload('back', 'revised.png', 'image/png'),
      spine = await upload('spine', 'cover.png', 'image/png'),
      digital = await upload('digital', 'four-pages.pdf', 'application/pdf'),
      model = await upload('model', 'triangle.gltf', 'model/gltf+json');
    for (const type of registry) {
      const [width, height, thickness] = type.dimensions;
      const r = await context.request.post(api + '/admin/items', {
        headers,
        data: {
          title: type.label + ' ' + suffix,
          objectType: type.id,
          shelfId: shelf,
          width,
          height,
          thickness,
          color: '#406451',
          published: true,
          front,
          back: type.surfaces.includes('back') ? back : null,
          spine: type.surfaces.includes('spine') ? spine : null,
          digital: type.document ? digital : null,
          digitalAccess: 'public',
          model: type.id === 'model' ? model : null,
          details:
            type.id === 'certificate'
              ? {
                  issuer: 'Test institute',
                  skills: 'Systems engineering',
                  verificationUrl: 'https://example.test/credential',
                }
              : {},
        },
      });
      expect(r.status()).toBe(201);
      ids.push((await r.json()).id);
    }
    // A failed surface must produce a deliberate state and recover on refresh.
    const artworkUrl = api + '/assets/' + front + '*';
    await page.route(artworkUrl, (route) => route.fulfill({ status: 503, body: 'Unavailable' }));
    await page.goto('/');
    await page.locator('.boot-screen').waitFor();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.locator('.start-menu').getByRole('button', { name: 'Run…', exact: true }).click();
    await page.locator('.run-app input').fill('shelf');
    await page.locator('.run-app input').press('Enter');
    await expect(
      page.getByRole('button', { name: 'Certificates & Achievements', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.library-index')).toContainText('Certificate or award ' + suffix);
    await page
      .locator('.library-index')
      .getByRole('button', { name: new RegExp('^Certificate or award ' + suffix) })
      .click();
    await expect(page.locator('.library-book-details')).toContainText('could not be prepared');
    await expect(page.locator('.library-book-details')).toHaveAttribute(
      'data-artwork-ready',
      'false',
    );
    await page.unroute(artworkUrl);
    await page.getByRole('menuitem', { name: 'Library', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Refresh', exact: true }).click();
    await expect(page.locator('.library-book-details')).toHaveAttribute(
      'data-artwork-ready',
      'true',
      { timeout: 25000 },
    );
    await page.getByRole('button', { name: 'Return to shelf', exact: true }).click();
    await page.getByRole('button', { name: 'All Collections', exact: true }).click();
    await page.getByLabel('Choose shelf').selectOption(shelf);
    for (const type of registry) {
      await page.getByLabel('Search collection').fill(type.label + ' ' + suffix);
      await page
        .locator('.library-index')
        .getByRole('button', {
          name: new RegExp('^' + type.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' ' + suffix),
        })
        .click();
      await expect(page.locator('.library-book-details')).toHaveAttribute(
        'data-artwork-ready',
        'true',
        { timeout: 25000 },
      );
      await expect(page.locator('.library-canvas')).toHaveAttribute(
        'data-presentation',
        'standalone',
      );
      await expect(page.getByRole('complementary', { name: 'Object details' })).toContainText(
        type.label,
      );
      if (type.id === 'certificate') {
        await expect(page.locator('.library-book-details')).toContainText('Test institute');
        await page.screenshot({
          path: `/workspace/artifacts/collection-${info.project.name}-certificate.png`,
        });
      }
      if (type.id === 'cassette')
        await page.screenshot({
          path: `/workspace/artifacts/collection-${info.project.name}-cassette.png`,
        });
      await page.getByRole('button', { name: 'Return to shelf', exact: true }).click();
      await expect(page.locator('.library-canvas')).toHaveAttribute('data-presentation', 'shelves');
    }
    await page.getByLabel('Search collection').fill('Book ' + suffix);
    await page
      .locator('.library-index')
      .getByRole('button', { name: new RegExp('^Book ' + suffix) })
      .click();
    await expect(page.locator('.library-book-details')).toHaveAttribute(
      'data-artwork-ready',
      'true',
    );
    await page.getByRole('button', { name: 'Read PDF edition →' }).click();
    await expect(page.locator('.pdf-reader')).toBeVisible();
    const cover = page.getByRole('button', { name: 'Open document cover' });
    if (await cover.count()) await cover.click();
    await expect(page.getByRole('img', { name: 'Document page 1', exact: true })).toBeVisible();
    await expect(page.locator('.pdf-reader')).toContainText('Pages 1–2 of 4');
    await page.getByRole('button', { name: 'Next pages', exact: true }).click();
    await expect(page.locator('.pdf-turn')).toBeVisible();
    await expect(page.locator('.pdf-reader')).toContainText('Pages 3–4 of 4');
    await expect(page.getByRole('img', { name: 'Document page 3', exact: true })).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.pdf-reader')).toContainText('Pages 1–2 of 4');
    await page.getByLabel('Document zoom').fill('1.2');
    await page.screenshot({
      path: `/workspace/artifacts/collection-${info.project.name}-reader.png`,
    });
    await page.getByRole('button', { name: 'Close reader', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.library-canvas')).toHaveAttribute('data-presentation', 'shelves');
    // The same real collection stays usable when WebGL is unavailable.
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
        if (type.includes('webgl')) return null;
        return Reflect.apply(original, this, [type, ...args]);
      } as typeof original;
    });
    await page.reload();
    await page.locator('.boot-screen').waitFor();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.locator('.start-menu').getByRole('button', { name: 'Run…', exact: true }).click();
    await page.locator('.run-app input').fill('shelf');
    await page.locator('.run-app input').press('Enter');
    await expect(page.locator('.library-webgl-fallback')).toBeVisible();
    await page
      .locator('.library-index')
      .getByRole('button', { name: new RegExp('^Certificate or award ' + suffix) })
      .click();
    await expect(page.locator('.library-book-details')).toContainText('Test institute');
    await expect(page.locator('.library-book-details')).toContainText('3D is unavailable');
    expect(errors).toEqual([]);
  } finally {
    for (const id of ids) await context.request.delete(api + '/admin/items/' + id, { headers });
    if (shelf) await context.request.delete(api + '/admin/shelves/' + shelf, { headers });
    for (const id of assets) await context.request.delete(api + '/admin/assets/' + id, { headers });
    await context.request.delete(api + '/session', { headers });
  }
});

test('certificate editor crops originals with a live 3D preview and saves metadata separately', async ({
  page,
  context,
}, info) => {
  test.skip(!process.env.LIBRARY_TEST_CREDENTIALS, 'Requires backend owner credentials');
  test.setTimeout(120000);
  const api = process.env.LIBRARY_TEST_API || 'http://127.0.0.1:8787/api/v1';
  const credentials = JSON.parse(await readFile(process.env.LIBRARY_TEST_CREDENTIALS!, 'utf8'));
  let headers: Record<string, string> = {};
  let shelf = '',
    item = '',
    asset = '';
  const name = 'Crop certificate ' + info.project.name + '-' + Date.now();
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
    const loginResponse = page.waitForResponse(
      (r) => r.url() === api + '/session' && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    const login = await loginResponse;
    expect(login.ok()).toBe(true);
    headers = { Authorization: 'Bearer ' + (await login.json()).token };
    shelf = (
      await (await context.request.post(api + '/admin/shelves', { headers, data: { name } })).json()
    ).id;
    await page.getByRole('button', { name: 'Public collection', exact: true }).click();
    await page.getByRole('button', { name: 'Librarian’s desk', exact: true }).click();
    await page.getByRole('button', { name: '＋ Add to Collection', exact: true }).click();
    await page
      .locator('.collection-type-grid')
      .getByRole('button', { name: /^Certificate or award/ })
      .click();
    await page.getByLabel('Title', { exact: true }).fill(name);
    await page.getByLabel('Issuing organization', { exact: true }).fill('Test institution');
    await page.getByLabel('Shelf', { exact: true }).selectOption(shelf);
    await expect(page.getByLabel('Author', { exact: true })).toHaveCount(0);
    await page
      .getByLabel('Upload front', { exact: true })
      .setInputFiles('/tmp/library-fixtures/cover.png');
    await expect(page.locator('.collection-editor .book-preview').first()).toHaveAttribute(
      'data-textures-ready',
      'true',
    );
    await page.getByRole('button', { name: 'Adjust front crop', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Crop front artwork' })).toBeVisible();
    await page.getByLabel('Crop zoom', { exact: true }).fill('1.5');
    await page.getByLabel('Horizontal crop', { exact: true }).fill('0.7');
    await expect(page.locator('.crop-editor .book-preview')).toHaveAttribute(
      'data-textures-ready',
      'true',
    );
    await page.getByRole('button', { name: 'Apply crop', exact: true }).click();
    await expect(page.locator('.crop-editor')).toHaveCount(0);
    await expect(page.getByLabel('Add title typography to artwork (optional)')).not.toBeChecked();
    await page.getByLabel('Published — visible to visitors').check();
    await page.getByRole('button', { name: 'Save & publish', exact: true }).click();
    await expect(page.locator('.collection-organizer')).toContainText(name);
    const all = await (await context.request.get(api + '/admin/collection', { headers })).json();
    const saved = all.books.find((b: { title: string }) => b.title === name);
    item = saved.id;
    asset = saved.front.id;
    expect(saved.details.issuer).toBe('Test institution');
    expect(saved.front.crop.zoom).toBe(1.5);
    expect(saved.front.crop.x).toBe(0.7);
    expect(saved.presentation.textOverlay).toBe(false);
  } finally {
    if (item) await context.request.delete(api + '/admin/items/' + item, { headers });
    if (shelf) await context.request.delete(api + '/admin/shelves/' + shelf, { headers });
    if (asset) await context.request.delete(api + '/admin/assets/' + asset, { headers });
    await context.request.delete(api + '/session', { headers });
  }
});
