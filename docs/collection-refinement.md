# Collection refinement

The collection extends the existing React/Three.js interface, Express API, PostgreSQL database and private S3 bucket. It retains shelf and object UUIDs, the existing owner account, original uploads, and the rest of the retro OS. No additional hosting account, credential or environment variable is required.

## What changed

- Artwork has a 1536 px overview variant and an on-demand detail variant up to 4096 px generated from the preserved original and its saved crop. The GPU uses up to 3072 px on desktop / 2048 px on mobile for the selected object. Material textures use mipmaps, linear filtering and anisotropy; DPR is capped at 2. Unused detail/model resources are evicted without disposing active resources. Missing required textures show a deliberate type-shaped loading/error object.
- Seventeen registered formats include CD jewel cases, PS3, PS4 and cassette cases. Media cases have hinged front panels, narrow spines, plastic edges, trays, retaining tabs and optional disc/cassette, interior art, booklet, card, insert and PDF/EPUB manual. Clicking a focused case or Open case animates its hinge. Escape closes the case before returning to the shelf.
- Surface uploads have local progress, server-processing status, cancellation, retry, filename and resolution guidance. Images retain their originals. Full-wrap uploads remain private sources; confirmed back/spine/front boundaries create separate replaceable image assets.
- Cover layers store normalized 2D position, size, rotation, order, lock state, text/font/color and image references. The editor has direct handles, snapping, centering, duplication, deletion and undo/redo. The renderer composites those layers into the object's actual material textures. Existing uploaded art has no automatic metadata overlay.
- Frame and case presets, material controls and dimension controls persist. Certificates also offer flat artwork viewing. Object/editor zoom follows the pointer; flat artwork and document views support anchored wheel/pinch zoom and panning. PDF pages render from the uploaded PDF at up to 2400 × 3200 pixels with a nearby-page cache.
- Objects can be placed before a chosen item or at the end of a chosen shelf before saving, with a dimension-aware 3D preview. Drag handles move objects across shelves and reorder shelves; keyboard pickup/cancel and exact placement remain available. Shelf editing includes name, width, depth, spacing and wood tint. Deleting an occupied shelf requires selecting and confirming a destination for its contents.
- Managed genres are independent many-to-many records; visitors can combine genre filters (matching any selected genre), remove individual filters, or clear them. Tags remain separate. Optional book numbers, book order and the book-index toggle belong to Books. Other categories retain accessible object navigation without book numbering.
- Collection audio uses the taskbar's global sound/volume state. Duplicate collection audio controls are removed. Cue gain and a shared compressor improve audibility and limit peaks; playback still follows browser gesture restrictions.

## Persistence and permissions

Migration 3 adds `assets.detail_key`, `assets.normalized_key`, additional asset roles, `book_assets`, `genres`, `book_genres`, and shelf appearance. It converts existing genre strings into associations and enables RLS on new tables. It does not replace existing shelves, objects or uploads. Re-running migration/startup is safe.

All writes use the existing server-side owner session check. Item saving, asset references, genre associations and placement are committed together. Placement validates destination membership and optionally the expected order/source shelf under a database lock. Stale placements return 409. Shelf content transfers and deletion share a transaction. Public file requests check current publication/access state on every request; original art, wrap sources and private manuals remain protected.

Additional endpoints (under `/api/v1`):

| Endpoint | Purpose |
| --- | --- |
| `PUT /admin/items/:id/place` | Exact placement with `shelfId`, `beforeId`, optional `expectedIds` and `expectedShelfId` |
| `POST /admin/assets/:id/split` | Three contiguous confirmed wrap panels |
| `POST /admin/genres` | Create a genre |
| `PUT /admin/genres/:id` | Rename a genre |
| `DELETE /admin/genres/:id` | Remove genre associations without deleting objects |
| `PUT /admin/shelves/:id` | Save name and appearance |
| `DELETE /admin/shelves/:id` | Optional `moveTo` destination for contents |
| `GET /assets/:id?quality=detail` | Authorized optimized close-up artwork |
| `GET /items/:id/read?role=manual` | Authorized PDF/EPUB manual |

Existing item CRUD, ordering, upload, crop and reading routes remain available. Older clients may echo read-side artwork descriptors; the server normalizes their IDs before the same asset-role checks.

## Model imports and runtime

GLB and embedded glTF remain supported. OBJ, STL, FBX and PLY are converted using Assimp through the included Python helper. A ZIP can contain exactly one model and its MTL/buffer/PNG/JPEG/WebP companions; glTF with external files must use this ZIP route. Original bytes remain private, while the viewer receives validated self-contained glTF. OBJ material textures are preserved. Assimp 5.2's obsolete specular/glossiness material extension is converted to a core PBR approximation.

The Dockerfile installs Python 3, `libassimp5` and `util-linux`. Native local development needs those equivalents; the cloud environment already provides Python, libassimp 5.4 and `/usr/bin/prlimit`. The converter reads only files inside its upload directory through restricted Assimp I/O callbacks, uses a stripped environment, 256 MiB address-space / 15-second CPU / 20-second wall-time limits, and cleans its temporary directory. Archive paths, duplicate names, symlinks, encryption, file count and expanded size are checked. Resulting files pass the existing glTF geometry, texture, external-resource and scene validation before storage.

Limits: 25 MB model upload; 128 archive entries / 64 MB expanded archive; static models only; 250,000 vertices and triangles; 100 nodes, 80 meshes, 64 materials and 16 textures. Complex models may exceed conversion memory/time limits below those ceilings. **USDZ, animation, skinning and arbitrary external resources are not supported.** FBX-specific shaders may need re-export to GLB for exact material matching. EPUB remains a sanitized reflowable text reader; PDF has the page-turning reader.

The dependency audit currently reports a high-severity advisory on the locked Sharp 0.34.5 native dependency stack with no available npm fix. Uploads and embedded model textures are sniffed as PNG/JPEG/WebP before decoding; SVG/HEIF uploads are rejected. This restriction does not substitute for an upstream patch. Recheck the audit when a patched Sharp release is available.

## Verification and release

Run the backend suite with private local test credentials, and the migration test with an isolated local database URL. Run Playwright with system Chromium and the real local API; restart only the local test API between complete desktop/mobile project runs to avoid accumulating login attempts across suites. The production Docker image must also pass API and conversion tests: its Debian Assimp version differs from the cloud host.

Tests cover all registered formats, owner/public permissions, immutable crops, wrap panel pixels, layer references, high-quality variants, genre persistence, stale placement rejection, occupied-shelf transfers, model conversion and unsafe archives, real uploads, publication, case opening/closing, manual reading, PDF turns, crop preview, layer undo/redo, drag placement, keyboard cancel, flat zoom, responsive layouts and unrelated OS behavior.

Release the backend first, verify its type registry and health, then publish the frontend to GitHub Pages. Compare the live public item/shelf IDs and asset references before and after rollout. Production owner writes are not used for smoke testing; test fixtures stay local. Originals and private records are never copied into the repository or frontend bundle.

### Verified on 2026-10-10

- TypeScript and the production Vite build pass.
- The production-mode Docker API suite passes 27 tests; its migration case was run separately against an isolated legacy database and passed. The latest API compatibility tests and the native model-import tests also pass.
- The full desktop/mobile regression runs covered 82 browser cases. Three failures caused by texture-ready timing, fixture pagination and shared trace output were resolved; all eight affected collection/library checks passed together on re-run. Six mobile-only skips are intentional existing desktop-interaction exclusions. The refinement workflow passes on desktop and mobile against the real local API.
- Combined genre filtering is additionally verified on desktop and mobile, including multi-genre items, adding/removing filters and clearing the selection.
- Backend rollout preserved all four public item IDs, the two Astro/Astro2 shelf IDs, shelf assignments and primary asset references. Production smoke checks use public reads only.

For concurrent Playwright invocations, use distinct `--output` directories to avoid trace cleanup collisions. Test credentials, local fixtures and deployment snapshots remain outside source control.
