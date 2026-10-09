import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { zipSync, strToU8 } from 'fflate';
const base = process.env.LIBRARY_TEST_API || 'http://127.0.0.1:8787/api/v1';
const credentialsPath = process.env.LIBRARY_TEST_CREDENTIALS;
if (!credentialsPath)
  throw new Error(
    'Set LIBRARY_TEST_CREDENTIALS to a private JSON file containing the test owner email/password. Tests only remove records they create.',
  );
let token = '',
  shelf = '',
  book = '',
  front = '',
  pdf = '',
  secondFront = '';
const createdAssets = [];
async function call(path, method = 'GET', body, auth = token) {
  return fetch(base + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function upload(kind, buffer, name) {
  const form = new FormData();
  form.append('kind', kind);
  form.append('file', new Blob([buffer]), name);
  const r = await fetch(base + '/admin/uploads', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (r.ok) {
    const result = await r.json();
    createdAssets.push(result.id);
    return { status: r.status, ...result };
  }
  return { status: r.status, ...(await r.json()) };
}
let input;
before(async () => {
  const creds = JSON.parse(await readFile(credentialsPath, 'utf8'));
  const r = await call('/session', 'POST', creds, '');
  assert.equal(r.status, 200);
  token = (await r.json()).token;
});
after(async () => {
  if (book) await call('/admin/books/' + book, 'DELETE');
  if (shelf) await call('/admin/shelves/' + shelf, 'DELETE');
  for (const id of createdAssets) await call('/admin/assets/' + id, 'DELETE');
  if (token) await call('/session', 'DELETE');
});
test('anonymous and forged sessions cannot use any management operation', async () => {
  for (const [path, method, body] of [
    ['/admin/library', 'GET'],
    ['/admin/uploads', 'POST'],
    ['/admin/books', 'POST', {}],
    ['/admin/books/00000000-0000-4000-8000-000000000000', 'PUT', {}],
    ['/admin/books/00000000-0000-4000-8000-000000000000', 'DELETE'],
    ['/admin/books/order', 'PUT', { ids: [] }],
    ['/admin/shelves', 'POST', { name: 'Intrusion' }],
    ['/admin/shelves/order', 'PUT', { ids: [] }],
    ['/admin/assets', 'GET'],
  ])
    assert.equal((await call(path, method, body, '')).status, 401, path);
  assert.equal((await call('/admin/library', 'GET', undefined, 'x'.repeat(43))).status, 401);
});
test('owner creates a shelf, uploads real artwork and a readable PDF', async () => {
  const r = await call('/admin/shelves', 'POST', { name: 'Integration test shelf' });
  assert.equal(r.status, 201);
  shelf = (await r.json()).id;
  const image = await sharp({
    create: { width: 300, height: 450, channels: 3, background: '#335949' },
  })
    .png()
    .toBuffer();
  const cover = await upload('front', image, 'cover.png');
  assert.equal(cover.status, 201);
  front = cover.id;
  const document = await PDFDocument.create();
  document.addPage().drawText('A library integration test.');
  const reading = await upload('digital', await document.save(), 'edition.pdf');
  assert.equal(reading.status, 201);
  pdf = reading.id;
  input = {
    title: 'Server workflow test',
    author: 'Test owner',
    description: 'Persistent book metadata',
    genre: 'Testing',
    year: 2026,
    isbn: '',
    color: '#335949',
    height: 2.8,
    width: 1.8,
    thickness: 0.3,
    shelfId: shelf,
    published: false,
    digitalAccess: 'private',
    front,
    spine: null,
    back: null,
    digital: pdf,
  };
});
test('files are sniffed and decoded; forged images, SVG and invalid PDF are rejected', async () => {
  assert.equal(
    (await upload('front', Buffer.from('<svg onload="alert(1)"></svg>'), 'cover.png')).status,
    400,
  );
  assert.equal(
    (await upload('digital', Buffer.from('%PDF-1.4\ninvalid\n%%EOF'), 'broken.pdf')).status,
    400,
  );
  assert.equal(
    (await upload('front', Buffer.alloc(10 * 1024 * 1024 + 1), 'large.jpg')).status,
    400,
  );
});
test('draft metadata, original artwork and private files are never exposed to visitors', async () => {
  const response = await call('/admin/books', 'POST', input);
  assert.equal(response.status, 201);
  book = (await response.json()).id;
  const list = await (await call('/library', 'GET', undefined, '')).json();
  assert.ok(!list.books.some((b) => b.id === book));
  assert.equal((await call('/assets/' + front, 'GET', undefined, '')).status, 404);
  assert.equal((await call('/books/' + book + '/read', 'GET', undefined, '')).status, 404);
  assert.equal((await call('/assets/' + pdf, 'GET', undefined, '')).status, 404);
  assert.equal((await call('/assets/' + front)).status, 200);
  const own = await (await call('/admin/library')).json();
  assert.equal(own.books.find((b) => b.id === book).title, input.title);
});
test('publishing exposes optimized cover and metadata but keeps the digital file private by default', async () => {
  input.published = true;
  assert.equal((await call('/admin/books/' + book, 'PUT', input)).status, 200);
  const entry = (await (await call('/library', 'GET', undefined, '')).json()).books.find(
    (b) => b.id === book,
  );
  assert.ok(entry);
  assert.equal(entry.digital, null);
  assert.equal(entry.canRead, false);
  const response = await call('/assets/' + front, 'GET', undefined, '');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/webp');
  assert.equal((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).width, 300);
  assert.equal((await call('/assets/' + front + '?original=1', 'GET', undefined, '')).status, 403);
  assert.equal((await call('/books/' + book + '/read', 'GET', undefined, '')).status, 404);
});
test('owner grants public reading, edits the cover, and refreshed public data uses the new asset', async () => {
  const next = await upload(
    'front',
    await sharp({ create: { width: 200, height: 320, channels: 3, background: '#8c4d38' } })
      .png()
      .toBuffer(),
    'new-cover.png',
  );
  assert.equal(next.status, 201);
  secondFront = next.id;
  input = { ...input, digitalAccess: 'public', front: secondFront, title: 'Revised edition' };
  assert.equal((await call('/admin/books/' + book, 'PUT', input)).status, 200);
  const entry = (await (await call('/library', 'GET', undefined, '')).json()).books.find(
    (b) => b.id === book,
  );
  assert.equal(entry.front.id, secondFront);
  assert.equal(entry.title, 'Revised edition');
  assert.ok(entry.canRead);
  const reading = await call('/books/' + book + '/read', 'GET', undefined, '');
  assert.equal(reading.status, 200);
  assert.ok(
    Buffer.from(await reading.arrayBuffer())
      .toString('latin1')
      .startsWith('%PDF'),
  );
  assert.equal((await call('/assets/' + front, 'GET', undefined, '')).status, 404);
});
test('ordering is persistent and invalid permutations cannot corrupt it', async () => {
  const all = await (await call('/admin/library')).json();
  const ids = all.books.map((b) => b.id).reverse();
  assert.equal((await call('/admin/books/order', 'PUT', { ids })).status, 204);
  assert.deepEqual(
    (await (await call('/admin/library')).json()).books.map((b) => b.id),
    ids,
  );
  assert.equal((await call('/admin/books/order', 'PUT', { ids: [book, book] })).status, 409);
  assert.equal((await call('/admin/shelves/' + shelf, 'DELETE')).status, 409);
  assert.equal((await call('/admin/assets/' + secondFront, 'DELETE')).status, 409);
});
test('unpublishing revokes public artwork and reading access immediately', async () => {
  input.published = false;
  assert.equal((await call('/admin/books/' + book, 'PUT', input)).status, 200);
  assert.equal((await call('/assets/' + secondFront, 'GET', undefined, '')).status, 404);
  assert.equal((await call('/books/' + book + '/read', 'GET', undefined, '')).status, 404);
});
test('unknown origins receive no CORS permission and API errors do not expose secrets', async () => {
  const r = await fetch(base + '/admin/library', {
    headers: { Origin: 'https://untrusted.example' },
  });
  assert.equal(r.headers.get('access-control-allow-origin'), null);
  assert.equal(r.status, 401);
  assert.deepEqual(await r.json(), { error: 'Owner sign-in required.' });
});
test('owner sign-out revokes the bearer session on the server', async () => {
  await call('/admin/books/' + book, 'DELETE');
  book = '';
  await call('/admin/shelves/' + shelf, 'DELETE');
  shelf = '';
  for (const id of createdAssets) await call('/admin/assets/' + id, 'DELETE');
  createdAssets.length = 0;
  assert.equal((await call('/session', 'DELETE')).status, 204);
  assert.equal((await call('/admin/library')).status, 401);
  token = '';
});

test('EPUB validation checks real archive structure and decompressed contents', async () => {
  const { validateAsset } = await import('../src/assets.mjs');
  const good = zipSync({
    mimetype: strToU8('application/epub+zip'),
    'META-INF/container.xml': strToU8('<container/>'),
    'book.xhtml': strToU8('<html><body>A chapter</body></html>'),
  });
  assert.equal((await validateAsset(Buffer.from(good), 'digital')).mime, 'application/epub+zip');
  await assert.rejects(
    () => validateAsset(Buffer.from(zipSync({ 'random.txt': strToU8('Not an EPUB') })), 'digital'),
    /not an EPUB/,
  );
});
