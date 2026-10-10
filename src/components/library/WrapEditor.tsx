import { useEffect, useState } from 'react';
import UploadField from './UploadField';
import type { LibraryBook, LibraryRepository } from '../../lib/library/types';
export default function WrapEditor({
  item,
  repository,
  onChange,
  onBusy,
  blocked = false,
}: {
  item: LibraryBook;
  repository: LibraryRepository;
  onChange: (item: LibraryBook) => void;
  onBusy: (busy: boolean) => void;
  blocked?: boolean;
}) {
  const total = item.width * 2 + item.thickness,
    [left, setLeft] = useState(item.width / total),
    [right, setRight] = useState((item.width + item.thickness) / total),
    [url, setUrl] = useState(''),
    [error, setError] = useState(''),
    [status, setStatus] = useState('');
  const source = item.artwork?.wrap;
  useEffect(() => {
    let live = true,
      u = '';
    if (source)
      repository
        .original(source.id)
        .then((b) => {
          u = URL.createObjectURL(b);
          if (live) setUrl(u);
          else URL.revokeObjectURL(u);
        })
        .catch((e) => setError(e.message));
    return () => {
      live = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [source?.id, repository]);
  return (
    <section className="wrap-editor">
      <h3>Full-wrap artwork</h3>
      <p>
        Upload the complete back → spine → front layout. The suggested split uses this object's
        width and depth. Confirm the boundaries before applying.
      </p>
      <UploadField
        item={item}
        kind="wrap"
        label="full wrap"
        disabled={blocked}
        repository={repository}
        onBusy={onBusy}
        onCrop={() => {}}
        onChange={(asset) => onChange({ ...item, artwork: { ...item.artwork, wrap: asset } })}
      />
      {status && (
        <p role="status">
          <progress />
          {status}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {source && (
        <>
          <div className="wrap-preview">
            {url && <img src={url} alt="Complete uploaded wrap" />}
            <i style={{ left: `${left * 100}%` }} />
            <i style={{ left: `${right * 100}%` }} />
            <span style={{ left: `${left * 50}%` }}>Back</span>
            <span style={{ left: `${(left + right) * 50}%` }}>Spine</span>
            <span style={{ left: `${(right + 1) * 50}%` }}>Front</span>
          </div>
          <label>
            Back / spine boundary
            <input
              type="range"
              min=".005"
              max={right - 0.005}
              step=".001"
              value={left}
              onChange={(e) => setLeft(Number(e.target.value))}
            />
          </label>
          <label>
            Spine / front boundary
            <input
              type="range"
              min={left + 0.005}
              max=".995"
              step=".001"
              value={right}
              onChange={(e) => setRight(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            disabled={blocked}
            onClick={() => {
              setLeft(item.width / total);
              setRight((item.width + item.thickness) / total);
            }}
          >
            Reset dimension-based split
          </button>
          <button
            type="button"
            disabled={blocked}
            onClick={async () => {
              onBusy(true);
              setStatus('Generating three surface textures…');
              setError('');
              try {
                const panels = await repository.split(source.id, [
                  { role: 'back', start: 0, end: left },
                  { role: 'spine', start: left, end: right },
                  { role: 'front', start: right, end: 1 },
                ]);
                onChange({ ...item, ...panels });
              } catch (err) {
                setError((err as Error).message);
              } finally {
                onBusy(false);
                setStatus('');
              }
            }}
          >
            Confirm split & apply surfaces
          </button>
        </>
      )}
    </section>
  );
}
