import { useEffect, useRef, useState } from 'react';
import type {
  AssetKind,
  BookAsset,
  Crop,
  LibraryBook,
  LibraryRepository,
} from '../../lib/library/types';
import { artworkAsset } from '../../lib/library/types';
import { ImagePlus, FileUp } from 'lucide-react';
import CollectionThumbnail from './CollectionThumbnail';
import { surfaceRatio, surfaceSize } from '../../lib/library/registry';
export default function UploadField({
  item,
  disabled = false,
  kind,
  label,
  repository,
  onChange,
  onCrop,
  onBusy,
}: {
  item: LibraryBook;
  disabled?: boolean;
  kind: AssetKind;
  label?: string;
  repository: LibraryRepository;
  onChange: (asset: BookAsset | null) => void | Promise<void>;
  onCrop: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const asset = artworkAsset(item, kind),
    image = !['model', 'digital', 'manual'].includes(kind),
    size = surfaceSize(item, kind);
  const [pending, setPending] = useState<{
    file: File;
    url: string;
    width: number;
    height: number;
  } | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [focal, setFocal] = useState({ x: 0.5, y: 0.5 });
  useEffect(
    () => () => {
      if (pending) URL.revokeObjectURL(pending.url);
    },
    [pending],
  );
  const [status, setStatus] = useState(''),
    [progress, setProgress] = useState<number | null>(null),
    [error, setError] = useState(''),
    [filename, setFilename] = useState('');
  const controller = useRef<AbortController | null>(null),
    retry = useRef<File | null>(null),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  async function choose(file: File) {
    if (controller.current || disabled || pending) return;
    setError('');
    if (image && !['wrap', 'decal', 'gallery'].includes(kind)) {
      // Decode locally before any upload. Near matches (within 10%) resize directly.
      if (file.size > 10 * 1024 * 1024) {
        setError('Images must be no larger than 10 MB.');
        return;
      }
      onBusy(true);
      try {
        const bitmap = await createImageBitmap(file);
        const { width, height } = bitmap;
        bitmap.close();
        if (!mounted.current) return;
        const relative = width / height / surfaceRatio(item, kind);
        if (Math.max(relative, 1 / relative) > 1.1) {
          setPending({ file, url: URL.createObjectURL(file), width, height });
          setAdjusting(false);
          setFocal({ x: 0.5, y: 0.5 });
          return;
        }
      } catch {
        if (mounted.current) {
          setError('This image could not be read. Choose a PNG, JPEG or WebP image.');
          onBusy(false);
        }
        return;
      }
    }
    await upload(file);
  }
  function cancelReview() {
    setPending(null);
    onBusy(false);
  }
  async function upload(file: File, crop?: Crop) {
    if (controller.current) return;
    retry.current = file;
    const operation = new AbortController();
    controller.current = operation;
    setFilename(file.name);
    setError('');
    setStatus('Uploading');
    setProgress(0);
    onBusy(true);
    try {
      let uploaded = await repository.upload(
        file,
        kind,
        (p) => {
          if (mounted.current) {
            setProgress(p === 100 ? null : p);
            setStatus(p === 100 ? 'Validating file…' : 'Uploading');
          }
        },
        operation.signal,
      );
      if (operation.signal.aborted) throw new Error('Upload cancelled.');
      if (crop) {
        setStatus('Preparing cropped texture…');
        uploaded = await repository.crop(uploaded.id, crop);
        if (operation.signal.aborted) throw new Error('Upload cancelled.');
      }
      if (mounted.current) {
        await onChange(uploaded);
        setStatus('Ready');
        retry.current = null;
      }
    } catch (e) {
      if (mounted.current) {
        setError((e as Error).message);
        setStatus('');
      }
    } finally {
      controller.current = null;
      if (mounted.current) {
        setProgress(null);
        onBusy(false);
      }
    }
  }
  return (
    <div
      className="library-upload"
      data-kind={kind}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files[0]) void choose(e.dataTransfer.files[0]);
      }}
    >
      <strong>
        {label ||
          (kind === 'digital'
            ? 'Document'
            : kind === 'model'
              ? '3D model'
              : `${kind[0].toUpperCase() + kind.slice(1)} artwork`)}
      </strong>
      <small>
        {['wrap', 'decal', 'gallery'].includes(kind)
          ? 'PNG / JPEG / WebP · max 10 MB · original aspect ratio preserved'
          : image
            ? `${surfaceRatio(item, kind).toFixed(3)}:1 ratio · ${size[0]} × ${size[1]} px recommended · PNG / JPEG / WebP · 10 MB`
            : kind === 'model'
              ? 'GLB / GLTF / OBJ / STL / FBX / PLY · ZIP for companion textures · 25 MB'
              : 'PDF / EPUB · 50 MB'}
      </small>
      <label className="library-upload-visual">
        {asset && image ? (
          <CollectionThumbnail id={asset.id} repository={repository} color={item.color} />
        ) : image ? (
          <ImagePlus size={32} />
        ) : (
          <FileUp size={32} />
        )}
        <span>{asset ? 'Replace file' : 'Choose a file or drop it here'}</span>
        <input
          type="file"
          aria-label={`Upload ${label || kind}`}
          disabled={disabled || Boolean(controller.current) || Boolean(pending)}
          accept={
            image
              ? 'image/png,image/jpeg,image/webp'
              : kind === 'model'
                ? '.glb,.gltf,.obj,.stl,.fbx,.ply,.zip'
                : '.pdf,.epub'
          }
          onChange={(e) => {
            if (e.target.files?.[0]) void choose(e.target.files[0]);
            e.target.value = '';
          }}
        />
      </label>
      {pending && (
        <section
          className="artwork-ratio-review"
          role="dialog"
          aria-label="Review artwork proportions"
        >
          <strong>This image has different proportions.</strong>
          <p>
            {pending.width} × {pending.height} px supplied; this surface needs{' '}
            {surfaceRatio(item, kind).toFixed(3)}:1 ({size[0]} × {size[1]} px recommended).
          </p>
          <p>
            {adjusting
              ? 'Reposition the crop below. The original file will also be kept.'
              : 'Revise the image before uploading, crop it to fit, or upload the entire image stretched to the cover. Stretching a very different ratio can distort the artwork.'}
          </p>
          {adjusting && (
            <>
              <div
                className="artwork-ratio-preview"
                style={{
                  aspectRatio: surfaceRatio(item, kind),
                  width: Math.min(280, 280 * surfaceRatio(item, kind)),
                }}
              >
                <img
                  src={pending.url}
                  alt="Artwork crop before upload"
                  style={{ objectPosition: `${focal.x * 100}% ${focal.y * 100}%` }}
                />
              </div>
              {(['x', 'y'] as const).map((axis) => (
                <label key={axis}>
                  {axis === 'x' ? 'Horizontal crop position' : 'Vertical crop position'}
                  <input
                    aria-label={
                      axis === 'x' ? 'Horizontal crop position' : 'Vertical crop position'
                    }
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={focal[axis]}
                    onChange={(e) => setFocal({ ...focal, [axis]: Number(e.target.value) })}
                  />
                </label>
              ))}
            </>
          )}
          <div className="artwork-ratio-actions">
            <button type="button" onClick={cancelReview}>
              Revise image / cancel upload
            </button>
            <button
              type="button"
              onClick={() => {
                if (!adjusting) {
                  setAdjusting(true);
                  return;
                }
                const file = pending.file;
                setPending(null);
                void upload(file, { ...focal, zoom: 1, ratio: surfaceRatio(item, kind) });
              }}
            >
              {adjusting ? 'Upload with this crop' : 'Adjust crop before upload'}
            </button>
            <button
              type="button"
              onClick={() => {
                const file = pending.file;
                setPending(null);
                void upload(file);
              }}
            >
              Upload anyway — stretch to fit
            </button>
          </div>
        </section>
      )}
      <small>{filename || asset?.filename || 'No file uploaded'}</small>
      {status && (
        <div role="status">
          {status !== 'Ready' && <progress value={progress ?? undefined} max={100} />} {status}
          {progress !== null ? ` · ${progress}%` : ''}
        </div>
      )}
      {controller.current && (
        <button type="button" onClick={() => controller.current?.abort()}>
          Cancel upload
        </button>
      )}
      {error && (
        <div role="alert">
          {error}
          <button type="button" onClick={() => retry.current && void choose(retry.current)}>
            Retry upload
          </button>
        </div>
      )}
      {asset &&
        image &&
        !['wrap', 'gallery', 'decal'].includes(kind) &&
        (asset.lowResolution ||
          (asset.width || Infinity) < size[0] ||
          (asset.height || Infinity) < size[1]) && (
          <small className="crop-warning">
            Low resolution: a larger original will look sharper.
          </small>
        )}
      {asset && (
        <div>
          {image && !['wrap', 'decal', 'gallery'].includes(kind) && (
            <button type="button" onClick={onCrop}>
              Adjust {kind} crop
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setFilename('');
              setStatus('');
            }}
          >
            Remove {kind}
          </button>
        </div>
      )}
    </div>
  );
}
