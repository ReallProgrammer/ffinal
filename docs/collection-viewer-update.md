# Collection viewer and owner cleanup

The update extends the existing Three.js collection, Express API, PostgreSQL and S3 storage. It needs no new credentials or service.

## Viewing and presentation

- Selected objects and editor previews use camera limits derived from their dimensions, scale, viewport and opened-case enclosure. Cursor zoom stays outside that enclosure, while far zoom stays within the presentation distance. Panning is bounded around the object.
- Left drag rotates, right drag pans, wheel zooms, and two-finger touch gestures pan/zoom. Reset returns to the fitted view. Reduced motion remains supported.
- Loading silhouettes visibly pulse in color and illumination and move subtly until all required assets are ready. Error silhouettes remain deliberate; reduced motion disables animation.
- Certificate frames use one continuous extruded frame around an inset backing. This removes coplanar overlapping side/corner surfaces that could show the white backing when rotating or zooming.
- All Collections is first and is the initial category. Certificates/Achievements follows it. The shelf chooser stays beside the left arrow. Required display metadata shows Unknown until supplied; empty values remain empty in storage so date/URL fields stay editable and Unknown never becomes a fabricated credential.
- Format selection uses recognizable book, award, disc, cassette, game and 3D icons. Published object choices use cover thumbnails with those icons as fallbacks. The Unused uploads and Add to Collection buttons have matching borders and height.

## Immediate owner cleanup

Single and bulk deletion use the owner session on the server. No browser confirmation popup is used for unused uploads or genres. Individual selection, selected deletion, and delete-all controls are available. Actual collection object deletion retains its separate confirmation.

`POST /api/v1/admin/assets/delete` and `POST /api/v1/admin/genres/delete` accept exactly one of `{ "ids": ["uuid", ...] }` or `{ "all": true }`. Asset cleanup rechecks every file under a database row lock; referenced uploads are retained. The response lists deleted IDs and per-file failures so partial storage failures can be retried. Delete-all targets only unused uploads.

Genre deletion runs in a transaction. It clears matching legacy metadata strings and cascades the many-to-many associations. Delete-all also clears orphaned legacy strings. Collection objects survive. The editor updates the active draft and refreshes its option list, preventing stale selections from making deleted genres appear again.

## Model imports

GLB/glTF no longer have fixed node, mesh, material, image, vertex or triangle count ceilings. Tests accept models above the old topology thresholds, including 900,003 vertices. Structural validation, static-model support, embedded-resource requirements, the 25 MB file limit, decoded-buffer/texture memory limits and the restricted conversion process remain in place. This update does not add USDZ, animation or skinning support.

## Loading latency and hosting

Measured from the cloud workspace before this change: the first live collection request took **24.4 seconds**, followed by a warm request taking **2.2 seconds**. These include proxy and network time, so they are not database-only timings. The current free Render service can sleep; it runs in Ohio, while the Supabase project is in Sydney.

After the backend update, consecutive requests measured **2.69, 1.53 and 1.45 seconds**. The later warm samples are lower than the earlier 2.2-second warm sample; network and proxy variability still apply. Cold-start delays remain a hosting constraint.

The list API now batches its independent reads into two dependent stages instead of six sequential database waits, and indexes asset/link lookups by ID. Required artwork surfaces load together, thumbnails reuse the same bounded source cache, and ordinary updates preserve the active scene and cached assets. Explicit refresh still clears failed resources. Initial metadata requests start without waiting for the Three.js import, and older overlapping responses cannot overwrite a newer list.

Recommended order:

1. Keep the existing providers and measure the new warm response time.
2. An always-on API instance removes Render's idle wake-up delay; this requires a hosting plan choice, not another application API.
3. Host the API nearer the database. Render Singapore is nearer the current Sydney project than Ohio. A provider supporting Sydney can colocate it more closely. Plan and verify any provider/region move with the existing database, bucket and owner settings.
4. If artwork delivery becomes the main bottleneck, published optimized derivatives can use a CDN (for example Supabase Storage). Originals and private documents must stay private; publication/unpublication would need synchronization. That optional change requires storage configuration and is not silently enabled by this release.

No new provider is required to complete the requested features. Changing region, purchasing hosting or changing bucket visibility is outside this code release.

## Verification

The real PostgreSQL/S3 integration suite covers owner-only bulk cleanup, associated and legacy genres, file conflicts and preserved referenced files. Delete-all tests run in an isolated database schema. Existing model, crop, upload, PDF, persistence and migration tests remain in place. Desktop/mobile browser checks exercise animated loading, near/far zoom limits, right-drag panning, category order, left shelf selection, matching buttons and popup-free cleanup against the actual local API.

Verified release checks: the production TypeScript/Vite build passes; all 31 backend tests pass, including migration and isolated cleanup tests. The full desktop run passed 43 checks; its initial single-wheel zoom test was corrected to use repeated wheel events, and both affected viewer/cleanup tests passed on re-run. The full mobile run passed 38 checks with six intentional existing desktop-only skips. Extreme near/far zoom and horizontal right-drag were exercised for books, certificates and generic models.
