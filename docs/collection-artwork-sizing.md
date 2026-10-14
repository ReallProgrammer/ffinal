# Cover sizing and manual viewing

PlayStation 4 and 5 presets use front/back proportions of **1795 × 2551**, with a **189 × 2551** spine. Their scene dimensions are 1.795 × 2.551 × 0.189. PlayStation 3 uses **1748 × 2150** front/back artwork and scene dimensions 1.748 × 2.15 × 0.22. Exact pixel dimensions, rather than the approximate “2:3” description, determine these proportions. Custom physical dimensions update the upload guidance to match the actual surface.

For all individual artwork surfaces, an image within 10% of the required aspect ratio uploads directly and resizes edge-to-edge. A larger difference pauses **before network upload**. The owner can cancel to revise the source, adjust a crop locally before uploading, or explicitly upload the entire image stretched to fit. The warning explains possible distortion. Crop uploads retain the original image and use the existing authenticated crop API. Wrap artwork, gallery photographs and sticker layers preserve their independent proportions and do not use this gate.

Textures and the layer editor use the same full-surface sizing. Case front/back inserts fill the complete face, VHS artwork maps directly onto its body, and case hinge protrusions are removed for every preset. Framed certificates still reserve their physical frame. Original files, independent cover surfaces, gallery photographs and optional sticker layers remain separate assets.

Manual PDFs use a flat, single-page document viewer with page navigation, arrow keys, zoom and fullscreen. They do not show the game's cover as a book cover or use book page-turn animations. Book PDFs retain the existing book reader. The flat artwork gallery reserves space for its arrows outside the clipped zoom viewport.

## Deployment

No additional services, credentials or environment variables are needed. Migration 6 runs transactionally on API startup. It corrects only PS3/PS4/PS5 items whose saved width, height and thickness exactly match the former shared default (2.15 × 2.65 × 0.22). Other case types, custom dimensions, metadata, publication settings and asset references are preserved. New objects and preset selection use the updated definitions.

## Verification

The production build passes. All 32 backend tests pass, including migration idempotence, blank/missing preset fallbacks, custom dimension preservation, authorization and persistent assets. The desktop owner workflow and four mobile workflows pass against the local API/database/storage. They cover all 17 formats, near-ratio uploads, no-upload cancellation, pre-upload cropping, actual 3D texture edge pixels, preset dimensions, action spacing, category return, clipped gallery zoom, and flat manual page/keyboard navigation.
