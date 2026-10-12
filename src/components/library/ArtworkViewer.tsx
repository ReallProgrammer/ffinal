import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { BookAsset, LibraryBook, LibraryRepository } from '../../lib/library/types';
import { sourceBlob } from '../../lib/library/asset-cache';
import CollectionThumbnail from './CollectionThumbnail';
import ZoomSurface from './ZoomSurface';
export default function ArtworkViewer({
  item,
  repository,
  onClose,
}: {
  item: LibraryBook;
  repository: LibraryRepository;
  onClose: () => void;
}) {
  const pictures = useMemo(() => {
    const entries: [string, BookAsset | null | undefined][] = [
      ['Front', item.front],
      ['Spine', item.spine],
      ['Back', item.back],
      ...Object.entries(item.artwork || {}).filter(
        ([role]) => !['manual', 'decal', 'wrap'].includes(role),
      ),
    ];
    const seen = new Set<string>();
    return entries.flatMap(([label, asset]) => {
      if (!asset?.mime.startsWith('image/') || seen.has(asset.id)) return [];
      seen.add(asset.id);
      return [{ label, asset }];
    });
  }, [item]);
  const [index, setIndex] = useState(0),
    [url, setUrl] = useState(''),
    [error, setError] = useState('');
  const current = pictures[index];
  const change = (direction: number) =>
    setIndex((n) => (n + direction + pictures.length) % pictures.length);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        if (pictures.length > 1)
          setIndex(
            (n) => (n + (e.key === 'ArrowRight' ? 1 : -1) + pictures.length) % pictures.length,
          );
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [pictures.length]);
  useEffect(() => {
    let live = true,
      u = '';
    setUrl('');
    setError('');
    if (current)
      sourceBlob(repository, current.asset.id, 'detail')
        .then((blob) => {
          u = URL.createObjectURL(blob);
          if (live) setUrl(u);
          else URL.revokeObjectURL(u);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    return () => {
      live = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [current?.asset.id, repository]);
  return (
    <section className="artwork-viewer" role="dialog" aria-label={`Artwork ${item.title}`}>
      <header>
        <h2>{item.title}</h2>
        <button onClick={onClose}>Close artwork</button>
      </header>
      <div className="artwork-gallery-stage">
        {pictures.length > 1 && (
          <button className="gallery-prev" aria-label="Previous artwork" onClick={() => change(-1)}>
            <ChevronLeft />
          </button>
        )}
        {error ? (
          <p role="alert">{error}</p>
        ) : url ? (
          <ZoomSurface key={current.asset.id}>
            <img src={url} alt={`${item.title} — ${current.label}`} draggable={false} />
          </ZoomSurface>
        ) : (
          <p role="status">Preparing high-resolution artwork…</p>
        )}
        {pictures.length > 1 && (
          <button className="gallery-next" aria-label="Next artwork" onClick={() => change(1)}>
            <ChevronRight />
          </button>
        )}
      </div>
      <footer className="artwork-gallery-footer">
        <span aria-live="polite">
          {current?.label} · {index + 1} / {pictures.length}
        </span>
        <div className="artwork-gallery-thumbnails" aria-label="Artwork gallery">
          {pictures.map((picture, n) => (
            <button
              key={picture.asset.id}
              aria-pressed={n === index}
              onClick={() => setIndex(n)}
              aria-label={`Show ${picture.label} artwork`}
            >
              <CollectionThumbnail
                id={picture.asset.id}
                repository={repository}
                color={item.color}
              />
              <span>{picture.label}</span>
            </button>
          ))}
        </div>
      </footer>
    </section>
  );
}
