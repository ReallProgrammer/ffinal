import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess as Rules, type Square } from 'chess.js';
import OwnerAccess, { useOwnerSession } from '../applications/OwnerAccess';
import { libraryApi } from '../../lib/library/api';
import {
  chessRequest,
  savedVisitor,
  saveVisitor,
  type Match,
  type VisitorSession,
} from '../../lib/chess/api';
import { readStorage, writeStorage } from '../../lib/storage';
const glyphs: Record<string, string> = {
  wk: '♔',
  wq: '♕',
  wr: '♖',
  wb: '♗',
  wn: '♘',
  wp: '♙',
  bk: '♚',
  bq: '♛',
  br: '♜',
  bb: '♝',
  bn: '♞',
  bp: '♟',
};
const names: Record<string, string> = {
  k: 'king',
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
  p: 'pawn',
};
export default function Chess({ ownerView = false }: { ownerView?: boolean }) {
  const owner = useOwnerSession();
  const [mode, setMode] = useState<'bot' | 'visitor' | 'owner'>(
    ownerView ? 'owner' : savedVisitor() ? 'visitor' : 'bot',
  );
  const [difficulty, setDifficulty] = useState('casual'),
    [pgn, setPgn] = useState(() => {
      const saved = readStorage('pc-chess-bot', '');
      try {
        const game = new Rules();
        if (saved) game.loadPgn(saved);
        return game.pgn();
      } catch {
        return '';
      }
    });
  const [visitor, setVisitor] = useState<VisitorSession | null>(savedVisitor),
    [match, setMatch] = useState<Match | null>(null),
    [queue, setQueue] = useState<Match[]>([]);
  const [selected, setSelected] = useState<Square | null>(null),
    [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [nickname, setNickname] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [thinking, setThinking] = useState(false),
    [pushMessage, setPushMessage] = useState('');
  const [pushConfig, setPushConfig] = useState<{
    pushAvailable: boolean;
    telegramAvailable: boolean;
    publicKey: string | null;
  } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null),
    matchRef = useRef(match);
  matchRef.current = match;
  function updateMatch(next: Match) {
    setMatch((current) =>
      current?.id === next.id && current.version > next.version ? current : next,
    );
  }
  const game = useMemo(() => {
    const c = new Rules();
    try {
      const source = mode === 'bot' ? pgn : match?.pgn;
      if (source) c.loadPgn(source);
    } catch {
      /* Invalid local save starts a fresh board. */
    }
    return c;
  }, [pgn, match?.pgn, mode]);
  const player = mode === 'owner' ? 'b' : 'w';
  const playable = mode === 'bot' ? !game.isGameOver() : match?.status === 'active';
  const turnAllowed = playable && game.turn() === player && !busy && !thinking;
  const moves = selected ? game.moves({ square: selected, verbose: true }) : [];
  const history = game.history({ verbose: true }),
    last = history.at(-1);
  useEffect(() => {
    if (mode === 'bot') writeStorage('pc-chess-bot', pgn);
  }, [pgn, mode]);
  useEffect(() => {
    setSelected(null);
    setPromotion(null);
  }, [mode, match?.id, match?.version]);
  useEffect(() => {
    if (mode !== 'bot' || game.turn() !== 'b' || game.isGameOver()) {
      setThinking(false);
      return;
    }
    setThinking(true);
    const worker = new Worker(new URL('../../lib/chess/bot.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = ({ data }) => {
      if (data) {
        const next = new Rules();
        if (pgn) next.loadPgn(pgn);
        try {
          next.move(data);
          setPgn(next.pgn());
        } catch {
          setError('The bot could not finish its move. Start a new game.');
        }
      }
      setThinking(false);
    };
    worker.onerror = () => {
      setError('The chess worker could not load. Reload and try again.');
      setThinking(false);
    };
    worker.postMessage({ pgn, difficulty });
    return () => worker.terminate();
  }, [pgn, difficulty, mode]);
  useEffect(() => {
    if (mode === 'bot' || (mode === 'owner' && !owner) || (mode === 'visitor' && !visitor)) return;
    let live = true,
      inflight = false;
    const refresh = async () => {
      if (inflight || document.hidden) return;
      inflight = true;
      try {
        if (mode === 'owner') {
          const requests = await chessRequest<Match[]>('/admin/chess/matches');
          if (!live) return;
          setQueue(requests);
          const current = matchRef.current;
          const relevant =
            requests.find((m) => m.id === current?.id) ||
            requests.find((m) => m.status === 'active');
          if (relevant) updateMatch(relevant);
        } else {
          const next = await chessRequest<Match>(
            '/chess/matches/' + visitor!.id,
            'GET',
            undefined,
            visitor!,
          );
          if (live) updateMatch(next);
        }
        if (live) setError('');
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        inflight = false;
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 3000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [mode, owner, visitor?.id]);
  useEffect(() => {
    if (owner)
      void chessRequest<typeof pushConfig>('/chess/config')
        .then(setPushConfig)
        .catch(() => {});
  }, [owner]);
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
  async function move(from: Square, to: Square, promote?: string) {
    setSelected(null);
    setPromotion(null);
    if (mode === 'bot') {
      try {
        game.move({ from, to, promotion: promote });
        setPgn(game.pgn());
      } catch {
        setError('Choose one of the highlighted legal squares.');
      }
      return;
    }
    if (!match) return;
    await perform(async () =>
      updateMatch(
        await chessRequest<Match>(
          `/chess/matches/${match.id}/moves`,
          'POST',
          { from, to, ...(promote ? { promotion: promote } : {}), version: match.version },
          mode === 'visitor' ? visitor! : undefined,
        ),
      ),
    );
  }
  function choose(square: Square) {
    if (!turnAllowed) return;
    const legal = moves.filter((m) => m.to === square);
    if (selected && legal.length) {
      if (legal.some((m) => m.promotion)) setPromotion({ from: selected, to: square });
      else void move(selected, square);
      return;
    }
    setSelected(game.get(square)?.color === player ? square : null);
  }
  async function notifications() {
    await perform(async () => {
      if (!pushConfig?.pushAvailable || !pushConfig.publicKey)
        throw new Error(
          'Configure VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT on the server first.',
        );
      if (
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      )
        throw new Error(
          'Push is unavailable here. On iPhone, add this site to your Home Screen, then open it there.',
        );
      if ((await Notification.requestPermission()) !== 'granted')
        throw new Error(
          'Notifications are not permitted. You can enable them in your browser settings.',
        );
      const registration = await navigator.serviceWorker.register(
        import.meta.env.BASE_URL + 'chess-push-sw.js',
        { scope: import.meta.env.BASE_URL },
      );
      await navigator.serviceWorker.ready;
      let sub = await registration.pushManager.getSubscription();
      if (!sub) {
        const raw = atob(pushConfig.publicKey.replace(/-/g, '+').replace(/_/g, '/'));
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)),
        });
      }
      await chessRequest('/admin/chess/push', 'POST', sub.toJSON());
      setPushMessage('This device will receive new match notifications.');
    });
  }
  const squares = Array.from(
    { length: 64 },
    (_, i) =>
      `${'abcdefgh'[player === 'b' ? 7 - (i % 8) : i % 8]}${player === 'b' ? Math.floor(i / 8) + 1 : 8 - Math.floor(i / 8)}` as Square,
  );
  const status =
    mode !== 'bot' && match?.status !== 'active'
      ? match?.result ||
        (match
          ? 'Waiting for the owner — request expires after 15 minutes.'
          : 'Request a match to get started.')
      : game.isCheckmate()
        ? `${game.turn() === 'w' ? 'Black' : 'White'} wins by checkmate`
        : game.isDraw()
          ? 'Draw'
          : thinking
            ? 'The bot is thinking…'
            : `${game.turn() === 'w' ? 'White' : 'Black'} to move${game.isCheck() ? ' · Check' : ''}`;
  return (
    <div className="chess-app">
      <header>
        <div>
          <small>ACCESSORIES / CHESS CLUB</small>
          <h1>Your next move.</h1>
        </div>
        <span className="chess-emblem">♞</span>
      </header>
      <nav className="chess-tabs" aria-label="Chess mode">
        {[
          ['bot', 'Play a bot'],
          ['visitor', 'Play the owner'],
          ['owner', 'Owner dashboard'],
        ].map(([id, label]) => (
          <button
            key={id}
            disabled={busy}
            aria-pressed={mode === id}
            onClick={() => {
              setMode(id as typeof mode);
              setMatch(null);
              setError('');
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {mode === 'owner' && !owner ? (
        <OwnerAccess />
      ) : (
        <>
          {mode === 'bot' && (
            <div className="chess-controls">
              <label>
                Bot difficulty
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  <option value="beginner">Beginner · relaxed</option>
                  <option value="casual">Casual · thinks ahead</option>
                  <option value="club">Club · deeper search</option>
                </select>
              </label>
              <button
                onClick={() => {
                  setPgn('');
                  setSelected(null);
                  setError('');
                }}
              >
                New game
              </button>
            </div>
          )}
          {mode === 'visitor' && !visitor && (
            <form
              className="chess-request"
              onSubmit={(e) => {
                e.preventDefault();
                void perform(async () => {
                  const result = await chessRequest<{ match: Match; token: string }>(
                    '/chess/matches',
                    'POST',
                    { nickname },
                  );
                  const v = { id: result.match.id, token: result.token };
                  saveVisitor(v);
                  setVisitor(v);
                  updateMatch(result.match);
                });
              }}
            >
              <label>
                Your display name
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={40}
                  required
                />
              </label>
              <button disabled={busy}>Request a match</button>
              <p>
                The owner gets a dashboard request and, when configured, a phone alert. Availability
                is not guaranteed. You play White.
              </p>
            </form>
          )}
          {mode === 'owner' && (
            <section className="chess-dashboard">
              <p className="chess-alert-status" role="status">
                <b>
                  {pushConfig?.telegramAvailable
                    ? 'Telegram configured'
                    : 'Telegram not connected yet'}
                </b>
                <span>
                  {pushConfig?.telegramAvailable
                    ? 'New requests send an alert to your Telegram chat with a link to join here.'
                    : 'Add your bot token, chat ID and site URL in Render to enable phone alerts. Requests still appear below.'}
                </span>
              </p>
              <div className="chess-controls">
                <button onClick={() => void notifications()} disabled={busy}>
                  Enable browser alerts
                </button>
                <button
                  onClick={() =>
                    void perform(async () => {
                      const registration = await navigator.serviceWorker?.getRegistration(
                        import.meta.env.BASE_URL,
                      );
                      const sub = await registration?.pushManager.getSubscription();
                      if (sub) {
                        await chessRequest('/admin/chess/push', 'DELETE', {
                          endpoint: sub.endpoint,
                        });
                        await sub.unsubscribe();
                      }
                      setPushMessage('Notifications disabled on this device.');
                    })
                  }
                >
                  Disable browser alerts
                </button>
                <button onClick={() => void libraryApi.logout()}>Sign out</button>
              </div>
              <small>
                {pushMessage ||
                  (pushConfig?.pushAvailable
                    ? 'Enable notifications on each phone or browser you want to use.'
                    : 'Browser alerts are optional and need separate keys. Telegram works without browser permissions.')}
              </small>
              <h2 aria-live="polite">
                Match requests <span>{queue.filter((m) => m.status === 'waiting').length}</span>
              </h2>
              {!queue.some((m) => ['waiting', 'active'].includes(m.status)) && (
                <p>No visitors waiting. Keep this dashboard open for new requests.</p>
              )}
              {queue
                .filter((m) => ['waiting', 'active'].includes(m.status))
                .map((m) => (
                  <article key={m.id}>
                    <div>
                      <b>{m.nickname}</b>
                      <small>
                        {m.status === 'waiting' ? 'Waiting to play' : 'Match in progress'}
                      </small>
                    </div>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void perform(async () =>
                          updateMatch(
                            m.status === 'active'
                              ? m
                              : await chessRequest<Match>(
                                  `/admin/chess/matches/${m.id}/accept`,
                                  'POST',
                                ),
                          ),
                        )
                      }
                    >
                      {m.status === 'active' ? 'Resume match' : 'Join match'}
                    </button>
                    {m.status === 'waiting' && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void perform(async () => {
                            await chessRequest(`/chess/matches/${m.id}/close`, 'POST');
                            setQueue((q) => q.filter((v) => v.id !== m.id));
                          })
                        }
                      >
                        Decline
                      </button>
                    )}
                  </article>
                ))}
            </section>
          )}
          {(mode === 'bot' || match) && (
            <div className="chess-play-area">
              <div>
                <div className="chess-status" role="status">
                  {status}
                </div>
                <div
                  className="chess-board"
                  ref={boardRef}
                  role="group"
                  aria-label="Chess board"
                  aria-busy={thinking || busy}
                >
                  {squares.map((square, i) => {
                    const piece = game.get(square);
                    const target = moves.some((m) => m.to === square);
                    return (
                      <button
                        key={square}
                        aria-label={`${square}${piece ? ' ' + (piece.color === 'w' ? 'white' : 'black') + ' ' + names[piece.type] : ''}${target ? ' legal move' : ''}`}
                        aria-pressed={selected === square}
                        disabled={!turnAllowed}
                        className={`${(i + Math.floor(i / 8)) % 2 ? 'dark' : 'light'} ${selected === square ? 'selected' : ''} ${target ? 'legal' : ''} ${last && (last.from === square || last.to === square) ? 'last-move' : ''} ${piece?.type === 'k' && piece.color === game.turn() && game.isCheck() ? 'checked' : ''}`}
                        onClick={() => choose(square)}
                        onKeyDown={(e) => {
                          const direction = (
                            { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 8, ArrowUp: -8 } as Record<
                              string,
                              number
                            >
                          )[e.key];
                          if (direction) {
                            e.preventDefault();
                            boardRef.current
                              ?.querySelectorAll('button')
                              [(i + direction + 64) % 64]?.focus();
                          }
                        }}
                      >
                        <span
                          className={`chess-piece ${piece?.color === 'w' ? 'white-piece' : 'black-piece'}`}
                        >
                          {piece ? glyphs[piece.color + piece.type] : ''}
                        </span>
                        {i % 8 === 0 && <small className="rank-label">{square[1]}</small>}
                        {i >= 56 && <small className="file-label">{square[0]}</small>}
                      </button>
                    );
                  })}
                </div>
                <p className="chess-side-note">
                  You play {player === 'w' ? 'White' : 'Black'}. Select a piece, then a highlighted
                  square.
                </p>
                {promotion && (
                  <div className="chess-promotion" role="dialog" aria-label="Promote pawn">
                    <b>Choose a promotion</b>
                    {['q', 'r', 'b', 'n'].map((p) => (
                      <button key={p} onClick={() => void move(promotion.from, promotion.to, p)}>
                        {names[p]}
                      </button>
                    ))}
                  </div>
                )}
                {mode !== 'bot' && match && (
                  <div className="chess-controls">
                    {['waiting', 'active'].includes(match.status) ? (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void perform(async () =>
                            updateMatch(
                              await chessRequest<Match>(
                                `/chess/matches/${match.id}/close`,
                                'POST',
                                undefined,
                                mode === 'visitor' ? visitor! : undefined,
                              ),
                            ),
                          )
                        }
                      >
                        {match.status === 'waiting' ? 'Cancel request' : 'Resign match'}
                      </button>
                    ) : (
                      mode === 'visitor' && (
                        <button
                          onClick={() => {
                            saveVisitor(null);
                            setVisitor(null);
                            setMatch(null);
                          }}
                        >
                          Request another match
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
              <aside>
                <h2>Moves</h2>
                <ol className="chess-moves">
                  {Array.from({ length: Math.ceil(history.length / 2) }, (_, i) => (
                    <li key={i}>
                      <span>{history[i * 2]?.san}</span>
                      <span>{history[i * 2 + 1]?.san || '…'}</span>
                    </li>
                  ))}
                </ol>
                {!history.length && <p>The board is yours.</p>}
              </aside>
            </div>
          )}
        </>
      )}
      {error && (
        <p className="os-error" role="alert">
          {error}
          {mode === 'visitor' && visitor && !match && (
            <button
              onClick={() => {
                saveVisitor(null);
                setVisitor(null);
              }}
            >
              Forget this session
            </button>
          )}
        </p>
      )}
    </div>
  );
}
