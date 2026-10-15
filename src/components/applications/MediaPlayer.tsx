import { useEffect, useRef, useState } from 'react';
import { Music2, Film, SkipBack, SkipForward } from 'lucide-react';
import { mediaStore, type LocalMedia } from '../../lib/media-store';
import { serviceRequest } from '../../lib/library/api';
import OwnerAccess, { useOwnerSession } from './OwnerAccess';
import { useDesktop } from '../../lib/DesktopContext';
type SharedMedia = {
  id: string;
  title: string;
  kind: 'audio' | 'video';
  mime: string;
  bytes: number;
  published: boolean;
  url: string | null;
};
const base = (import.meta.env.VITE_LIBRARY_API_URL || '').replace(/\/$/, '');
export default function MediaPlayer() {
  const owner = useOwnerSession(),
    { settings } = useDesktop();
  const [tab, setTab] = useState<'shared' | 'local' | 'owner'>('shared'),
    [local, setLocal] = useState<LocalMedia[]>([]),
    [shared, setShared] = useState<SharedMedia[]>([]);
  const [selected, setSelected] = useState<string>(''),
    [source, setSource] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(''),
    [link, setLink] = useState(''),
    [kind, setKind] = useState('audio'),
    [publish, setPublish] = useState(false),
    [repeat, setRepeat] = useState(false),
    [shuffle, setShuffle] = useState(false);
  const media = useRef<HTMLMediaElement | null>(null),
    continuePlaying = useRef(false);
  const tracks = tab === 'local' ? local : shared;
  const current = tracks.find((t) => t.id === selected);
  async function reload() {
    if (tab === 'local')
      setLocal((await mediaStore.list()).sort((a, b) => a.createdAt - b.createdAt));
    else if (tab !== 'owner' || owner)
      setShared(await (await serviceRequest(tab === 'owner' ? '/admin/media' : '/media')).json());
  }
  useEffect(() => {
    setSelected('');
    setShared([]);
    setSource('');
    setError('');
    setLoading(true);
    let live = true;
    const load = async () => {
      try {
        if (tab === 'local') {
          const list = await mediaStore.list();
          if (live) setLocal(list.sort((a, b) => a.createdAt - b.createdAt));
        } else if (tab !== 'owner' || owner) {
          const list = await (
            await serviceRequest(tab === 'owner' ? '/admin/media' : '/media')
          ).json();
          if (live) setShared(list);
        }
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        if (live) setLoading(false);
      }
    };
    void load();
    return () => {
      live = false;
    };
  }, [tab, owner]);
  useEffect(() => {
    let live = true,
      url = '';
    setSource('');
    if (!current) return;
    async function resolve() {
      try {
        if ('blob' in current!) {
          url = URL.createObjectURL((current as LocalMedia).blob);
        } else {
          const item = current as SharedMedia;
          if (!item.published && !item.url) {
            const blob = await (await serviceRequest(`/media/${item.id}/content`)).blob();
            if (!live) return;
            url = URL.createObjectURL(blob);
          } else url = item.url || `${base}/media/${item.id}/content`;
        }
        if (live) setSource(url);
        else if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      } catch (e) {
        if (live) setError((e as Error).message);
      }
    }
    void resolve();
    return () => {
      live = false;
      media.current?.pause();
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    };
  }, [current?.id, tab, current && 'published' in current ? current.published : undefined]);
  useEffect(() => {
    if (media.current) {
      media.current.volume = settings.volume;
      media.current.muted = !settings.sound;
    }
  }, [source, settings.volume, settings.sound]);
  async function perform(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function next(direction: number, ended = false) {
    if (!tracks.length) return;
    const index = tracks.findIndex((t) => t.id === selected);
    if (ended && !repeat && index === tracks.length - 1 && !shuffle) return;
    const i =
      shuffle && tracks.length > 1
        ? (index + 1 + Math.floor(Math.random() * (tracks.length - 1))) % tracks.length
        : (index + direction + tracks.length) % tracks.length;
    continuePlaying.current = ended || Boolean(media.current && !media.current.paused);
    if (tracks[i].id === selected && media.current) {
      media.current.currentTime = 0;
      void media.current.play().catch(() => setError('Press Play to continue.'));
    } else setSelected(tracks[i].id);
  }
  const loaded = () => {
    if (continuePlaying.current) {
      continuePlaying.current = false;
      void media.current?.play().catch(() => setError('Press Play to continue playback.'));
    }
  };
  async function upload(file: File) {
    await perform(async () => {
      if (!/\.(mp3|mp4|m4a)$/i.test(file.name)) throw new Error('Choose an MP3 or MP4 media file.');
      if (file.size > 100 * 1024 * 1024)
        throw new Error(
          'Files can be up to 100 MB. For longer movies, add a hosted stream URL in the owner library.',
        );
      if (tab === 'local') {
        await mediaStore.put({
          id: crypto.randomUUID(),
          title: file.name.replace(/\.[^.]+$/, ''),
          kind: /\.(mp3|m4a)$/i.test(file.name) ? 'audio' : 'video',
          blob: file,
          createdAt: Date.now(),
        });
      } else {
        const body = new FormData();
        body.append('file', file);
        body.append('title', title.trim() || file.name.replace(/\.[^.]+$/, ''));
        body.append('published', String(publish));
        await (await serviceRequest('/admin/media/uploads', { method: 'POST', body })).json();
        setTitle('');
      }
      await reload();
    });
  }
  return (
    <div className="media-player">
      <header>
        <Music2 />
        <div>
          <small>PERSONAL COMPUTER</small>
          <h1>Media Player</h1>
        </div>
      </header>
      <nav className="chess-tabs" aria-label="Media library">
        {[
          ['shared', 'Shared library'],
          ['local', 'On this device'],
          ['owner', 'Manage library'],
        ].map(([id, label]) => (
          <button
            key={id}
            disabled={busy}
            aria-pressed={tab === id}
            onClick={() => setTab(id as typeof tab)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === 'owner' && !owner ? (
        <OwnerAccess />
      ) : (
        <>
          <div className={`media-stage ${current?.kind === 'video' ? 'video-stage' : ''}`}>
            {current?.kind !== 'video' && (
              <div className="media-album">
                <Music2 size={56} />
                <h2>{current?.title || 'Make room for a little music.'}</h2>
                <p>{current ? 'MP3 / audio' : 'Your songs and films, in one familiar player.'}</p>
              </div>
            )}
            {source &&
              (current?.kind === 'video' ? (
                <video
                  ref={(el) => {
                    media.current = el;
                  }}
                  src={source}
                  controls
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={loaded}
                  onEnded={() => next(1, true)}
                  onError={() =>
                    setError(
                      'This video could not be played. Check the file or use an MP4 with H.264 video and AAC audio.',
                    )
                  }
                  aria-label={current.title}
                />
              ) : (
                <audio
                  ref={(el) => {
                    media.current = el;
                  }}
                  src={source}
                  controls
                  preload="metadata"
                  onLoadedMetadata={loaded}
                  onEnded={() => next(1, true)}
                  onError={() =>
                    setError('This audio could not be played. Check the file or hosted URL.')
                  }
                  aria-label={current?.title}
                />
              ))}
          </div>
          <div className="media-controls">
            <button aria-label="Previous track" disabled={!tracks.length} onClick={() => next(-1)}>
              <SkipBack size={18} />
            </button>
            <button aria-label="Next track" disabled={!tracks.length} onClick={() => next(1)}>
              <SkipForward size={18} />
            </button>
            <label>
              <input
                type="checkbox"
                checked={shuffle}
                onChange={(e) => setShuffle(e.target.checked)}
              />
              Shuffle
            </label>
            <label>
              <input
                type="checkbox"
                checked={repeat}
                onChange={(e) => setRepeat(e.target.checked)}
              />
              Repeat playlist
            </label>
          </div>
          {tab === 'local' && (
            <div className="media-add">
              <label>
                Add MP3 / MP4 files
                <input
                  type="file"
                  accept=".mp3,.mp4,.m4a,audio/mpeg,video/mp4,audio/mp4"
                  disabled={busy}
                  multiple
                  onChange={(e) => {
                    const files = [...(e.target.files || [])];
                    e.target.value = '';
                    void (async () => {
                      for (const f of files) await upload(f);
                    })();
                  }}
                />
              </label>
              <small>
                Saved in this browser only · 100 MB per file · larger movies can use a hosted
                stream.
              </small>
            </div>
          )}
          {tab === 'owner' && (
            <section className="media-add">
              <h2>Add to the shared library</h2>
              <label>
                Media title
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={publish}
                  onChange={(e) => setPublish(e.target.checked)}
                />
                Publish for visitors
              </label>
              <label>
                Upload MP3 / MP4 · up to 100 MB
                <input
                  aria-label="Upload shared media"
                  type="file"
                  accept=".mp3,.mp4,.m4a"
                  disabled={busy}
                  onChange={(e) => {
                    if (e.target.files?.[0]) void upload(e.target.files[0]);
                    e.target.value = '';
                  }}
                />
              </label>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void perform(async () => {
                    await serviceRequest('/admin/media/links', {
                      method: 'POST',
                      body: JSON.stringify({ title, kind, url: link, published: publish }),
                    });
                    setLink('');
                    setTitle('');
                    await reload();
                  });
                }}
              >
                <label>
                  Or a direct HTTPS media URL
                  <input
                    type="url"
                    placeholder="https://…/movie.mp4"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Format
                  <select value={kind} onChange={(e) => setKind(e.target.value)}>
                    <option value="audio">Audio</option>
                    <option value="video">Video</option>
                  </select>
                </label>
                <button disabled={busy || !title.trim()}>Add hosted media</button>
                <small>
                  Use a direct playable file URL, not a YouTube or streaming-service page. Published
                  links are visible to visitors.
                </small>
              </form>
            </section>
          )}
          {loading ? (
            <p role="status">Loading the playlist…</p>
          ) : (
            <ol className="media-playlist" aria-label="Playlist">
              {tracks.map((t) => (
                <li key={t.id}>
                  <button
                    aria-pressed={selected === t.id}
                    onClick={() => {
                      setError('');
                      setSelected(t.id);
                    }}
                  >
                    {t.kind === 'audio' ? <Music2 size={18} /> : <Film size={18} />}
                    <span>{t.title}</span>
                    {'published' in t && tab === 'owner' && (
                      <small>{t.published ? 'Published' : 'Private'}</small>
                    )}
                  </button>
                  {tab !== 'shared' && (
                    <div>
                      {'published' in t && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            void perform(async () => {
                              await serviceRequest('/admin/media/' + t.id, {
                                method: 'PUT',
                                body: JSON.stringify({ title: t.title, published: !t.published }),
                              });
                              await reload();
                            })
                          }
                        >
                          {t.published ? 'Unpublish' : 'Publish'}
                        </button>
                      )}
                      <button
                        disabled={busy}
                        aria-label={'Delete ' + t.title}
                        onClick={() =>
                          void perform(async () => {
                            if (tab === 'local') await mediaStore.remove(t.id);
                            else await serviceRequest('/admin/media/' + t.id, { method: 'DELETE' });
                            if (selected === t.id) setSelected('');
                            await reload();
                          })
                        }
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
          {!loading && !tracks.length && (
            <p className="media-empty">
              {tab === 'shared'
                ? 'No music or films have been published yet.'
                : 'Add a file to start your playlist.'}
            </p>
          )}
        </>
      )}
      {busy && <p role="status">Saving media…</p>}
      {error && (
        <p className="os-error" role="alert">
          {error}
          <button onClick={() => void perform(reload)}>Retry library</button>
        </p>
      )}
    </div>
  );
}
