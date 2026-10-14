import { useEffect, useRef, useState } from 'react';
import type { AssetKind, BookAsset, LibraryBook, LibraryRepository } from '../../lib/library/types';
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
  async function upload(file: File) {
    if (controller.current || disabled) return;
    retry.current = file;
    const operation = new AbortController();
    controller.current = operation;
    setFilename(file.name);
    setError('');
    setStatus('Uploading');
    setProgress(0);
    onBusy(true);
    try {
      const uploaded = await repository.upload(
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
        if (e.dataTransfer.files[0]) void upload(e.dataTransfer.files[0]);
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
          disabled={disabled || Boolean(controller.current)}
          accept={
            image
              ? 'image/png,image/jpeg,image/webp'
              : kind === 'model'
                ? '.glb,.gltf,.obj,.stl,.fbx,.ply,.zip'
                : '.pdf,.epub'
          }
          onChange={(e) => {
            if (e.target.files?.[0]) void upload(e.target.files[0]);
            e.target.value = '';
          }}
        />
      </label>
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
          <button type="button" onClick={() => retry.current && void upload(retry.current)}>
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
