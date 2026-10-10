import { lazy, Suspense, useEffect, useState } from 'react';
const PdfReader = lazy(() => import('./PdfReader'));
import { unzip } from 'fflate';
import type { LibraryBook, LibraryRepository } from '../../lib/library/types';
interface Chapter {
  title: string;
  paragraphs: string[];
}
const xml = (text: string) => new DOMParser().parseFromString(text, 'application/xml');
async function readEpub(blob: Blob): Promise<Chapter[]> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const files = await new Promise<Record<string, Uint8Array>>((resolve, reject) =>
    unzip(
      bytes,
      {
        filter: (file) =>
          /\.(xml|opf|xhtml|html|htm)$/i.test(file.name) && file.originalSize < 8 * 1024 * 1024,
      },
      (error, data) => (error ? reject(error) : resolve(data)),
    ),
  );
  const decode = (path: string) => new TextDecoder().decode(files[path] || new Uint8Array());
  const container = xml(decode('META-INF/container.xml'));
  const root = container.getElementsByTagNameNS('*', 'rootfile')[0]?.getAttribute('full-path');
  if (!root || !files[root])
    throw new Error('This EPUB has no readable package. Download it for an external reader.');
  const pkg = xml(decode(root));
  const base = root.slice(0, root.lastIndexOf('/') + 1);
  const manifest = new Map(
    [...pkg.getElementsByTagNameNS('*', 'item')].map((item) => [
      item.getAttribute('id'),
      item.getAttribute('href'),
    ]),
  );
  const result: Chapter[] = [];
  for (const item of [...pkg.getElementsByTagNameNS('*', 'itemref')]) {
    const href = manifest.get(item.getAttribute('idref'));
    if (!href) continue;
    const parts: string[] = [];
    for (const part of (base + decodeURIComponent(href.split('#')[0])).split('/')) {
      if (part === '..') parts.pop();
      else if (part && part !== '.') parts.push(part);
    }
    const doc = new DOMParser().parseFromString(decode(parts.join('/')), 'text/html');
    doc
      .querySelectorAll('script,style,iframe,object,embed,svg,form,noscript')
      .forEach((el) => el.remove());
    const paragraphs = [...doc.body.querySelectorAll('h1,h2,h3,p,li,pre,blockquote')]
      .map((el) => el.textContent?.trim() || '')
      .filter(Boolean);
    if (!paragraphs.length && doc.body.textContent?.trim())
      paragraphs.push(doc.body.textContent.trim());
    if (paragraphs.length)
      result.push({
        title:
          doc.querySelector('h1,h2,title')?.textContent?.trim() || `Chapter ${result.length + 1}`,
        paragraphs,
      });
  }
  if (!result.length)
    throw new Error('No readable text was found. Download this EPUB to use another reader.');
  return result;
}
export default function Reader({
  book,
  repository,
  onClose,
  active = true,
  role,
}: {
  book: LibraryBook;
  repository: LibraryRepository;
  onClose: () => void;
  active?: boolean;
  role?: 'manual';
}) {
  const documentAsset = role === 'manual' ? book.artwork?.manual : book.digital;
  const [coverUrl, setCoverUrl] = useState('');
  useEffect(() => {
    let active = true,
      url = '';
    if (book.front)
      void repository
        .texture(book.front.id)
        .then((blob) => {
          url = URL.createObjectURL(blob);
          if (active) setCoverUrl(url);
          else URL.revokeObjectURL(url);
        })
        .catch(() => {});
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [book.front?.id, repository]);
  const [url, setUrl] = useState(''),
    [chapters, setChapters] = useState<Chapter[]>([]),
    [chapter, setChapter] = useState(0),
    [font, setFont] = useState(18),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true,
      objectUrl = '';
    repository
      .read(book, role)
      .then(async (blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (!active) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setUrl(objectUrl);
        if (documentAsset?.mime === 'application/epub+zip') {
          const content = await readEpub(blob);
          if (active) setChapters(content);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [book, repository, role]);
  return (
    <section className="library-reader" role="dialog" aria-label={`Reading ${book.title}`}>
      <header>
        <div>
          <small>THE READING ROOM</small>
          <h2>{book.title}</h2>
        </div>
        <button className="xp-button" onClick={onClose}>
          Close reader
        </button>
      </header>
      {error && <p role="alert">{error}</p>}
      {!url && !error && <div className="library-loading">Opening your book…</div>}
      {url && documentAsset?.mime === 'application/pdf' && (
        <Suspense fallback={<p>Preparing document reader…</p>}>
          <PdfReader url={url} title={book.title} coverUrl={coverUrl} active={active} />
        </Suspense>
      )}
      {chapters.length > 0 && (
        <>
          <nav>
            <select
              aria-label="Chapter"
              value={chapter}
              onChange={(e) => setChapter(Number(e.target.value))}
            >
              {chapters.map((c, i) => (
                <option key={i} value={i}>
                  {c.title}
                </option>
              ))}
            </select>
            <label>
              Text size{' '}
              <input
                aria-label="Reading text size"
                type="range"
                min="14"
                max="28"
                value={font}
                onChange={(e) => setFont(Number(e.target.value))}
              />
            </label>
          </nav>
          <article className="epub-text" style={{ fontSize: font }} key={chapter}>
            <h3>{chapters[chapter].title}</h3>
            {chapters[chapter].paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </article>
          <nav>
            <button disabled={!chapter} onClick={() => setChapter(chapter - 1)}>
              ← Previous chapter
            </button>
            <span>
              {chapter + 1} / {chapters.length}
            </span>
            <button
              disabled={chapter === chapters.length - 1}
              onClick={() => setChapter(chapter + 1)}
            >
              Next chapter →
            </button>
          </nav>
        </>
      )}
      <footer>
        <span>
          {book.author}
          {chapters.length > 0 ? ' · Reflowable text edition' : ''}
        </span>
        {url && (
          <a className="xp-button" href={url} download={documentAsset?.filename}>
            Download edition
          </a>
        )}
      </footer>
    </section>
  );
}
