import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, LockKeyhole, Search, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useDesktop } from '../../lib/DesktopContext';
import { libraryApi } from '../../lib/library/api';
import type { LibraryBook, LibraryData, LibraryRepository } from '../../lib/library/types';
import { shelfRepository, downloadShelf, isSafeImage } from '../../lib/shelf/repository';
import type { ShelfItem } from '../../lib/shelf/repository';
import MenuBar from '../MenuBar';
import LibraryAdmin from '../library/LibraryAdmin';
import Reader from '../library/Reader';
import ArtworkViewer from '../library/ArtworkViewer';
import CollectionThumbnail from '../library/CollectionThumbnail';
import '../../library.css';
import { categories, objectType } from '../../lib/library/registry';
import { playSound } from '../../lib/sound';
const LibraryScene = lazy(() => import('../library/LibraryScene'));
const empty: LibraryData = { books: [], shelves: [] };
export default function Shelf({
  repository = libraryApi,
  active = true,
  visible = true,
  initialView = 'library',
}: {
  repository?: LibraryRepository;
  active?: boolean;
  visible?: boolean;
  initialView?: 'library' | 'archive';
}) {
  const { settings, setSettings } = useDesktop();
  const sceneArea = useRef<HTMLDivElement>(null);
  const reduced = settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [data, setData] = useState<LibraryData>(empty),
    [owner, setOwner] = useState(repository.isOwner()),
    [mode, setMode] = useState<'library' | 'login' | 'manage' | 'archive'>(initialView);
  const [loading, setLoading] = useState(repository.configured),
    [error, setError] = useState(''),
    [search, setSearch] = useState(''),
    [genres, setGenres] = useState<string[]>([]),
    [sort, setSort] = useState('shelf'),
    [shelf, setShelf] = useState('');
  const [selected, setSelected] = useState(''),
    [hover, setHover] = useState(''),
    [zoom, setZoom] = useState(1),
    [reading, setReading] = useState<LibraryBook | null>(null),
    [indexOpen, setIndexOpen] = useState(false),
    [page, setPage] = useState(0),
    [artwork, setArtwork] = useState<LibraryBook | null>(null),
    [readingRole, setReadingRole] = useState<'manual' | undefined>();
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [signing, setSigning] = useState(false),
    [archive, setArchive] = useState<ShelfItem[]>([]),
    [artworkReady, setArtworkReady] = useState(false);
  const [artworkError, setArtworkError] = useState('');
  const [sceneVersion, setSceneVersion] = useState(0);
  const [category, setCategory] = useState('certificates'),
    [autoRotate, setAutoRotate] = useState(false),
    [resetKey, setResetKey] = useState(0),
    [caseOpen, setCaseOpen] = useState(false);
  const cue = (kind: 'open' | 'close') => {
    if (settings.sound) playSound(kind, settings.volume);
  };
  const returnToShelf = () => {
    setCaseOpen(false);
    setSelected('');
    setZoom(1);
    cue('close');
  };
  const load = useCallback(async () => {
    if (!repository.configured) {
      setLoading(false);
      return;
    }
    setError('');
    (await import('../library/resources')).clearCollectionCache(repository);
    try {
      const next = await repository.list(repository.isOwner());
      setData(next);
      setSceneVersion((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [repository]);
  useEffect(() => {
    void load();
    const changed = () => {
      setOwner(repository.isOwner());
      if (!repository.isOwner()) {
        void import('../library/resources').then((m) => m.clearCollectionCache(repository));
        setData(empty);
        setReading(null);
        setMode((m) => (m === 'manage' ? 'login' : m));
      }
      void load();
    };
    window.addEventListener('library-change', changed);
    window.addEventListener('pc-refresh', changed);
    return () => {
      window.removeEventListener('library-change', changed);
      window.removeEventListener('pc-refresh', changed);
    };
  }, [load, repository]);
  useEffect(() => {
    if (!active) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        if (artwork) setArtwork(null);
        else if (reading) setReading(null);
        else if (caseOpen) setCaseOpen(false);
        else if (selected) {
          returnToShelf();
        } else if (mode !== 'library') setMode('library');
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [active, selected, reading, mode, caseOpen, artwork]);
  const books = data.books
    .filter(
      (b) =>
        b.published &&
        (category === 'all' || objectType(b).category === category) &&
        (!shelf || b.shelfId === shelf) &&
        (!genres.length ||
          genres.some((genre) => b.genre === genre || b.genreIds?.includes(genre))) &&
        `${b.title} ${b.author} ${(b.tags || []).join(' ')} ${Object.values(b.details || {}).join(' ')}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'title'
        ? a.title.localeCompare(b.title)
        : sort === 'author'
          ? a.author.localeCompare(b.author)
          : sort === 'year'
            ? (b.year || 0) - (a.year || 0)
            : sort === 'bookOrder'
              ? (a.bookOrder ?? a.position) - (b.bookOrder ?? b.position)
              : a.position - b.position,
    );
  useEffect(() => {
    if (!reduced)
      sceneArea.current?.animate(
        [
          { opacity: 0.35, transform: 'translateX(12px)' },
          { opacity: 1, transform: 'translateX(0)' },
        ],
        { duration: 260, easing: 'ease-out' },
      );
  }, [shelf, reduced]);
  const pageSize = innerWidth < 700 ? 8 : 16;
  const pageBooks = books.slice(page * pageSize, (page + 1) * pageSize);
  const current = data.books.find((b) => b.id === selected && b.published);
  const displayedShelves = data.shelves.filter((s) => !shelf || s.id === shelf);
  useEffect(() => {
    setPage(0);
    setSelected('');
    setZoom(1);
  }, [search, genres, sort, shelf, pageSize, category]);
  useEffect(() => {
    if (initialView === 'archive')
      void shelfRepository
        .list()
        .then(setArchive)
        .catch((e) => setError(e.message));
  }, [initialView]);
  const inspect = (id: string) => {
    cue('open');
    setCaseOpen(false);
    setSelected(id);
    setZoom(1);
    setArtworkReady(false);
    setArtworkError('');
  };
  const browseShelf = (direction: number) => {
    const index = data.shelves.findIndex((s) => s.id === shelf);
    const next = data.shelves[Math.max(0, Math.min(data.shelves.length - 1, index + direction))];
    if (next) {
      setSelected('');
      setCaseOpen(false);
      setShelf(next.id);
    }
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        !active ||
        mode !== 'library' ||
        selected ||
        reading ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        browseShelf(e.key === 'ArrowRight' ? 1 : -1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, mode, selected, reading, shelf, data.shelves]);
  const ownerAccess = () => {
    setError('');
    setMode(repository.isOwner() ? 'manage' : 'login');
  };
  async function localArchive() {
    setMode('archive');
    try {
      setArchive(await shelfRepository.list());
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="shelf-app library-app app-column">
      <MenuBar
        menus={[
          {
            label: 'Library',
            items: [
              { label: 'Browse books', action: () => setMode('library') },
              { label: 'Refresh', action: () => void load() },
              ...(category === 'books'
                ? [
                    {
                      label: 'Book index',
                      checked: indexOpen,
                      action: () => setIndexOpen(!indexOpen),
                    },
                  ]
                : []),
              { label: 'Local collection archive', action: () => void localArchive() },
            ],
          },
          {
            label: 'Owner',
            items: [
              { label: owner ? 'Manage library' : 'Owner sign in', action: ownerAccess },
              ...(owner
                ? [
                    {
                      label: 'Sign out',
                      action: () => void repository.logout().catch((e) => setError(e.message)),
                    },
                  ]
                : []),
            ],
          },
        ]}
      />
      {mode === 'manage' && owner ? (
        <LibraryAdmin
          data={data}
          repository={repository}
          reduced={reduced}
          reload={load}
          onBack={() => {
            setMode('library');
            void load();
          }}
        />
      ) : mode === 'login' || (mode === 'manage' && !owner) ? (
        <section className="library-signin">
          <span className="library-kicker">PRIVATE / LIBRARIAN’S DESK</span>
          <LockKeyhole size={30} />
          <h1>
            For the keeper
            <br />
            of the library.
          </h1>
          {repository.configured ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSigning(true);
                setError('');
                try {
                  await repository.login(email, password);
                  setPassword('');
                  setOwner(true);
                  await load();
                  setMode('manage');
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setSigning(false);
                }
              }}
            >
              <label>
                Owner email
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={256}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button className="xp-button" disabled={signing}>
                {signing ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          ) : (
            <div className="library-setup-note">
              <p>The private library service has not been connected yet.</p>
              <p>
                Deploy the included backend, configure your owner account and private storage, then
                set the frontend’s <code>VITE_LIBRARY_API_URL</code>. Setup instructions are in{' '}
                <code>docs/library-deployment.md</code>.
              </p>
              <p>Uploads and editing stay disabled until that service is available.</p>
            </div>
          )}
          {!!genres.length && (
            <div className="collection-genre-filters" aria-label="Active genre filters">
              <span>Matching any selected genre:</span>
              {genres.map((id) => (
                <button key={id} onClick={() => setGenres(genres.filter((value) => value !== id))}>
                  {data.genres?.find((g) => g.id === id)?.name || id} ×
                </button>
              ))}
              <button onClick={() => setGenres([])}>Clear genres</button>
            </div>
          )}
          {error && (
            <p className="library-error" role="alert">
              {error}
            </p>
          )}
          <button className="library-text-button" onClick={() => setMode('library')}>
            ← Return to the library
          </button>
        </section>
      ) : mode === 'archive' ? (
        <section className="library-archive">
          <h2>Your previous local collection.</h2>
          <p>
            These files remain on this device. Download originals here; the shared library does not
            publish or modify them.
          </p>
          <button className="xp-button" onClick={() => setMode('library')}>
            Return to library
          </button>
          {archive.map((item) => (
            <div key={item.id}>
              <span>
                {item.name} <small>{item.filename}</small>
              </span>
              <div>
                {isSafeImage(item.type) && (
                  <button
                    className="xp-button"
                    onClick={() => setSettings({ wallpaper: 'custom', customWallpaper: item.id })}
                  >
                    Set as wallpaper
                  </button>
                )}
                <button className="xp-button" onClick={() => downloadShelf(item)}>
                  Download
                </button>
              </div>
            </div>
          ))}
          {!archive.length && <p>No saved objects in this browser.</p>}
        </section>
      ) : (
        <>
          <header className="library-heading">
            <div>
              <span className="library-kicker">A PERSONAL COLLECTION · EST. 2004</span>
              <h1>
                The collection room<span>.</span>
              </h1>
              <p>Achievements, discoveries, and objects worth keeping.</p>
            </div>
            <BookOpen size={37} />
          </header>
          <nav className="collection-categories" aria-label="Collection categories">
            {categories.map((c) => (
              <button key={c.id} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>
                {c.label}
              </button>
            ))}
          </nav>
          <div className="library-toolbar">
            <label className="library-search">
              <Search size={14} />
              <input
                aria-label="Search collection"
                placeholder="Search titles, issuers, skills, creators…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <select
              aria-label="Filter genre"
              value=""
              onChange={(e) => {
                const id = e.target.value;
                if (id && !genres.includes(id)) setGenres([...genres, id]);
              }}
            >
              <option value="">{genres.length ? 'Add another genre…' : 'Every genre'}</option>
              {(data.genres || [])
                .filter((g) => !genres.includes(g.id))
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
            </select>
            <select aria-label="Sort books" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="shelf">
                {category === 'books' ? 'Shelf order' : 'Display order'}
              </option>
              {category === 'books' && <option value="bookOrder">Book numbering order</option>}
              <option value="title">Title A–Z</option>
              {category === 'books' && <option value="author">Author A–Z</option>}
              <option value="year">Newest edition</option>
            </select>
            {category === 'books' && (
              <button
                className="xp-button"
                aria-pressed={indexOpen}
                onClick={() => setIndexOpen(!indexOpen)}
              >
                Index
              </button>
            )}
          </div>
          {!!genres.length && (
            <div className="collection-genre-filters" aria-label="Active genre filters">
              <span>Matching any selected genre:</span>
              {genres.map((id) => (
                <button key={id} onClick={() => setGenres(genres.filter((value) => value !== id))}>
                  {data.genres?.find((g) => g.id === id)?.name || id} ×
                </button>
              ))}
              <button onClick={() => setGenres([])}>Clear genres</button>
            </div>
          )}
          {error && (
            <div className="library-error" role="alert">
              {error}
              <button onClick={() => void load()}>Retry</button>
            </div>
          )}
          <div className={`library-room ${current ? 'inspecting' : ''}`}>
            <div className="library-scene-area" ref={sceneArea}>
              {visible && (
                <Suspense
                  fallback={<div className="library-loading">Preparing the reading room…</div>}
                >
                  <LibraryScene
                    key={sceneVersion}
                    books={pageBooks}
                    shelves={displayedShelves}
                    selected={current?.id || ''}
                    onSelect={inspect}
                    repository={repository}
                    reduced={reduced}
                    zoom={zoom}
                    caseOpen={caseOpen}
                    onToggleCase={() => setCaseOpen((v) => !v)}
                    autoRotate={autoRotate}
                    resetKey={resetKey}
                    onHover={setHover}
                    onArtworkReady={setArtworkReady}
                    onArtworkError={setArtworkError}
                  />
                </Suspense>
              )}
              {!loading && !books.length && (
                <div className="library-empty">
                  <span className="library-kicker">ROOM FOR WHAT COMES NEXT</span>
                  <h2>
                    {search || genres.length
                      ? 'Nothing on this shelf.'
                      : category === 'certificates'
                        ? 'A place for your achievements.'
                        : 'Every collection starts with a story.'}
                  </h2>
                  <p>
                    {search || genres.length
                      ? 'Try another title, author, or genre.'
                      : repository.configured
                        ? 'No published objects in this category yet. Explore All Collections or sign in to add one.'
                        : 'The collection is being prepared. The shelves will open soon.'}
                  </p>
                </div>
              )}
              <div className="library-scene-top">
                <button
                  aria-label="Previous shelf"
                  disabled={!data.shelves.length || data.shelves[0]?.id === shelf}
                  onClick={() => browseShelf(-1)}
                >
                  ‹
                </button>
                <select
                  aria-label="Choose shelf"
                  value={shelf}
                  onChange={(e) => setShelf(e.target.value)}
                >
                  <option value="">All shelves</option>
                  {data.shelves.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  aria-label="Next shelf"
                  disabled={!data.shelves.length || data.shelves.at(-1)?.id === shelf}
                  onClick={() => browseShelf(1)}
                >
                  ›
                </button>
                <span>
                  {loading
                    ? 'Opening library…'
                    : hover || `${books.length} ${books.length === 1 ? 'edition' : 'editions'}`}
                </span>
              </div>
              <div className="library-camera">
                <button
                  aria-label="Zoom in on library"
                  onClick={() => setZoom((z) => Math.max(0.55, z - 0.15))}
                >
                  <ZoomIn size={17} />
                </button>
                <button
                  aria-label="Zoom out of library"
                  onClick={() => setZoom((z) => Math.min(1.65, z + 0.15))}
                >
                  <ZoomOut size={17} />
                </button>
                <button
                  aria-label="Reset library view"
                  onClick={() => {
                    setZoom(1);
                    setResetKey((k) => k + 1);
                  }}
                >
                  <RotateCcw size={16} />
                </button>
              </div>
              {current && (
                <label className="collection-autorotate">
                  <input
                    type="checkbox"
                    checked={autoRotate}
                    onChange={(e) => setAutoRotate(e.target.checked)}
                  />
                  Auto rotate
                </label>
              )}
              <div className="library-scene-hint">
                {current
                  ? 'Drag to turn · pinch or scroll to zoom'
                  : 'Choose an object to explore its story.'}
              </div>
            </div>
            {current && (
              <aside
                className="library-book-details"
                aria-label="Object details"
                data-artwork-ready={artworkReady}
              >
                <button className="library-return" onClick={returnToShelf}>
                  <X size={14} />
                  Return to shelf
                </button>
                <span className="library-kicker">{current.genre || 'FROM THE COLLECTION'}</span>
                <h2>{current.title}</h2>
                <p className="library-author">
                  {objectType(current).label}
                  {current.author ? ` · ${current.author}` : ''}
                </p>
                <p className="library-description">
                  {current.description || 'An edition from the personal collection.'}
                </p>
                <dl>
                  {objectType(current).fields.map((field) =>
                    current.details?.[field.key] ? (
                      <div className="collection-detail-field" key={field.key}>
                        <dt>{field.label}</dt>
                        <dd>
                          {field.input === 'url' ? (
                            <a href={current.details[field.key]} target="_blank" rel="noreferrer">
                              Verify credential ↗
                            </a>
                          ) : (
                            current.details[field.key]
                          )}
                        </dd>
                      </div>
                    ) : null,
                  )}
                  {current.year && (
                    <>
                      <dt>Published</dt>
                      <dd>{current.year}</dd>
                    </>
                  )}
                  {current.isbn && (
                    <>
                      <dt>Edition</dt>
                      <dd>{current.isbn}</dd>
                    </>
                  )}
                  <dt>Shelf</dt>
                  <dd>{data.shelves.find((s) => s.id === current.shelfId)?.name}</dd>
                </dl>
                {!artworkReady && !artworkError && (
                  <p role="status">Preparing object and artwork…</p>
                )}
                {artworkError && (
                  <p role="alert" className="library-binding-note">
                    {artworkError}
                  </p>
                )}
                {objectType(current).geometry === 'case' && (
                  <button className="library-read-button" onClick={() => setCaseOpen((v) => !v)}>
                    {caseOpen ? 'Close case' : 'Open case'}
                  </button>
                )}
                {current.front && (
                  <button className="xp-button" onClick={() => setArtwork(current)}>
                    View flat artwork
                  </button>
                )}
                {current.artwork?.manual && (
                  <button
                    className="library-read-button"
                    onClick={() => {
                      setReadingRole('manual');
                      setReading(current);
                    }}
                  >
                    Read manual
                  </button>
                )}
                {current.canRead ? (
                  <button
                    className="library-read-button"
                    onClick={() => {
                      setReadingRole(undefined);
                      setReading(current);
                    }}
                  >
                    <BookOpen size={16} />
                    Read {current.digital?.mime === 'application/pdf' ? 'PDF' : 'EPUB'} edition →
                  </button>
                ) : objectType(current).document ? (
                  <p className="library-unavailable">No public reading edition is available.</p>
                ) : null}
              </aside>
            )}
          </div>
          {(indexOpen || books.length > 0) && (
            <div
              className={`library-index ${indexOpen ? 'expanded' : ''}`}
              aria-label={category === 'books' ? 'Book index' : 'Collection objects'}
            >
              {pageBooks.map((book) => (
                <button
                  key={book.id}
                  aria-pressed={selected === book.id}
                  onClick={() => inspect(book.id)}
                >
                  {book.objectType === 'model' && book.front ? (
                    <CollectionThumbnail
                      id={book.front.id}
                      repository={repository}
                      color={book.color}
                    />
                  ) : (
                    <i style={{ background: book.color }} />
                  )}
                  <span>
                    {category === 'books' && book.bookNumber ? `${book.bookNumber} · ` : ''}
                    {book.title}
                    <small>{book.author}</small>
                  </span>
                </button>
              ))}
              {books.length > pageSize && (
                <nav>
                  <button
                    disabled={!page}
                    onClick={() => {
                      setPage((p) => p - 1);
                      setSelected('');
                    }}
                  >
                    Previous shelf page
                  </button>
                  <span>
                    {page + 1} / {Math.ceil(books.length / pageSize)}
                  </span>
                  <button
                    disabled={(page + 1) * pageSize >= books.length}
                    onClick={() => {
                      setPage((p) => p + 1);
                      setSelected('');
                    }}
                  >
                    Next shelf page
                  </button>
                </nav>
              )}
            </div>
          )}
          <footer className="library-footer">
            <span>Collected with care. Every object has a story.</span>
            <button onClick={ownerAccess}>
              <LockKeyhole size={11} />
              {owner ? 'Librarian’s desk' : 'Owner access'}
            </button>
          </footer>
        </>
      )}
      {artwork && (
        <ArtworkViewer item={artwork} repository={repository} onClose={() => setArtwork(null)} />
      )}
      {reading && (
        <Reader
          book={reading}
          role={readingRole}
          repository={repository}
          active={active}
          onClose={() => setReading(null)}
        />
      )}
    </div>
  );
}
