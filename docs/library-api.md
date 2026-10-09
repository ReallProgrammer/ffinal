# Library API v1

The independently deployable API lives in `server/`. The frontend depends on the `LibraryRepository` contract in `src/lib/library/types.ts`; the Three.js scene receives books and a texture loader, with no database or provider dependencies.

Base URL: `VITE_LIBRARY_API_URL`, including `/api/v1`. JSON errors have `{ "error": "User-facing message" }`. Invalid fields/files return 400, missing authentication 401, forbidden original-art access 403, unavailable private resources 404, conflicting references/order 409, upload limit 413, and rate limits 429. Unexpected failures return generic 500 errors. No secret or storage key is returned.

## Identity and permissions

There is exactly one configured owner. There is no registration endpoint, client-side password, shared admin key, or public write permission. Owner sign-in validates a salted scrypt password hash. Random 256-bit bearer sessions are hashed in PostgreSQL and expire after eight hours. The frontend keeps its bearer token in memory; a browser refresh requires signing in again. `DELETE /session` revokes it on the server. All `/admin/*` handlers check the database session before accepting mutations or multipart data.

Requests use `Authorization: Bearer <session>`. No authentication cookies are used, avoiding third-party cookie and cookie-based CSRF problems for GitHub Pages. CORS allows only configured frontend origins; CORS is not used as authentication. Sign-in is rate limited to 10 attempts per IP per 15 minutes; upload is limited to 30 per minute. Limits are process-local: use one API instance, or add shared rate-limit storage before horizontal scaling. Configure the exact trusted proxy hop count for your hosting provider so rate limiting uses the correct client address.

## Routes

| Method       | Route                    | Access and result                                                              |
| ------------ | ------------------------ | ------------------------------------------------------------------------------ |
| GET          | `/health`                | Database readiness, `{status:"ok"}`                                            |
| POST         | `/session`               | `{email,password}` → `{token,expiresIn,email}`                                 |
| GET / DELETE | `/session`               | Owner identity / revoke current session                                        |
| GET          | `/library`               | Published book metadata and ordered shelves                                    |
| GET          | `/admin/library`         | Owner; all editions, including drafts                                          |
| POST         | `/admin/shelves`         | Owner; `{name}` → `{id}`                                                       |
| PUT / DELETE | `/admin/shelves/:id`     | Rename / delete an empty shelf                                                 |
| PUT          | `/admin/shelves/order`   | Owner; `{ids:[all shelf UUIDs once]}`                                          |
| POST         | `/admin/uploads`         | Owner; multipart `kind` + `file` → asset descriptor                            |
| POST         | `/admin/books`           | Owner; create a saved edition → `{id}`                                         |
| PUT / DELETE | `/admin/books/:id`       | Owner; replace editable metadata / delete edition                              |
| PUT          | `/admin/books/order`     | Owner; `{ids:[all book UUIDs once]}`                                           |
| GET          | `/assets/:id`            | Optimized artwork only if attached to a published book, or authenticated owner |
| GET          | `/assets/:id?original=1` | Owner only; preserved original artwork                                         |
| GET          | `/books/:id/read`        | Owner, or a published edition explicitly marked public-reading                 |
| GET          | `/admin/assets`          | Owner; unused private uploads                                                  |
| DELETE       | `/admin/assets/:id`      | Owner; remove an unused original and texture from storage                      |

Shelves have `{id,name,position}`. Shelf names are public, including empty shelves. Book descriptions and titles are escaped as text; they are never rendered as HTML.

Book writes contain `title`, `author`, `description`, `genre`, nullable `year`, `isbn`, `color` (hex), `height` (1.6–3.6), `width` (1–2.6), `thickness` (0.12–0.8), `shelfId`, `published`, `digitalAccess` (`private` or `public`), and nullable UUID asset references `front`, `spine`, `back`, `digital`. The schema rejects unknown fields. Relative dimensions determine actual mesh proportions. Creation assigns a stable UUID and order; ordering updates are atomic and require a complete permutation. Each asset reference must exist and match its role.

Library reads return book metadata plus `id`, `position`, `updatedAt`, `canRead`, and descriptors `{id,mime,filename}` for artwork. Unavailable private digital files return `digital:null, canRead:false` to visitors. Publishing requires an uploaded front cover. Reading is **private by default** and must be explicitly made public. A public-reading edition permits visitor downloads; this is access control, not DRM.

## Upload and delivery pipeline

PNG/JPEG/WebP cover originals are limited to 10 MB and 40 million decoded pixels. Magic bytes and the image decoder validate the file; animation and SVG are rejected. Originals are stored privately. Sharp applies orientation and produces a WebP texture bounded by 1024 × 1536 while preserving aspect ratio. The renderer places artwork proportionally on each face without cropping or mirroring. Generated cloth/spine/back designs are identified in the editor and book details.

PDF/EPUB files are limited to 50 MB. PDFs must parse, have at least one page, and not require a password. EPUB archives must contain the expected mimetype/container, have safe paths, no encryption, at most 5,000 entries and 150 MB expanded size. Original PDFs are served for the browser's native viewer; EPUB chapters are extracted as escaped text, with scripts, embedded frames and styles removed. No EPUB HTML or external asset is executed in the app. Images/layout-heavy EPUBs can be downloaded for a full reader.

All S3 objects are private. The API streams authorized files through itself, so the browser needs no S3 credentials or bucket CORS policy. There are no permanent public object URLs or signed links surviving unpublish. Responses use `Cache-Control: no-store`. Unpublishing revokes subsequent requests immediately; files already downloaded cannot be recalled. Back up both PostgreSQL and object storage.

Replacing a cover or deleting an edition leaves unused assets private, visible to the owner under **Unused uploads**. This protects recoverable originals and supports explicit permanent deletion. Deleting referenced assets and nonempty shelves is rejected.
