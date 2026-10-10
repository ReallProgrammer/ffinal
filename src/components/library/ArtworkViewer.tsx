import { useEffect, useState } from 'react';
import type { LibraryBook, LibraryRepository } from '../../lib/library/types';
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
  const [url, setUrl] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true,
      u = '';
    if (item.front)
      repository
        .texture(item.front.id, undefined, 'detail')
        .then((blob) => {
          u = URL.createObjectURL(blob);
          if (live) setUrl(u);
          else URL.revokeObjectURL(u);
        })
        .catch((e) => setError(e.message));
    return () => {
      live = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [item.front?.id, repository]);
  return (
    <section className="artwork-viewer" role="dialog" aria-label={`Artwork ${item.title}`}>
      <header>
        <h2>{item.title}</h2>
        <button onClick={onClose}>Close artwork</button>
      </header>
      <p>Scroll or pinch to zoom at a point. Drag to pan.</p>
      {error ? (
        <p role="alert">{error}</p>
      ) : url ? (
        <ZoomSurface>
          <img src={url} alt={item.title} draggable={false} />
        </ZoomSurface>
      ) : (
        <p role="status">Preparing high-resolution artwork…</p>
      )}
    </section>
  );
}
