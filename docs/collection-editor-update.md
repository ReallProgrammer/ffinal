# Collection editing and viewing refinement

## Visitor experience

- The initial room opens the first shelf named Professional (case-insensitive), otherwise a shelf with published certificates, otherwise the first shelf. All shelves stays first in the selector. Previous/next arrows cycle through shelves.
- Category tabs only appear when that shelf has published objects in that category. Order: All Collections, Certificates/Achievements, Books, Games, Movies & Media, 3D Objects. Changing to a shelf without the current category resets to All Collections.
- Empty detail fields are omitted, including certificate credentials, dates and notes. Form placeholders no longer say Unknown.
- Zoom buttons change the current orbit distance without resetting angle or pan. Reset view explicitly restores framing. Auto-rotate keeps demand rendering active and respects reduced motion.
- Flat artwork opens a responsive thumbnail gallery with previous/next buttons, arrow keys, and independent zoom/pan per image. It uses uploaded front, spine, back and applicable insert/disc artwork; private wrap sources are excluded. No synthetic images are added.
- Open-case controls and the persistent interaction hint are removed. Game cases have clean spines without the exposed hinge cylinders and protruding latch pieces, flush top edges and a recessed seam opposite the spine.

## Owner editing

Artwork tabs show the applicable surfaces with thumbnails and file status. Only the chosen upload area is expanded. Physical dimensions and model orientation use sliders. Book order and publication year remain numeric metadata fields.

Full-wrap uploads automatically split back → spine → front using object dimensions. The original is retained privately, and all three generated surfaces are persisted. Boundary sliders allow correction and reapplication. Existing independently uploaded surfaces are preserved until a new wrap is applied.

Cover layers move by dragging, resize with the corner handle and rotate with the circular handle. Rotation follows the angle around the layer center in both mouse axes, continuously across the angle seam. Resizing uses the layer's local rotated axes. Numeric X/Y/width/height/rotation fields are removed; keyboard arrow positioning, undo, redo, locking, duplication and centering remain. Preview updates are debounced by 180 ms to avoid rebuilding GPU textures on every drag event.

Arrange your collection uses angled book/case illustrations with cover imagery and visible depth; generic models use a shaded thumbnail or recognizable 3D icon.

The creation editor shows one association checkbox per genre and a square trash button on the right. Bulk deletion remains in Manage genres. Genre category selection supports books, games (shared by PC/PS5/Xbox), media, certificates and objects, plus shared genres. Existing genres remain shared until the owner changes their category by renaming/editing them.

## Backend and deployment

Migration 4 adds validated genre categories and a unique index on `(category, lower(name))`, so books and games can have separate genres with the same name. Existing genre IDs and associations are retained. Legacy genre strings missing from the management list are migrated into managed records. Migration runs transactionally on startup and is repeatable.

POST/PUT `/admin/genres` accept optional `category` (defaults to `all` for existing clients). Collection responses include the category. Existing owner authentication protects all writes. Saves from current clients treat genre IDs as authoritative and clear obsolete legacy strings. Stale deleted IDs return 409 instead of silently reappearing. Deletion/rename and item saving acquire locks in the same order to avoid competing operations deadlocking.

No new credentials, providers or environment variables are needed. Deploy the backend before the new frontend because the older strict genre schema rejects the new category field. The existing Render/Supabase/GitHub Pages setup is reused.

## Verification

Backend: 32 tests pass against local PostgreSQL and S3 storage, including migration/reconnection, auth, category uniqueness, stale-genre rejection, bulk cleanup and three distinct wrap surface colors.

Browser: all six relevant desktop scenarios pass. The six mobile scenarios pass across the initial run and a clean rerun of the full-format/certificate checks after a development hot-reload interrupted the first run. Coverage includes every registered physical format, PDF reading, angular zoom preservation, animated loading, auto-rotate, immediate genre cleanup, automatic wrap splitting, layer dragging and gallery navigation. Production build and TypeScript checks pass. Final read-only deployment verification is recorded in the task report.
