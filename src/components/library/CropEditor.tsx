import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AssetKind,
  BookAsset,
  Crop,
  LibraryBook,
  LibraryRepository,
} from '../../lib/library/types';
import { artworkAsset, withArtwork } from '../../lib/library/types';
import { surfaceRatio, surfaceSize } from '../../lib/library/registry';
const BookPreview = lazy(() => import('./LibraryScene').then((m) => ({ default: m.BookPreview })));
export default function CropEditor({
  item,
  surface,
  repository,
  onSave,
  onClose,
}: {
  item: LibraryBook;
  surface: AssetKind;
  repository: LibraryRepository;
  onSave: (asset: BookAsset) => void;
  onClose: () => void;
}) {
  const asset = artworkAsset(item, surface)!;
  const [crop, setCrop] = useState<Crop>({
    x: asset.crop?.x ?? 0.5,
    y: asset.crop?.y ?? 0.5,
    zoom: asset.crop?.zoom ?? 1,
    ratio: surfaceRatio(item, surface),
  });
  const [source, setSource] = useState<HTMLImageElement>();
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [blob, setBlob] = useState<Blob>(),
    [version, setVersion] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | undefined>(undefined);
  useEffect(() => {
    let active = true,
      url = '';
    repository
      .original(asset.id)
      .then((b) => {
        url = URL.createObjectURL(b);
        const img = new Image();
        img.onload = () => {
          if (active) setSource(img);
        };
        img.onerror = () => {
          if (active) setError('Original artwork could not be decoded.');
        };
        img.src = url;
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [asset.id, repository]);
  useEffect(() => {
    if (!source || !canvas.current) return;
    const c = canvas.current,
      ctx = c.getContext('2d')!;
    const ratio = crop.ratio;
    c.width = Math.round(Math.min(720, 720 * ratio));
    c.height = Math.round(c.width / ratio);
    const cw = Math.min(source.width, source.height * ratio) / crop.zoom,
      ch = cw / ratio;
    ctx.drawImage(
      source,
      (source.width - cw) * crop.x,
      (source.height - ch) * crop.y,
      cw,
      ch,
      0,
      0,
      c.width,
      c.height,
    );
    const timer = setTimeout(
      () =>
        c.toBlob((b) => {
          if (b) {
            setBlob(b);
            setVersion((v) => v + 1);
          }
        }, 'image/webp'),
      120,
    );
    return () => clearTimeout(timer);
  }, [source, crop]);
  const previewBlob = useRef(blob);
  previewBlob.current = blob;
  const previewRepository = useMemo(
    () => ({
      ...repository,
      texture: (id: string, signal?: AbortSignal) =>
        id.startsWith('crop-preview-') && previewBlob.current
          ? Promise.resolve(previewBlob.current)
          : repository.texture(id, signal),
    }),
    [repository],
  );
  const preview = withArtwork(item, surface, { ...asset, id: 'crop-preview-' + version });
  const [w, h] = surfaceSize(item, surface);
  return (
    <section className="crop-editor" role="dialog" aria-label={`Crop ${surface} artwork`}>
      <header>
        <div>
          <small>SURFACE STUDIO / {surface.toUpperCase()}</small>
          <h2>Make every edge fit.</h2>
        </div>
        <button type="button" onClick={onClose} disabled={busy}>
          Cancel crop
        </button>
      </header>
      <p>
        Drag to reposition. The frame is exactly {crop.ratio.toFixed(3)}:1 · recommended {w} × {h}{' '}
        px. Keep text inside the dotted safe area.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="crop-layout">
        <div>
          <div className="crop-canvas-wrap" style={{ aspectRatio: crop.ratio }}>
            <canvas
              ref={canvas}
              aria-label="Crop artwork preview"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { x: e.clientX, y: e.clientY, cx: crop.x, cy: crop.y };
              }}
              onPointerMove={(e) => {
                if (!drag.current) return;
                const r = e.currentTarget.getBoundingClientRect(),
                  d = drag.current;
                setCrop((c) => ({
                  ...c,
                  x: Math.max(0, Math.min(1, d.cx - (e.clientX - d.x) / r.width)),
                  y: Math.max(0, Math.min(1, d.cy - (e.clientY - d.y) / r.height)),
                }));
              }}
              onPointerUp={() => {
                drag.current = undefined;
              }}
              onPointerCancel={() => {
                drag.current = undefined;
              }}
            />
          </div>
          {(['x', 'y', 'zoom'] as const).map((key) => (
            <label key={key}>
              {key === 'x'
                ? 'Horizontal position'
                : key === 'y'
                  ? 'Vertical position'
                  : 'Crop zoom'}
              <input
                aria-label={
                  key === 'x' ? 'Horizontal crop' : key === 'y' ? 'Vertical crop' : 'Crop zoom'
                }
                type="range"
                min={key === 'zoom' ? 1 : 0}
                max={key === 'zoom' ? 4 : 1}
                step=".01"
                value={crop[key]}
                onChange={(e) => setCrop({ ...crop, [key]: Number(e.target.value) })}
              />
            </label>
          ))}
          {source && (source.width / crop.zoom < w || source.height / crop.zoom < h) && (
            <p className="crop-warning">
              This crop has limited resolution. A larger original will look sharper.
            </p>
          )}
          <button type="button" onClick={() => setCrop({ ...crop, x: 0.5, y: 0.5, zoom: 1 })}>
            Reset crop
          </button>
          <button
            type="button"
            className="library-read-button"
            disabled={busy || !source}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                onSave(await repository.crop(asset.id, crop));
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Preparing saved texture…' : 'Apply crop'}
          </button>
        </div>
        <Suspense fallback={<p>Preparing 3D crop preview…</p>}>
          {blob && <BookPreview book={preview} repository={previewRepository} reduced />}
        </Suspense>
      </div>
    </section>
  );
}
