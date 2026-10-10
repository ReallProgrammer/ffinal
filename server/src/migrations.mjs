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
    if (!(await c.query('SELECT 1 FROM library_migrations WHERE version=3')).rowCount) {
      await c.query(`
        ALTER TABLE assets DROP CONSTRAINT assets_kind_check;
        ALTER TABLE assets ADD CONSTRAINT assets_kind_check CHECK(kind IN ('front','spine','back','digital','model','disc','interior','booklet','card','insert','wrap','decal','manual'));
        ALTER TABLE assets ADD COLUMN detail_key text;
        ALTER TABLE assets ADD COLUMN normalized_key text;
        ALTER TABLE shelves ADD COLUMN appearance jsonb NOT NULL DEFAULT '{}';
        CREATE TABLE book_assets(book_id uuid REFERENCES books(id) ON DELETE CASCADE, role text NOT NULL, asset_id uuid NOT NULL REFERENCES assets(id), PRIMARY KEY(book_id,role));
        CREATE INDEX book_assets_asset ON book_assets(asset_id);
        CREATE TABLE genres(id uuid PRIMARY KEY, name varchar(80) NOT NULL);
        CREATE UNIQUE INDEX genres_name ON genres(lower(name));
        CREATE TABLE book_genres(book_id uuid REFERENCES books(id) ON DELETE CASCADE, genre_id uuid REFERENCES genres(id) ON DELETE CASCADE, PRIMARY KEY(book_id,genre_id));
        INSERT INTO genres(id,name) SELECT DISTINCT ON(lower(trim(metadata->>'genre'))) md5('collection-genre:' || lower(trim(metadata->>'genre')))::uuid,trim(metadata->>'genre') FROM books WHERE length(trim(coalesce(metadata->>'genre','')))>0 ON CONFLICT DO NOTHING;
        INSERT INTO book_genres SELECT b.id,g.id FROM books b JOIN genres g ON lower(trim(b.metadata->>'genre'))=lower(g.name);
        ALTER TABLE book_assets ENABLE ROW LEVEL SECURITY;
        ALTER TABLE genres ENABLE ROW LEVEL SECURITY;
        ALTER TABLE book_genres ENABLE ROW LEVEL SECURITY;
        INSERT INTO library_migrations(version) VALUES(3);
      `);
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
