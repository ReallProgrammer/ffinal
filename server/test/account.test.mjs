import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { createApp } from '../src/app.mjs';
import { configuration } from '../src/config.mjs';
test(
  'only the existing owner can sign in by username or email; guests cannot register',
  { skip: !process.env.LIBRARY_TEST_DATABASE_URL },
  async () => {
    const config = configuration(),
      db = new Pool({ connectionString: process.env.LIBRARY_TEST_DATABASE_URL });
    const server = createApp({ db, s3: {}, config }).listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    const base = `http://127.0.0.1:${server.address().port}/api/v1`;
    const owner = JSON.parse(await readFile(process.env.LIBRARY_TEST_CREDENTIALS, 'utf8'));
    const post = (body) =>
      fetch(base + '/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    const tokens = [];
    try {
      assert.equal((await post({ username: 'guest', password: owner.password })).status, 401);
      assert.equal(
        (await post({ username: config.ownerUsername, password: 'incorrect-test-password' }))
          .status,
        401,
      );
      assert.equal(
        (
          await post({
            email: owner.email,
            username: config.ownerUsername,
            password: owner.password,
          })
        ).status,
        400,
      );
      for (const identity of [
        { username: config.ownerUsername.toUpperCase() },
        { email: owner.email },
      ]) {
        const response = await post({ ...identity, password: owner.password });
        assert.equal(response.status, 200);
        const { token } = await response.json();
        tokens.push(token);
        assert.equal(
          (
            await fetch(base + '/admin/collection', {
              headers: { Authorization: 'Bearer ' + token },
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await fetch(base + '/session', {
              method: 'DELETE',
              headers: { Authorization: 'Bearer ' + token },
            })
          ).status,
          204,
        );
        assert.equal(
          (
            await fetch(base + '/admin/collection', {
              headers: { Authorization: 'Bearer ' + token },
            })
          ).status,
          401,
        );
      }
      assert.equal((await fetch(base + '/signup', { method: 'POST' })).status, 404);
    } finally {
      await new Promise((r) => server.close(r));
      await db.end();
    }
  },
);
