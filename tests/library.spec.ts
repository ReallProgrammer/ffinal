import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
async function shelf(page: Page) {
  await page.goto('/');
  await page.locator('.boot-screen').waitFor();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.locator('.start-menu').getByRole('button', { name: 'Run…', exact: true }).click();
  await page.locator('.run-app input').fill('shelf');
  await page.locator('.run-app input').press('Enter');
  await expect(page.locator('.library-heading')).toBeVisible();
}

test('public library preserves OS controls and offers no editing or upload fields', async ({
  page,
}) => {
  await shelf(page);
  await expect(page.locator('.library-app input[type=file]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add book', exact: true })).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'Collection categories' })
    .getByRole('button', { name: 'Books', exact: true })
    .click();
  await page.getByRole('button', { name: 'Index', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search collection' }).fill('No such edition');
  await expect(page.locator('.library-empty')).toContainText('Nothing on this shelf');
  await page
    .locator('[data-app="shelf"]')
    .getByRole('button', { name: /^Maximize / })
    .click();
  await expect(page.locator('[data-app="shelf"]')).toHaveClass(/maximized/);
  await page
    .locator('[data-app="shelf"]')
    .getByRole('button', { name: /^Restore / })
    .click();
  await page
    .locator('[data-app="shelf"]')
    .getByRole('button', { name: /^Minimize / })
    .click();
  await expect(page.locator('.library-canvas')).toHaveCount(0);
  await page.getByRole('button', { name: /Taskbar: My Shelf/ }).click();
  await expect(page.locator('.library-heading')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('owner uploads, previews, publishes, reads, edits and signs out of the persistent 3D library', async ({
  page,
  context,
}, info) => {
  test.skip(
    !process.env.LIBRARY_TEST_CREDENTIALS,
    'Requires the separately running library backend and a private owner credentials file.',
  );
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const credentials = JSON.parse(await readFile(process.env.LIBRARY_TEST_CREDENTIALS!, 'utf8'));
  const api = process.env.LIBRARY_TEST_API || 'http://127.0.0.1:8787/api/v1';
  const suffix = info.project.name + '-' + Date.now(),
    title = 'Test edition ' + suffix,
    shelfName = 'Test shelf ' + suffix;
  let createdBook = '',
    createdShelf = '';
  const assets: string[] = [];
  let cleanupToken = '';
  const login = await context.request.post(api + '/session', { data: credentials });
  expect(login.ok()).toBe(true);
  cleanupToken = (await login.json()).token;
  const headers = { Authorization: `Bearer ${cleanupToken}` };
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await shelf(page);
    await page.getByRole('button', { name: 'Owner access', exact: true }).click();
    await page.getByLabel('Owner email', { exact: true }).fill(credentials.email);
    await page.getByLabel('Password', { exact: true }).fill(credentials.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Owner library management' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Shelf name' }).fill(shelfName);
    await page.getByRole('button', { name: 'Add shelf', exact: true }).click();
    await expect(page.locator('.collection-organizer')).toContainText(shelfName);
    createdShelf = (
      await (await context.request.get(api + '/admin/library', { headers })).json()
    ).shelves.find((s: { name: string }) => s.name === shelfName).id;
    await page.getByRole('button', { name: '＋ Add to Collection', exact: true }).click();
    await page
      .locator('.collection-type-grid')
      .getByRole('button', { name: /^Book / })
      .click();
    await page.getByLabel('Title', { exact: true }).fill(title);
    await page.getByLabel('Author', { exact: true }).fill('Workflow test author');
    await page
      .getByLabel('Description', { exact: true })
      .fill('An actual uploaded edition, stored by the server.');
    await page.getByLabel('Genre name', { exact: true }).fill('Testing ' + suffix);
    await page.getByRole('button', { name: 'Add genre', exact: true }).click();
    await page
      .locator('.genre-editor label')
      .filter({ hasText: 'Testing ' + suffix })
      .getByRole('checkbox')
      .check();
    await page.getByLabel('Shelf', { exact: true }).selectOption({ label: shelfName });
    await page
      .getByLabel('Upload front', { exact: true })
      .setInputFiles('/tmp/library-fixtures/cover.png');
    await expect(page.locator('.library-upload[data-kind=front]')).toContainText('cover.png');
    await expect(page.locator('.library-upload[data-kind=front]')).toContainText('Ready');
    await page
      .getByLabel('Upload digital', { exact: true })
      .setInputFiles('/tmp/library-fixtures/edition.pdf');
    await expect(page.locator('.library-upload[data-kind=digital]')).toContainText('edition.pdf');
    await expect(page.locator('.book-preview canvas')).toBeVisible();
    await expect(page.locator('.book-preview')).toHaveAttribute('data-textures-ready', 'true', {
      timeout: 20000,
    });
    await page.getByLabel('Reading access', { exact: true }).selectOption('public');
    await page.getByLabel('Published — visible to visitors').check();
    await page.getByRole('button', { name: 'Save & publish', exact: true }).click();
    await expect(page.locator('.collection-organizer')).toContainText(title);
    const stored = await (await context.request.get(api + '/admin/library', { headers })).json();
    const saved = stored.books.find((b: { title: string }) => b.title === title);
    createdBook = saved.id;
    createdShelf = saved.shelfId;
    assets.push(saved.front.id, saved.digital.id);
    await page.getByRole('button', { name: 'Public collection', exact: true }).click();
    await page.getByRole('button', { name: 'All Collections', exact: true }).click();
    await page.getByRole('combobox', { name: 'Choose shelf' }).selectOption(createdShelf);
    await page
      .locator('.library-index')
      .getByRole('button', { name: new RegExp(title) })
      .click();
    await expect(page.getByRole('complementary', { name: 'Object details' })).toContainText(title);
    await expect(page.locator('.library-canvas')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('.library-book-details')).toHaveAttribute(
      'data-artwork-ready',
      'true',
      { timeout: 20000 },
    );
    const canvas = page.locator('.library-canvas canvas');
    const bounds = (await canvas.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + bounds.height * 0.55, {
      steps: 12,
    });
    await page.mouse.up();
    await page.getByRole('button', { name: 'Zoom in on library' }).click();
    await page.getByRole('button', { name: 'Read PDF edition →' }).click();
    await expect(page.locator('.pdf-reader')).toBeVisible();
    const openCover = page.getByRole('button', { name: 'Open document cover' });
    if (await openCover.count()) await openCover.click();
    await expect(page.getByRole('img', { name: 'Document page 1', exact: true })).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Download edition' }).click();
    expect((await download).suggestedFilename()).toBe('edition.pdf');
    await page.getByRole('button', { name: 'Close reader', exact: true }).click();
    await page.screenshot({
      path: `/workspace/artifacts/library-${info.project.name}-inspection.png`,
    });
    await page.reload();
    await page.locator('.boot-screen').waitFor();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.locator('.start-menu').getByRole('button', { name: 'Run…', exact: true }).click();
    await page.locator('.run-app input').fill('shelf');
    await page.locator('.run-app input').press('Enter');
    await page.getByRole('button', { name: 'All Collections', exact: true }).click();
    await page.getByRole('combobox', { name: 'Choose shelf' }).selectOption(createdShelf);
    await expect(page.locator('.library-index')).toContainText(title);
    await expect(page.locator('.library-app input[type=file]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Owner access', exact: true }).click();
    await page.getByLabel('Owner email', { exact: true }).fill(credentials.email);
    await page.getByLabel('Password', { exact: true }).fill(credentials.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('button', { name: 'Edit ' + title, exact: true }).click();
    await page
      .getByLabel('Upload front', { exact: true })
      .setInputFiles('/tmp/library-fixtures/revised.png');
    await expect(page.locator('.library-upload[data-kind=front]')).toContainText('revised.png');
    await expect(page.locator('.library-upload[data-kind=front]')).toContainText('Ready');
    await page
      .getByLabel('Upload digital', { exact: true })
      .setInputFiles('/tmp/library-fixtures/edition.epub');
    await expect(page.locator('.library-upload[data-kind=digital]')).toContainText('edition.epub');
    await expect(page.locator('.book-preview')).toHaveAttribute('data-textures-ready', 'true');
    await page.getByRole('button', { name: 'Save & publish', exact: true }).click();
    await expect(page.locator('.collection-organizer')).toContainText(title);
    const revised = (
      await (await context.request.get(api + '/admin/library', { headers })).json()
    ).books.find((b: { id: string }) => b.id === createdBook);
    expect(revised.front.id).not.toBe(saved.front.id);
    assets.push(revised.front.id, revised.digital.id);
    await page.getByRole('menuitem', { name: 'Owner', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click();
    await expect(page.locator('.library-admin')).toHaveCount(0);
    await page.getByRole('button', { name: '← Return to the library', exact: true }).click();
    await page
      .locator('.library-index')
      .getByRole('button', { name: new RegExp(title) })
      .click();
    await page.getByRole('button', { name: 'Read EPUB edition →' }).click();
    await expect(page.locator('.epub-text')).toContainText('A real reflowable reading edition.');
    await page.getByRole('button', { name: 'Next chapter →' }).click();
    await expect(page.locator('.epub-text')).toContainText('The next page of the story.');
    expect(
      await page.evaluate(() =>
        Boolean((window as Window & { epubScriptRan?: boolean }).epubScriptRan),
      ),
    ).toBe(false);
    await page.getByRole('button', { name: 'Close reader', exact: true }).click();
    expect(
      (
        await context.request.post(api + '/admin/books', { data: { title: 'Unauthorized' } })
      ).status(),
    ).toBe(401);
    expect(errors).toEqual([]);
  } finally {
    if (createdBook)
      await context.request
        .delete(api + '/admin/books/' + createdBook, { headers })
        .catch(() => {});
    if (createdShelf)
      await context.request
        .delete(api + '/admin/shelves/' + createdShelf, { headers })
        .catch(() => {});
    for (const id of assets)
      await context.request.delete(api + '/admin/assets/' + id, { headers }).catch(() => {});
    await context.request.delete(api + '/session', { headers }).catch(() => {});
  }
});
