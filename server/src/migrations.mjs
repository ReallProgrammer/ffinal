import { readFile } from 'node:fs/promises';
export async function migrate(db) {
  const c = await db.connect();
  try {
    await c.query('BEGIN');
    await c.query('SELECT pg_advisory_xact_lock(78245001)');
    await c.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
    await c.query(
      'CREATE TABLE IF NOT EXISTS library_migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const { rowCount } = await c.query('SELECT 1 FROM library_migrations WHERE version=2');
    if (!rowCount) {
      await c.query(`ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_kind_check;
    ALTER TABLE assets ADD CONSTRAINT assets_kind_check CHECK (kind IN ('front','spine','back','digital','model'));
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}';
    ALTER TABLE books ADD COLUMN IF NOT EXISTS model uuid REFERENCES assets(id);
    ALTER TABLE books ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
    UPDATE books SET metadata=metadata || '{"objectType":"book","details":{},"presentation":{"frame":true,"roughness":0.65,"textOverlay":false,"scale":1,"rotation":[0,0,0]}}'::jsonb WHERE NOT metadata ? 'objectType';
    CREATE INDEX IF NOT EXISTS books_object_type ON books ((metadata->>'objectType'));
    INSERT INTO library_migrations(version) VALUES(2);`);
    }
    // The API's table-owning DB role remains functional. Untrusted Data API roles get no policies.
    for (const table of ['books', 'assets', 'shelves', 'sessions', 'library_migrations'])
      await c.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}
