# Deploy the personal 3D library

The frontend and backend deploy independently. GitHub Pages hosts the existing OS and the 3D client. A Node.js service hosts the API; PostgreSQL stores metadata and hashed owner sessions; a private S3-compatible bucket stores originals and textures. The owner has configured Render with Supabase PostgreSQL and private storage. For the multi-format upgrade, follow [Collection Room deployment](collection-deployment.md) before publishing the frontend. A fresh installation without an API shows a setup state; it never provides a bypass login or local publishing.

For a fresh setup with one provider, follow the [Railway walkthrough](library-railway.md).

## Production backend

1. Provision PostgreSQL and a private S3-compatible bucket. Enable the provider's public-access block. Grant the API identity only bucket inspection plus get/put/delete objects in this bucket. Keep its credentials in your backend host's secret settings.
2. Copy the configuration names from `server/.env.example` into the host. `DATABASE_URL` uses your provider's verified TLS configuration. Do not disable certificate verification. Leave `S3_ENDPOINT` unset for AWS, or set the provider's HTTPS endpoint. Set `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`.

   Set `S3_FORCE_PATH_STYLE=false` for virtual-hosted storage such as new Railway buckets. Set it to `true` only if your provider requires path-style URLs. When omitted, a custom endpoint defaults to path style for compatibility with the local emulator; AWS defaults to virtual-hosted style.

3. Set your `OWNER_EMAIL`. Generate `OWNER_PASSWORD_HASH` locally using the supplied scrypt helper. In Bash, this reads a password without echoing it or putting it into shell history:

   ```sh
   cd server
   read -r -s -p 'Owner password: ' library_password
   printf '\n'
   printf '%s' "$library_password" | npm run --silent owner-password
   unset library_password
   ```

   Put the resulting **hash** into the backend secret setting. Use a unique password of at least 14 characters. Neither plaintext password nor hash belongs in frontend configuration. There is no signup route; only this account can manage the library.

4. Set `FRONTEND_ORIGINS=https://reallprogrammer.github.io`, `NODE_ENV=production`, `HOST=0.0.0.0` and the host's `PORT`. Set `TRUST_PROXY_HOPS` to the hosting provider's documented exact proxy count; do not blindly trust arbitrary forwarded headers. Terminate HTTPS at the host's trusted reverse proxy. Allow request bodies up to 51 MB and upload/read timeouts sufficient for 50 MB books.
5. Deploy `server/` as its own service. Use Node 22.12+ (24 recommended), `npm ci --omit=dev`, then `npm start`, or build `server/Dockerfile` with `server/` as the build context. The container runs as the unprivileged `node` user. If your build network uses a private certificate authority, pass its trusted certificate with BuildKit `--secret id=build_ca,src=/path/to/ca.pem`; it is mounted only during dependency installation and is not baked into the image. TLS verification remains enabled. Environment files are excluded from the image. Startup creates the version-one tables in PostgreSQL and verifies the existing bucket. The database user needs migration permissions on these tables. The bucket is never made public.
6. Verify `GET https://your-api.example/api/v1/health` returns `{"status":"ok"}`. Use one API process unless you configure shared rate limiting. Arrange database/object backups and retention before storing valuable originals. To rotate an owner password after an account compromise, change its hash and `DELETE FROM sessions` in your database to revoke all sessions.

No paid services are provisioned by this repository. The optional local S3 emulator described below is **not** a production storage service.

## Connect the frontend

Set the GitHub repository Actions variable **`LIBRARY_API_URL`** to `https://your-api.example/api/v1`. The Pages workflow injects it as `VITE_LIBRARY_API_URL` at build time. Re-run the Pages deployment after changing it. Only the API URL is public; no owner credentials or storage keys enter the browser bundle.

For another frontend host, set `VITE_LIBRARY_API_URL` directly and `PAGES_BASE_PATH` to the deployment subpath if needed. Build with `npm ci && npm run build` and deploy `dist/`. Add the host's exact origin to the backend's `FRONTEND_ORIGINS`. The frontend and API may use separate domains.

Open **My Shelf → Owner access**, sign in, create shelves, and choose **Add book**. Upload actual covers and an optional digital edition, adjust dimensions, inspect the 3D preview, and save a draft or published edition. Selecting **Visitors may read and download when published** makes that digital file available publicly. Unpublishing removes the book and revokes public artwork/reading requests. Use **Unused uploads** to delete detached originals permanently. Sign-out revokes the session; page refresh intentionally requires a fresh owner login.

## Local development

The root frontend still works without a backend. For the complete workflow, use separate terminals. Docker is needed only for the local PostgreSQL service.

```sh
cd server
npm ci
# Refuses to overwrite an existing .env; secrets are generated locally.
read -r -s -p 'Local owner password: ' library_password
printf '\n'
printf '%s' "$library_password" | node scripts/configure-local.mjs your-email@example.com
unset library_password
docker compose --env-file .env -p ffinal-library up -d postgres
npm run storage:dev
```

`storage:dev` starts the S3 protocol emulator on loopback port 19000 and persists files at `/workspace/.library-objects` (override `DEV_STORAGE_DIRECTORY` outside the cloud workspace). It refuses `NODE_ENV=production`. It is only a development/test fixture; do not expose that port. The PostgreSQL named volume persists metadata across restarts. Do not run `docker compose down -v` unless you intentionally want to delete the local database.

In a second terminal:

```sh
cd server
npm run dev
```

In a third terminal from the repository root:

```sh
VITE_LIBRARY_API_URL=http://127.0.0.1:8787/api/v1 npm run dev -- --port 5173
```

For a local non-cloud workspace, supply a suitable `DEV_STORAGE_DIRECTORY`. Change `FRONTEND_ORIGINS` if your frontend uses a different origin. No test owner credentials are committed or included in the site.

## Verification

The server integration suite uses a running API, real PostgreSQL, and S3 storage (the local protocol emulator is supported). It creates and deletes only its own test records. Write an owner credential JSON file `{ "email": "...", "password": "..." }` with file permissions 0600 **outside the repository**, then point tests at that file; never commit it.

```sh
LIBRARY_TEST_CREDENTIALS=/private/path/owner.json npm test --prefix server
node server/test/generate-fixtures.mjs
LIBRARY_TEST_CREDENTIALS=/private/path/owner.json \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
npm test -- tests/library.spec.ts --workers=1
```

Use a disposable local test owner, not a production account. Set `LIBRARY_TEST_API` for a different local API base. The Playwright suite expects the development frontend to be started with the matching `VITE_LIBRARY_API_URL` and fixture files generated under `/tmp/library-fixtures`. The frontend tests skip the owner journey explicitly if the credential-file variable is absent; that skip is not proof that the backend works.

Server checks cover unauthorized writes, forged sessions, file validation, hidden drafts/private files, cover replacement, public reading, atomic reordering, unpublish, and server-side sign-out. Browser checks exercise the real editor, file uploads, cover-texture readiness, inspection, reading, refresh, edits and visitor restrictions. The existing OS regression suite remains available through `npm test`.

## Rendering and preservation

Books are real Three.js meshes, with separate cover boards, page blocks, spine faces, and independent textures. The scene is lazy-loaded only when needed, renders on demand, limits pixel density, and displays up to 16 collection objects per shelf page (8 on mobile). Optimized textures are prepared before revealing the complete object and reused during inspection; original high-resolution images are not loaded into the public scene. Minimized windows release their scene, and unused cached textures and geometries are released after a short retention window. Reduced motion skips camera/book easing. If WebGL is unavailable, the readable book index and detail/reading views remain usable; it never pretends a flat card is a 3D model.

The old IndexedDB collection is preserved as **Library → Local collection archive**. It is a read-only download archive, with saved local images still usable as wallpapers. It is not silently uploaded or published. The production library's source of truth is PostgreSQL plus private object storage, not localStorage or IndexedDB.
