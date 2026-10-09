# Personal Collection Room: audit and architecture

## Audit (October 9, 2026)

The existing React 19/Vite/Three.js application already has a window manager, local archive, real owner editor, and independent Express API. PostgreSQL retains books, shelves, assets and hashed sessions. S3 retains originals and optimized WebP images. Authentication uses a single configured owner and server-side session checks. Render/Supabase and GitHub Pages have been configured by the owner. This workspace cannot currently reach the Render hostname; the last successful production health check was supplied by the owner. No production credentials are needed in chat or source control.

The implementation needs multiple object types, crop variants, GLB/embedded GLTF validation, texture readiness/caching, isolated presentation and a page-rendered PDF reader. Reuse the backend, authentication, storage, OS window and legacy archive. Do not replace unrelated applications.

## Architecture

- A shared JSON registry in server/src describes category, geometry, surfaces, recommended dimensions and type-specific metadata. The frontend imports the same registry used by validation.
- Preserve books and their UUIDs as the compatibility storage table. Add type, type-specific details, presentation and model references through an additive, versioned migration. `/collection` and `/admin/items` extend the API; existing `/library` and book endpoints remain compatible.
- Separate metadata from presentation. Uploaded textures never acquire automatic text; generated surfaces and explicit optional typography are distinct choices.
- Images retain immutable originals. A crop request creates a new immutable optimized asset using normalized focal point, zoom and aspect ratio. Saving references that variant. Replacements have new IDs, so cached artwork cannot stay stale.
- Models must be self-contained GLB or embedded GLTF, with bounded bytes, geometry, nodes and embedded image resolution. External resources, unsupported extensions and malformed models are rejected before object storage.
- Public asset access is tied to published items. Private documents still require owner authentication. Every mutation, crop and upload uses the existing server-side owner middleware.
- A ref-counted texture/model cache prepares all required resources before revealing an object. Only displayed objects are loaded; originals stay private. Idle unused resources are evicted with a bounded cache.
- Registry-selected geometries use actual mesh materials on the relevant faces. Focus isolates the object from the entire shelf, supports reduced motion and returns it to its dimension-aware slot.
- PDF.js renders real pages, lazily around the visible spread. A perspective page-turn view uses those canvases, keyboard/touch controls and actual document outline. EPUB retains the existing sanitized text reader.

## Configuration

Reuse DATABASE_URL, S3_BUCKET, S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, OWNER_EMAIL, OWNER_PASSWORD_HASH, FRONTEND_ORIGINS and VITE_LIBRARY_API_URL / GitHub LIBRARY_API_URL. Render uses NODE_EXTRA_CA_CERTS=/etc/secrets/supabase-ca.crt, with the genuine Supabase CA secret file, and DATABASE_URL uses sslmode=verify-full. Supabase Data API stays disabled and storage private. No new service is required.

New reference screenshots and final personal artwork have not been supplied for this upgrade. Test fixtures are clearly test content, never production collection items. Existing private local credentials support development tests; production credentials remain with the owner. See collection-deployment.md for rollout and verification.
