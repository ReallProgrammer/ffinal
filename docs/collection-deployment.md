# Collection Room deployment

Use the existing GitHub Pages frontend, Render Docker API and Supabase PostgreSQL/private storage. No new paid service, account or API key is required. Development uses the existing PostgreSQL container and loopback S3 emulator. All fixture credentials remain outside version control.

## Backend first

1. Back up the production PostgreSQL database before upgrading. Keep a separate copy of original uploads.
2. Deploy the new `server/` directory to Render using its Dockerfile. Keep one replica on the free service; uploads and image/model validation can be CPU-intensive on that tier.
3. Preserve the existing backend environment variables. For Supabase, use the session-pooler DATABASE_URL with `sslmode=verify-full`, its S3 endpoint and `S3_FORCE_PATH_STYLE=true`. Keep the bucket private and Supabase Data API disabled.
4. Keep the authentic Supabase CA certificate in Render Secret Files as `supabase-ca.crt`, and set `NODE_EXTRA_CA_CERTS=/etc/secrets/supabase-ca.crt`. Do not disable TLS verification.
5. Startup runs a transactionally locked, versioned migration. Existing book IDs, assets, publication state, metadata, sessions and shelf ordering are preserved. Existing books receive `objectType=book` and default presentation settings. The version-two migration adds optional model references, asset details and creation timestamps. It enables RLS on API-owned tables without public policies; the connection role must own these tables or have the required migration privileges. Do not use a public Supabase client key as database credentials.
6. Check `/api/v1/health`, `/api/v1/types`, and `/api/v1/collection`. The latter must return the existing collection. Existing `/library` and `/admin/books` routes remain compatible.
7. Deploy the frontend after the backend passes these checks. Keep GitHub Actions variable `LIBRARY_API_URL=https://YOUR-RENDER-SERVICE/api/v1` and run the Pages workflow on **main**, rather than rerunning a historical commit.

Render free instances can sleep. The UI reports API failures and supports retry; an idle wake-up can take time. Supabase storage/bandwidth quotas still apply. Models are capped at 25 MB, image originals at 10 MB and PDF/EPUB at 50 MB.

## New collection APIs

The existing session, shelf, asset and document contracts remain in force. `/collection` and `/admin/collection` alias public/owner library listing. Responses retain `books` for backward compatibility, now containing all object formats. `/types` returns the registry.

- `GET /items/:id`: visible item details; drafts require owner credentials.
- `POST /admin/items`, `PUT /admin/items/:id`, `DELETE /admin/items/:id`: owner CRUD.
- `PUT /admin/items/order`: complete UUID permutation, atomic, owner only.
- `POST /admin/uploads`: existing multipart `kind` and `file`; adds `kind=model`.
- `POST /admin/assets/:id/crop`: owner-only JSON `{x,y,zoom,ratio}`. x/y are normalized positions in the available crop travel (0–1), zoom is 1–4, ratio is width/height. Returns a new immutable asset with preserved original, optimized WebP, dimensions, crop and low-resolution flag. The original record remains private if unused; owner cleanup removes it explicitly.
- `GET /assets/:id`: optimized image or self-contained validated model, only if attached to a published item or authenticated owner. `?original=1` remains owner-only for originals.
- `/items/:id/read`: existing private/public document permissions. The browser renders actual PDF pages; EPUB uses sanitized reflowable text.

Common item fields retain title, description, genre, year, shelfId, position, published, dimensions and asset references. New fields are `objectType`, `details`, `presentation`, and optional model UUID. Derived `category` follows the registry and cannot be spoofed. Type-specific fields are strict: certificates cannot receive irrelevant book-publisher data. Uploaded typography is opt-in through `presentation.textOverlay`, false by default. Scale/rotation apply to generic models; dimensions determine their bounding box and shelf footprint.

GLB/glTF must embed all buffers and images. No external URI, scripts, compressed/unknown extensions, skinning or animations are accepted. Limits: 100 nodes, 80 meshes, 64 materials, 16 textures, 250,000 vertices/triangles including instances, 4096 px per texture edge and 24 million total texture pixels. Use a standard static glTF 2.0 export. Server validation checks binary structure and Khronos glTF validation before storage.

## Release from the review branch

The compatible backend was published first on main in commit `b30cd77`. Keep Render on main with the existing `server` root directory and environment settings; if automatic deployment is disabled, use Manual Deploy → Deploy latest commit. Once `/api/v1/types` returns the 13-format registry and the existing collection still loads, merge the collection pull request to publish the frontend. No new credentials or environment variables are required.

## Reproduce verification locally

Start PostgreSQL, storage emulator and API as described in library-deployment.md. Start the frontend with matching `VITE_LIBRARY_API_URL`. Use a private local credential file outside the checkout.

```sh
npm ci --cache /workspace/.cache/npm
npm ci --prefix server --cache /workspace/.cache/npm
node server/test/generate-fixtures.mjs
# Set LIBRARY_TEST_DATABASE_URL securely to the disposable local database URL
# to include the migration/reconnection test.
LIBRARY_TEST_CREDENTIALS=/private/path/owner.json npm test --prefix server
LIBRARY_TEST_CREDENTIALS=/private/path/owner.json PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test -- --workers=2
npm run build
```

The prebuild/predev script copies PDF.js fonts, character maps and WebAssembly support from the locked dependency into generated public assets; no external PDF service is used. The reader keeps nearby pages rather than rasterizing a whole document upfront. Model textures are fitted to a 4-million-pixel rendering budget (2 million on small screens), with a 1024 px edge limit. Textures and geometry are ref-counted and evicted after unused retention; closing/minimizing releases scene instances. Browser storage holds OS preferences only, never the collection source of truth.

Production verification requires the owner to log in, publish one real item, refresh, inspect it while signed out, and test its document. Local checks never upload fixture records to the production API. The cloud environment must allow the Render hostname for live read-only verification. Access has been restored and the existing health endpoint was verified before rollout.

The physical-media refinement adds an automatic v3 migration and native model conversion dependencies to the existing Docker image. See [collection-refinement.md](collection-refinement.md) for the extended API, formats, limits and validation. No new production credentials or services are needed. Keep the API-first release order; preserve the existing Supabase CA configuration and bucket.
