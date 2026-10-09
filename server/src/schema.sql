CREATE TABLE IF NOT EXISTS shelves (
 id uuid PRIMARY KEY, name varchar(100) NOT NULL, position integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS assets (
 id uuid PRIMARY KEY, kind varchar(10) NOT NULL CHECK (kind IN ('front','spine','back','digital')),
 original_key text NOT NULL, texture_key text, mime text NOT NULL, filename text NOT NULL,
 bytes integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS books (
 id uuid PRIMARY KEY, shelf_id uuid NOT NULL REFERENCES shelves(id) ON DELETE RESTRICT,
 position integer NOT NULL DEFAULT 0, published boolean NOT NULL DEFAULT false,
 metadata jsonb NOT NULL, front uuid REFERENCES assets(id), spine uuid REFERENCES assets(id),
 back uuid REFERENCES assets(id), digital uuid REFERENCES assets(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS books_shelf_position ON books(shelf_id, position);
CREATE INDEX IF NOT EXISTS books_published ON books(published);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash char(64) PRIMARY KEY, expires_at timestamptz NOT NULL
);
