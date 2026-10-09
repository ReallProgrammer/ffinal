import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { migrate } from '../src/migrations.mjs';

test(
  'legacy records survive migration, reconnection and repeated startup',
  { skip: !process.env.LIBRARY_TEST_DATABASE_URL },
  async () => {
    // Never touches the application's tables: all data lives in a new disposable schema.
    const pool = new Pool({ connectionString: process.env.LIBRARY_TEST_DATABASE_URL, max: 1 });
    const schema = 'migration_test_' + randomUUID().replaceAll('-', '');
    const shelf = randomUUID(),
      book = randomUUID(),
      asset = randomUUID();
    const metadata = {
      title: 'Preserved edition',
      author: 'Original author',
      width: 2,
      height: 3,
      thickness: 0.3,
    };
    const scoped = {
      connect: async () => {
        const c = await pool.connect();
        await c.query(`SET search_path TO ${schema}`);
        return c;
      },
    };
    try {
      await pool.query(`CREATE SCHEMA ${schema}`);
      const c = await scoped.connect();
      try {
        await c.query(await readFile(new URL('../src/schema.sql', import.meta.url), 'utf8'));
        await c.query('INSERT INTO shelves(id,name,position) VALUES($1,$2,7)', [
          shelf,
          'Existing shelf',
        ]);
        await c.query(
          "INSERT INTO assets(id,kind,original_key,mime,filename,bytes) VALUES($1,'front','original/key','image/png','original.png',10)",
          [asset],
        );
        await c.query(
          'INSERT INTO books(id,shelf_id,position,published,metadata,front) VALUES($1,$2,12,true,$3,$4)',
          [book, shelf, metadata, asset],
        );
      } finally {
        c.release();
      }
      await migrate(scoped);
      await migrate(scoped);
      const c2 = await scoped.connect();
      try {
        const {
          rows: [saved],
        } = await c2.query('SELECT * FROM books WHERE id=$1', [book]);
        assert.equal(saved.front, asset);
        assert.equal(saved.position, 12);
        assert.equal(saved.published, true);
        assert.equal(saved.metadata.title, metadata.title);
        assert.equal(saved.metadata.objectType, 'book');
        assert.equal(saved.metadata.presentation.textOverlay, false);
        assert.equal((await c2.query('SELECT * FROM library_migrations')).rowCount, 1);
        const policies = await c2.query(
          "SELECT relrowsecurity FROM pg_class JOIN pg_namespace ON pg_namespace.oid=relnamespace WHERE nspname=$1 AND relname IN ('assets','books','shelves','sessions')",
          [schema],
        );
        assert.equal(policies.rowCount, 4);
        assert.ok(policies.rows.every((r) => r.relrowsecurity));
      } finally {
        c2.release(true);
      }
      const c3 = await scoped.connect();
      try {
        assert.equal(
          (await c3.query('SELECT metadata FROM books WHERE id=$1', [book])).rows[0].metadata.title,
          metadata.title,
        );
      } finally {
        c3.release();
      }
    } finally {
      await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await pool.end();
    }
  },
);
