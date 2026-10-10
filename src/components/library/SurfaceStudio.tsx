import { useEffect, useRef, useState } from 'react';
import type {
  BookAsset,
  CoverLayer,
  LibraryBook,
  LibraryRepository,
  Surface,
} from '../../lib/library/types';
import UploadField from './UploadField';
import { artworkAsset } from '../../lib/library/types';
import { objectType, surfaceRatio } from '../../lib/library/registry';
function useImage(repository: LibraryRepository, id?: string) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let live = true,
      u = '';
    setUrl('');
    if (id)
      repository
        .texture(id, undefined, 'detail')
        .then((blob) => {
          u = URL.createObjectURL(blob);
          if (live) setUrl(u);
          else URL.revokeObjectURL(u);
        })
        .catch(() => {});
    return () => {
      live = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [repository, id]);
  return url;
}
function LayerImage({ id, repository }: { id: string; repository: LibraryRepository }) {
  const url = useImage(repository, id);
  return url ? <img src={url} draggable={false} alt="Uploaded layer" /> : null;
}
export default function SurfaceStudio({
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
  const surfaces = [
    ...objectType(item).surfaces,
    ...objectType(item).contents.filter((v) => v !== 'manual'),
  ] as Surface[];
  const [surface, setSurface] = useState<Surface>('front'),
    [selected, setSelected] = useState(''),
    [snap, setSnap] = useState(true),
    [preserveAspect, setPreserveAspect] = useState(true);
  const [history, setHistory] = useState<LibraryBook['layers'][]>([]),
    [future, setFuture] = useState<LibraryBook['layers'][]>([]);
  const drag = useRef<{
      pointer: number;
      x: number;
      y: number;
      layer: CoverLayer;
      before: LibraryBook['layers'];
      mode: 'move' | 'resize' | 'rotate';
    } | null>(null),
    area = useRef<HTMLDivElement>(null);
  const layers = item.layers?.[surface] || [],
    current = layers.find((v) => v.id === selected),
    url = useImage(repository, artworkAsset(item, surface)?.id);
  const write = (next: CoverLayer[], remember = true) => {
    if (remember) {
      setHistory((h) => [...h.slice(-29), item.layers || {}]);
      setFuture([]);
    }
    onChange({ ...item, layers: { ...item.layers, [surface]: next } });
  };
  const patch = (value: Partial<CoverLayer>) => {
    if (current && !current.locked)
      write(layers.map((v) => (v.id === selected ? { ...v, ...value } : v)));
  };
  const add = (asset?: BookAsset) => {
    const layer: CoverLayer = {
      id: crypto.randomUUID(),
      type: asset ? 'image' : 'text',
      assetId: asset?.id,
      text: asset ? undefined : 'Your text',
      x: 0.5,
      y: 0.5,
      width: 0.45,
      height:
        asset?.width && asset.height
          ? Math.min(0.8, (0.45 * surfaceRatio(item, surface) * asset.height) / asset.width)
          : 0.12,
      rotation: 0,
      locked: false,
      color: '#ffffff',
      font: 'sans-serif',
    };
    setHistory((h) => [...h.slice(-29), item.layers || {}]);
    setFuture([]);
    onChange({
      ...item,
      layers: { ...item.layers, [surface]: [...layers, layer] },
      layerAssets: { ...item.layerAssets, ...(asset ? { [asset.id]: asset } : {}) },
    });
    setSelected(layer.id);
  };
  function start(e: React.PointerEvent, layer: CoverLayer, mode: 'move' | 'resize' | 'rotate') {
    e.stopPropagation();
    if (blocked) return;
    setSelected(layer.id);
    if (layer.locked) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      pointer: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      layer,
      before: item.layers,
      mode,
    };
  }
  function move(e: React.PointerEvent) {
    const d = drag.current,
      r = area.current?.getBoundingClientRect();
    if (!d || !r || blocked) return;
    const dx = (e.clientX - d.x) / r.width,
      dy = (e.clientY - d.y) / r.height;
    const grid = (n: number) => Math.max(-1, Math.min(2, snap ? Math.round(n * 40) / 40 : n));
    const next =
      d.mode === 'move'
        ? { x: grid(d.layer.x + dx), y: grid(d.layer.y + dy) }
        : d.mode === 'resize'
          ? {
              width: Math.max(0.02, Math.min(2, d.layer.width + dx * 2)),
              height: preserveAspect
                ? Math.max(
                    0.02,
                    Math.min(
                      2,
                      (Math.max(0.02, Math.min(2, d.layer.width + dx * 2)) * d.layer.height) /
                        d.layer.width,
                    ),
                  )
                : Math.max(0.02, Math.min(2, d.layer.height + dy * 2)),
            }
          : { rotation: Math.max(-360, Math.min(360, d.layer.rotation + dx * 180)) };
    write(
      layers.map((v) => (v.id === d.layer.id ? { ...v, ...next } : v)),
      false,
    );
  }
  function end() {
    if (drag.current) {
      const before = drag.current.before;
      setHistory((h) => [...h.slice(-29), before || {}]);
      setFuture([]);
      drag.current = null;
    }
  }
  return (
    <section className="surface-studio">
      <h3>Cover layers</h3>
      <UploadField
        item={item}
        kind="decal"
        label="cover layer"
        disabled={blocked}
        repository={repository}
        onBusy={onBusy}
        onCrop={() => {}}
        onChange={(asset) => asset && add(asset)}
      />
      <fieldset disabled={blocked} className="studio-controls">
        <p>
          Place images, logos, QR artwork, or optional text directly on the cover. These layers
          become part of its 3D texture.
        </p>
        <label>
          Surface
          <select
            value={surface}
            onChange={(e) => {
              setSurface(e.target.value as Surface);
              setSelected('');
            }}
          >
            {surfaces.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <div className="layer-toolbar">
          <button type="button" disabled={layers.length >= 30} onClick={() => add()}>
            Add text
          </button>
          <button
            type="button"
            disabled={!history.length}
            onClick={() => {
              setFuture((f) => [item.layers || {}, ...f]);
              onChange({ ...item, layers: history.at(-1) });
              setHistory((h) => h.slice(0, -1));
            }}
          >
            Undo
          </button>
          <button
            type="button"
            disabled={!future.length}
            onClick={() => {
              setHistory((h) => [...h, item.layers || {}]);
              onChange({ ...item, layers: future[0] });
              setFuture((f) => f.slice(1));
            }}
          >
            Redo
          </button>
          <label>
            <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
            Snap to grid
          </label>
          <label>
            <input
              type="checkbox"
              checked={preserveAspect}
              onChange={(e) => setPreserveAspect(e.target.checked)}
            />
            Preserve image proportions
          </label>
        </div>

        <div
          ref={area}
          className="layer-canvas"
          style={{
            aspectRatio: surfaceRatio(item, surface),
            backgroundColor: item.color,
            backgroundImage: url ? `url("${url}")` : undefined,
          }}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        >
          {layers.map((layer) => (
            <div
              key={layer.id}
              role="button"
              tabIndex={0}
              aria-label={layer.type === 'text' ? `Layer ${layer.text}` : 'Image layer'}
              className={`cover-layer ${selected === layer.id ? 'selected' : ''} ${layer.locked ? 'locked' : ''}`}
              style={{
                left: `${layer.x * 100}%`,
                top: `${layer.y * 100}%`,
                width: `${layer.width * 100}%`,
                height: `${layer.height * 100}%`,
                transform: `translate(-50%,-50%) rotate(${layer.rotation}deg)`,
                color: layer.color,
                fontFamily: layer.font,
              }}
              onClick={() => setSelected(layer.id)}
              onPointerDown={(e) => start(e, layer, 'move')}
              onKeyDown={(e) => {
                if (e.key.startsWith('Arrow') && !layer.locked) {
                  e.preventDefault();
                  const n = e.shiftKey ? 0.05 : 0.01;
                  setSelected(layer.id);
                  write(
                    layers.map((v) =>
                      v.id === layer.id
                        ? {
                            ...v,
                            x: v.x + (e.key === 'ArrowRight' ? n : e.key === 'ArrowLeft' ? -n : 0),
                            y: v.y + (e.key === 'ArrowDown' ? n : e.key === 'ArrowUp' ? -n : 0),
                          }
                        : v,
                    ),
                  );
                }
              }}
            >
              {layer.type === 'image' && layer.assetId ? (
                <LayerImage id={layer.assetId} repository={repository} />
              ) : (
                <svg viewBox="0 0 500 100" preserveAspectRatio="none">
                  <text
                    x="250"
                    y="50"
                    dominantBaseline="middle"
                    textAnchor="middle"
                    fill="currentColor"
                    fontSize="72"
                    textLength={Math.max(1, Math.min(480, (layer.text || '').length * 40))}
                    lengthAdjust="spacingAndGlyphs"
                  >
                    {layer.text}
                  </text>
                </svg>
              )}
              {selected === layer.id && !layer.locked && (
                <>
                  <button
                    type="button"
                    className="layer-resize"
                    aria-label="Resize layer"
                    onPointerDown={(e) => start(e, layer, 'resize')}
                  >
                    ↘
                  </button>
                  <button
                    type="button"
                    className="layer-rotate"
                    aria-label="Rotate layer"
                    onPointerDown={(e) => start(e, layer, 'rotate')}
                  >
                    ↻
                  </button>
                </>
              )}
            </div>
          ))}
          <i className="layer-safe-area" />
        </div>
        {current && (
          <div className="layer-properties">
            <label>
              <input
                type="checkbox"
                checked={current.locked}
                onChange={(e) =>
                  write(
                    layers.map((v) =>
                      v.id === current.id ? { ...v, locked: e.target.checked } : v,
                    ),
                  )
                }
              />
              Lock layer
            </label>
            {current.type === 'text' && (
              <>
                <label>
                  Layer text
                  <input
                    value={current.text || ''}
                    maxLength={500}
                    disabled={current.locked}
                    onChange={(e) => patch({ text: e.target.value })}
                  />
                </label>
                <label>
                  Text color
                  <input
                    type="color"
                    value={current.color}
                    onChange={(e) => patch({ color: e.target.value })}
                  />
                </label>
                <label>
                  Typeface
                  <select
                    value={current.font}
                    onChange={(e) => patch({ font: e.target.value as CoverLayer['font'] })}
                  >
                    <option>sans-serif</option>
                    <option>serif</option>
                    <option>monospace</option>
                  </select>
                </label>
              </>
            )}
            {(['x', 'y', 'width', 'height', 'rotation'] as const).map((key) => (
              <label key={key}>
                {key}
                <input
                  type="number"
                  step={key === 'rotation' ? 1 : 0.01}
                  min={key === 'rotation' ? -360 : key === 'width' || key === 'height' ? 0.01 : -1}
                  max={key === 'rotation' ? 360 : 2}
                  disabled={current.locked}
                  value={current[key]}
                  onChange={(e) => patch({ [key]: Number(e.target.value) })}
                />
              </label>
            ))}
            <div>
              <button
                type="button"
                disabled={current.locked}
                onClick={() => patch({ x: 0.5, y: 0.5 })}
              >
                Center
              </button>
              <button
                type="button"
                onClick={() => {
                  const copy = {
                    ...current,
                    id: crypto.randomUUID(),
                    x: Math.min(1, current.x + 0.03),
                    locked: false,
                  };
                  write([...layers, copy]);
                  setSelected(copy.id);
                }}
              >
                Duplicate
              </button>
              <button
                type="button"
                disabled={current.locked}
                onClick={() => write([...layers.filter((v) => v.id !== selected), current])}
              >
                Bring forward
              </button>
              <button
                type="button"
                disabled={current.locked}
                onClick={() => write([current, ...layers.filter((v) => v.id !== selected)])}
              >
                Send backward
              </button>
              <button
                type="button"
                disabled={current.locked}
                onClick={() => {
                  write(layers.filter((v) => v.id !== selected));
                  setSelected('');
                }}
              >
                Delete layer
              </button>
            </div>
          </div>
        )}
      </fieldset>
    </section>
  );
}
