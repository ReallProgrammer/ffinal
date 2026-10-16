import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
const base = process.env.LIBRARY_TEST_API || 'http://127.0.0.1:8787/api/v1';
let owner = '',
  ids = [],
  media = [];
const call = (path, method = 'GET', body, auth = owner, headers = {}) =>
  fetch(base + path, {
    method,
    headers: {
      ...(auth ? { Authorization: 'Bearer ' + auth } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
before(async () => {
  const r = await call(
    '/session',
    'POST',
    JSON.parse(await readFile(process.env.LIBRARY_TEST_CREDENTIALS, 'utf8')),
    '',
  );
  assert.equal(r.status, 200);
  owner = (await r.json()).token;
});
after(async () => {
  for (const id of media) await call('/admin/media/' + id, 'DELETE');
  for (const id of ids) await call('/chess/matches/' + id + '/close', 'POST');
  if (process.env.LIBRARY_TEST_DATABASE_URL) {
    const db = new Pool({ connectionString: process.env.LIBRARY_TEST_DATABASE_URL });
    await db.query('DELETE FROM chess_matches WHERE id=ANY($1::uuid[])', [ids]);
    await db.end();
  }
  await call('/session', 'DELETE');
});
test('chess participant isolation, owner acceptance, legal turns, conflicts and persistent checkmate', async () => {
  assert.equal((await call('/admin/chess/matches', 'GET', undefined, '')).status, 401);
  const r = await call('/chess/matches', 'POST', { nickname: 'Integration challenger' }, '');
  assert.equal(r.status, 201);
  const { match, token } = await r.json();
  ids.push(match.id);
  assert.ok(!('guest_hash' in match));
  const path = '/chess/matches/' + match.id;
  assert.equal((await call(path, 'GET', undefined, '')).status, 404);
  assert.equal((await call(path, 'GET', undefined, 'x'.repeat(43))).status, 404);
  assert.equal((await call('/admin' + path + '/accept', 'POST', undefined, token)).status, 401);
  assert.equal(
    (await call(path + '/moves', 'POST', { from: 'f2', to: 'f3', version: 0 }, token)).status,
    409,
  );
  let board = await (await call('/admin' + path + '/accept', 'POST')).json();
  assert.equal(board.status, 'active');
  assert.equal(
    (await call(path + '/moves', 'POST', { from: 'e7', to: 'e5', version: board.version })).status,
    403,
  );
  assert.equal(
    (await call(path + '/moves', 'POST', { from: 'f2', to: 'f5', version: board.version }, token))
      .status,
    400,
  );
  assert.equal(
    (await call(path + '/moves', 'POST', { from: 'f2', to: 'f3', version: 0 }, token)).status,
    409,
  );
  for (const [from, to, auth] of [
    ['f2', 'f3', token],
    ['e7', 'e5', owner],
    ['g2', 'g4', token],
    ['d8', 'h4', owner],
  ]) {
    const next = await call(path + '/moves', 'POST', { from, to, version: board.version }, auth);
    assert.equal(next.status, 200);
    board = await next.json();
  }
  assert.equal(board.status, 'finished');
  assert.equal(board.result, 'Owner wins by checkmate');
  assert.match(board.pgn, /Qh4#/);
  const persisted = await (await call(path, 'GET', undefined, token)).json();
  assert.equal(persisted.pgn, board.pgn);
  assert.equal(persisted.version, board.version);
  assert.equal(persisted.result, board.result);
  assert.equal(
    (await call(path + '/moves', 'POST', { from: 'e2', to: 'e4', version: board.version }, token))
      .status,
    409,
  );
  assert.ok((await (await call('/admin/chess/matches')).json()).some((m) => m.id === match.id));
});
test('chess request cancellation and notification setup remain owner-only', async () => {
  const r = await call('/chess/matches', 'POST', { nickname: 'Cancel test' }, '');
  assert.equal(r.status, 201);
  const { match, token } = await r.json();
  ids.push(match.id);
  assert.equal(
    (await call('/chess/matches/' + match.id + '/close', 'POST', undefined, '')).status,
    404,
  );
  assert.equal(
    (await (await call('/chess/matches/' + match.id + '/close', 'POST', undefined, token)).json())
      .status,
    'cancelled',
  );
  assert.equal((await call('/admin/chess/push', 'POST', {}, '')).status, 401);
  const cfg = await (await call('/chess/config', 'GET', undefined, '')).json();
  assert.deepEqual(cfg.timeControlsSeconds, [0, 180, 300, 600, 900]);
  assert.equal(cfg.defaultTimeControl, 600);
  if (!cfg.pushAvailable) {
    assert.equal(cfg.publicKey, null);
    assert.equal((await call('/admin/chess/push', 'POST', {})).status, 503);
  }
});
test(
  'online clocks persist, reject client clock changes and enforce timeout before moves',
  { skip: !process.env.LIBRARY_TEST_DATABASE_URL },
  async () => {
    const db = new Pool({ connectionString: process.env.LIBRARY_TEST_DATABASE_URL });
    try {
      const response = await call(
        '/chess/matches',
        'POST',
        { nickname: 'Clock integration', timeControl: 180 },
        '',
      );
      assert.equal(response.status, 201);
      const { match, token } = await response.json();
      ids.push(match.id);
      const path = '/chess/matches/' + match.id;
      assert.equal(match.whiteMs, 180000);
      assert.equal(match.blackMs, 180000);
      assert.equal((await (await call(path, 'GET', undefined, token)).json()).whiteMs, 180000);
      let board = await (await call('/admin' + path + '/accept', 'POST')).json();
      assert.equal(board.status, 'active');
      assert.equal(
        (
          await call(
            path + '/moves',
            'POST',
            { from: 'e2', to: 'e4', version: board.version, whiteMs: 999999 },
            token,
          )
        ).status,
        400,
      );
      await db.query(
        "UPDATE chess_matches SET clock_updated_at=now()-interval '5 seconds' WHERE id=$1",
        [match.id],
      );
      board = await (
        await call(path + '/moves', 'POST', { from: 'e2', to: 'e4', version: board.version }, token)
      ).json();
      assert.match(board.pgn, /e4/);
      assert.ok(board.whiteMs <= 175001 && board.whiteMs > 170000);
      const white = board.whiteMs,
        pgn = board.pgn;
      await db.query(
        "UPDATE chess_matches SET black_ms=1000,clock_updated_at=now()-interval '2 seconds' WHERE id=$1",
        [match.id],
      );
      board = await (
        await call(path + '/moves', 'POST', { from: 'e7', to: 'e5', version: board.version })
      ).json();
      assert.equal(board.status, 'finished');
      assert.equal(board.result, 'Visitor wins on time');
      assert.equal(board.pgn, pgn);
      assert.equal(board.whiteMs, white);
      assert.equal(board.blackMs, 0);
      const persisted = await (await call(path, 'GET', undefined, token)).json();
      assert.equal(persisted.result, board.result);
      assert.equal(persisted.version, board.version);
      // Exercise timeout settlement on a read as well as on a move using only this test row.
      await db.query(
        "UPDATE chess_matches SET status='active',result='',clock_updated_at=now()-interval '2 seconds',black_ms=1000 WHERE id=$1",
        [match.id],
      );
      assert.equal(
        (await (await call(path, 'GET', undefined, token)).json()).result,
        'Visitor wins on time',
      );
    } finally {
      await db.end();
    }
  },
);
async function upload(bytes, name, auth = owner) {
  const f = new FormData();
  f.append('title', 'OS integration ' + name);
  f.append('file', new Blob([bytes]), name);
  return fetch(base + '/admin/media/uploads', {
    method: 'POST',
    headers: auth ? { Authorization: 'Bearer ' + auth } : {},
    body: f,
  });
}
test('media validates files, protects private uploads, streams byte ranges and persists publication', async () => {
  assert.equal((await call('/admin/media', 'GET', undefined, '')).status, 401);
  assert.equal((await upload('bad', 'fake.mp3', '')).status, 401);
  assert.equal((await upload('not music', 'fake.mp3')).status, 400);
  for (const ext of ['mp3', 'mp4', 'm4a']) {
    const bytes = await readFile(
      new URL(
        '../../tests/fixtures/' + { mp3: 'tone.mp3', mp4: 'film.mp4', m4a: 'voice.m4a' }[ext],
        import.meta.url,
      ),
    );
    const r = await upload(bytes, 'sample.' + ext);
    assert.equal(r.status, 201);
    const item = await r.json();
    media.push(item.id);
    assert.equal(item.kind, ext === 'mp4' ? 'video' : 'audio');
    const content = '/media/' + item.id + '/content';
    assert.equal((await call(content, 'GET', undefined, '')).status, 404);
    assert.ok(
      !(await (await call('/media', 'GET', undefined, '')).json()).some((i) => i.id === item.id),
    );
    assert.equal(
      (await call('/admin/media/' + item.id, 'PUT', { title: item.title, published: true }, ''))
        .status,
      401,
    );
    assert.equal(
      (await call('/admin/media/' + item.id, 'PUT', { title: item.title, published: true })).status,
      200,
    );
    assert.ok(
      (await (await call('/media', 'GET', undefined, '')).json()).some((i) => i.id === item.id),
    );
    const range = await call(content, 'GET', undefined, '', { Range: 'bytes=0-31' });
    assert.equal(range.status, 206);
    assert.equal(range.headers.get('content-range'), `bytes 0-31/${bytes.length}`);
    assert.deepEqual(Buffer.from(await range.arrayBuffer()), bytes.subarray(0, 32));
    const suffix = await call(content, 'GET', undefined, '', { Range: 'bytes=-10' });
    assert.equal(suffix.status, 206);
    assert.deepEqual(Buffer.from(await suffix.arrayBuffer()), bytes.subarray(-10));
    assert.equal(
      (await call(content, 'GET', undefined, '', { Range: 'bytes=999999999-' })).status,
      416,
    );
    assert.equal(
      (await call(content, 'GET', undefined, '', { Range: 'bytes=0-1,4-5' })).status,
      416,
    );
    await call('/admin/media/' + item.id, 'PUT', { title: item.title, published: false });
    assert.equal((await call(content, 'GET', undefined, '')).status, 404);
    assert.equal((await call('/admin/media/' + item.id, 'DELETE', '', '')).status, 401);
    assert.equal((await call('/admin/media/' + item.id, 'DELETE')).status, 204);
    assert.equal((await call(content)).status, 404);
  }
});
test('hosted media links validate HTTPS and stay private until published', async () => {
  assert.equal(
    (
      await call('/admin/media/links', 'POST', {
        title: 'No',
        kind: 'video',
        url: 'javascript:alert(1)',
      })
    ).status,
    400,
  );
  const r = await call('/admin/media/links', 'POST', {
    title: 'Hosted film',
    kind: 'video',
    url: 'https://example.com/film.mp4',
  });
  assert.equal(r.status, 201);
  const item = await r.json();
  media.push(item.id);
  assert.equal(item.published, false);
  assert.equal((await call('/media/' + item.id + '/content', 'GET', undefined, '')).status, 404);
  const redirect = await fetch(base + '/media/' + item.id + '/content', {
    redirect: 'manual',
    headers: { Authorization: 'Bearer ' + owner },
  });
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get('location'), 'https://example.com/film.mp4');
});

test(
  'configured phone push validates subscriptions, sends a challenge, and removes expired devices',
  { skip: !process.env.LIBRARY_TEST_DATABASE_URL },
  async () => {
    const { createApp } = await import('../src/app.mjs');
    const { configuration } = await import('../src/config.mjs');
    const { default: webpush } = await import('web-push');
    const keys = webpush.generateVAPIDKeys();
    const config = {
      ...configuration(),
      vapidPublicKey: keys.publicKey,
      vapidPrivateKey: keys.privateKey,
      vapidSubject: 'mailto:test@example.com',
    };
    const db = new Pool({ connectionString: process.env.LIBRARY_TEST_DATABASE_URL });
    const server = createApp({ db, s3: {}, config }).listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    const local = `http://127.0.0.1:${server.address().port}/api/v1`;
    const endpoint = 'https://fcm.googleapis.com/fcm/send/test-' + Date.now();
    const subscription = { endpoint, keys: { p256dh: 'test_key', auth: 'test_auth' } };
    const send = webpush.sendNotification;
    let delivered = '',
      created = '';
    webpush.sendNotification = async (sub, payload) => {
      assert.equal(sub.endpoint, endpoint);
      delivered = JSON.parse(payload).body;
      throw Object.assign(new Error('Expired test device'), { statusCode: 410 });
    };
    const request = (path, method, body, token = owner) =>
      fetch(local + path, {
        method,
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    try {
      assert.equal(
        (await request('/admin/chess/push', 'POST', subscription, 'invalid')).status,
        401,
      );
      assert.equal(
        (
          await request('/admin/chess/push', 'POST', {
            ...subscription,
            endpoint: 'https://127.0.0.1/private',
          })
        ).status,
        400,
      );
      assert.equal((await request('/admin/chess/push', 'POST', subscription)).status, 204);
      const cfg = await (await fetch(local + '/chess/config')).json();
      assert.equal(cfg.publicKey, keys.publicKey);
      assert.equal(cfg.pushAvailable, true);
      assert.ok(!('privateKey' in cfg));
      const r = await request('/chess/matches', 'POST', { nickname: 'Push visitor' }, '');
      assert.equal(r.status, 201);
      created = (await r.json()).match.id;
      for (let i = 0; i < 100; i++) {
        if (
          delivered &&
          !(await db.query('SELECT 1 FROM chess_push_subscriptions WHERE endpoint=$1', [endpoint]))
            .rowCount
        )
          break;
        await new Promise((r) => setTimeout(r, 10));
      }
      assert.match(delivered, /Push visitor would like to play/);
      assert.equal(
        (await db.query('SELECT 1 FROM chess_push_subscriptions WHERE endpoint=$1', [endpoint]))
          .rowCount,
        0,
      );
    } finally {
      webpush.sendNotification = send;
      await db.query('DELETE FROM chess_push_subscriptions WHERE endpoint=$1', [endpoint]);
      if (created) await db.query('DELETE FROM chess_matches WHERE id=$1', [created]);
      await new Promise((r) => server.close(r));
      await db.end();
    }
  },
);
