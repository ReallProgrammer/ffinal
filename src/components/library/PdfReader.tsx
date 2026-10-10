import { useCallback, useEffect, useRef, useState } from 'react';
import ZoomSurface from './ZoomSurface';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc = workerUrl;
function PageImage({ page, load }: { page: number; load: (n: number) => Promise<string> }) {
  const [src, setSrc] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setSrc('');
    setError('');
    load(page)
      .then((v) => {
        if (active) setSrc(v);
      })
      .catch(() => {
        if (active) setError('Page could not be rendered.');
      });
    return () => {
      active = false;
    };
  }, [page, load]);
  return src ? (
    <img draggable={false} src={src} alt={`Document page ${page}`} />
  ) : (
    <span role={error ? 'alert' : 'status'}>{error || 'Rendering page…'}</span>
  );
}
export default function PdfReader({
  url,
  title,
  coverUrl,
  active = true,
}: {
  url: string;
  title: string;
  coverUrl?: string;
  active?: boolean;
}) {
  const [document, setDocument] = useState<PDFDocumentProxy>(),
    [error, setError] = useState(''),
    [page, setPage] = useState(1),
    [turn, setTurn] = useState<null | { from: number; to: number; direction: number }>(null),
    [zoom, setZoom] = useState(1),
    [rtl, setRtl] = useState(false),
    [outline, setOutline] = useState<{ title: string; page: number }[]>([]),
    [cover, setCover] = useState(Boolean(coverUrl));
  const cache = useRef(new Map<number, Promise<string>>()),
    urls = useRef(new Map<number, string>()),
    root = useRef<HTMLDivElement>(null),
    generation = useRef(0),
    turnTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [aspect, setAspect] = useState(0.71);
  const stage = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 500 });
  useEffect(() => {
    if (!stage.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setStageSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    const task = getDocument({
      url,

      useSystemFonts: true,
      cMapUrl: import.meta.env.BASE_URL + 'pdfjs/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: import.meta.env.BASE_URL + 'pdfjs/standard_fonts/',
      wasmUrl: import.meta.env.BASE_URL + 'pdfjs/wasm/',
      maxImageSize: 16_000_000,
    });
    let active = true;
    task.promise
      .then(async (doc) => {
        if (!active) return;
        setDocument(doc);
        const list = await doc.getOutline();
        const entries: { title: string; page: number }[] = [];
        async function visit(nodes: NonNullable<typeof list>) {
          for (const n of nodes) {
            let destination =
              typeof n.dest === 'string' ? await doc.getDestination(n.dest) : n.dest;
            if (destination?.[0] !== undefined) {
              const p =
                typeof destination[0] === 'number'
                  ? destination[0]
                  : await doc.getPageIndex(destination[0]);
              entries.push({ title: n.title, page: p + 1 });
            }
            if (n.items) await visit(n.items);
          }
        }
        if (list) await visit(list);
        if (active) setOutline(entries);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      generation.current++;
      clearTimeout(turnTimer.current);
      void task.destroy();
      urls.current.forEach(URL.revokeObjectURL);
      urls.current.clear();
      cache.current.clear();
    };
  }, [url]);
  const load = useCallback(
    (n: number) => {
      if (!document) return Promise.reject(new Error('Document not ready'));
      let pending = cache.current.get(n);
      if (!pending) {
        const g = generation.current;
        pending = (async () => {
          let p: PDFPageProxy | undefined;
          try {
            p = await document.getPage(n);
            const original = p.getViewport({ scale: 1 });
            if (n === 1) setAspect(original.width / original.height);
            const viewport = p.getViewport({
              scale: Math.min(4, 2400 / original.width, 3200 / original.height),
            });
            const canvas = window.document.createElement('canvas');
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            await p.render({ canvas, viewport }).promise;
            const blob = await new Promise<Blob>((resolve, reject) =>
              canvas.toBlob(
                (b) => (b ? resolve(b) : reject(new Error('Render failed'))),
                'image/webp',
                0.98,
              ),
            );
            canvas.width = 0;
            canvas.height = 0;
            if (g !== generation.current) throw new Error('Reader closed');
            const result = URL.createObjectURL(blob);
            urls.current.set(n, result);
            return result;
          } finally {
            p?.cleanup();
          }
        })();
        cache.current.set(n, pending);
      }
      return pending;
    },
    [document],
  );
  useEffect(() => {
    if (!document) return;
    const keep = new Set<number>();
    for (let n = Math.max(1, page - 2); n <= Math.min(document.numPages, page + 3); n++) {
      keep.add(n);
      void load(n).catch(() => {});
    }
    for (const [n, u] of urls.current)
      if (!keep.has(n) && !turn) {
        URL.revokeObjectURL(u);
        urls.current.delete(n);
        cache.current.delete(n);
      }
  }, [page, document, load, turn]);
  const go = useCallback(
    async (direction: number) => {
      if (!document || turn) return;
      if (cover) {
        setCover(false);
        return;
      }
      const to = page + direction * 2;
      if (to < 1 || to > document.numPages) return;
      try {
        await Promise.all([
          load(to),
          to + 1 <= document.numPages ? load(to + 1) : Promise.resolve(''),
        ]);
        setTurn({ from: page, to, direction });
        turnTimer.current = setTimeout(
          () => {
            setPage(to);
            setTurn(null);
          },
          reduced ? 0 : 620,
        );
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [document, turn, cover, page, load, reduced],
  );
  useEffect(() => {
    if (!active) return;
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input,select,textarea')) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        void go((e.key === 'ArrowRight' ? 1 : -1) * (rtl ? -1 : 1));
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [go, rtl, active]);
  const displayed = turn
    ? turn.direction === 1
      ? [turn.from, turn.to + 1]
      : [turn.to, turn.from + 1]
    : [page, page + 1];
  return (
    <div className="pdf-reader" ref={root}>
      <nav>
        <button disabled={(page === 1 && !cover) || Boolean(turn)} onClick={() => void go(-1)}>
          Previous pages
        </button>
        <span aria-live="polite">
          {document
            ? cover
              ? 'Cover'
              : `Pages ${page}–${Math.min(page + 1, document.numPages)} of ${document.numPages}`
            : 'Loading PDF…'}
        </span>
        <button
          disabled={!document || Boolean(turn) || (!cover && page + 2 > document.numPages)}
          onClick={() => void go(1)}
        >
          {cover ? 'Open book' : 'Next pages'}
        </button>
        <label>
          Zoom
          <input
            aria-label="Document zoom"
            type="range"
            min=".7"
            max="1.8"
            step=".1"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
        <button
          onClick={() => {
            if (window.document.fullscreenElement) void window.document.exitFullscreen();
            else
              void root.current
                ?.requestFullscreen()
                .catch(() => setError('Fullscreen is unavailable in this browser.'));
          }}
        >
          Fullscreen
        </button>
        <label>
          <input type="checkbox" checked={rtl} onChange={(e) => setRtl(e.target.checked)} />
          Right-to-left
        </label>
        {outline.length > 0 && (
          <select
            aria-label="Table of contents"
            onChange={(e) => {
              setCover(false);
              setPage(Math.max(1, Math.floor((Number(e.target.value) - 1) / 2) * 2 + 1));
            }}
          >
            <option value="1">Contents</option>
            {outline.map((v, i) => (
              <option key={i} value={v.page}>
                {v.title}
              </option>
            ))}
          </select>
        )}
        {coverUrl && !cover && <button onClick={() => setCover(true)}>View cover</button>}
      </nav>
      {error && <p role="alert">{error}</p>}
      <div className="pdf-stage" ref={stage}>
        <ZoomSurface label="Zoomable document">
          <div
            className={`pdf-book ${rtl ? 'rtl' : ''}`}
            style={
              {
                '--page-ratio': aspect,
                width:
                  Math.max(
                    160,
                    Math.min(900, stageSize.width * 0.92, (stageSize.height - 24) * aspect * 2),
                  ) * zoom,
              } as React.CSSProperties
            }
          >
            {cover && coverUrl ? (
              <button
                className="pdf-cover"
                onClick={() => setCover(false)}
                aria-label="Open document cover"
              >
                <img src={coverUrl} alt={`${title} cover`} />
              </button>
            ) : (
              document && (
                <>
                  <div className="pdf-spread">
                    {displayed.map((n, index) => (
                      <button
                        key={index}
                        className="pdf-paper"
                        aria-label={index === 0 ? 'Turn previous page' : 'Turn next page'}
                        onClick={() => void go(index === 0 ? -1 : 1)}
                      >
                        {n <= document.numPages ? (
                          <PageImage page={n} load={load} />
                        ) : (
                          <span>End of document</span>
                        )}
                      </button>
                    ))}
                  </div>
                  {turn && (
                    <div
                      className={`pdf-turn ${turn.direction === 1 ? 'forward' : 'backward'}`}
                      key={`${turn.from}-${turn.to}`}
                    >
                      <div className="pdf-turn-front">
                        {(turn.direction === 1 ? turn.from + 1 : turn.from) <=
                          document.numPages && (
                          <PageImage
                            page={turn.direction === 1 ? turn.from + 1 : turn.from}
                            load={load}
                          />
                        )}
                      </div>
                      <div className="pdf-turn-back">
                        <PageImage
                          page={turn.direction === 1 ? turn.to : turn.to + 1}
                          load={load}
                        />
                      </div>
                    </div>
                  )}
                </>
              )
            )}
          </div>
        </ZoomSurface>
      </div>
      <p className="pdf-hint">
        Click the page edges or use ← → · scroll or pinch at a point for finer detail · original
        pages, rendered from your PDF
      </p>
    </div>
  );
}
