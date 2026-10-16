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
import { useBotMatch } from '../../lib/chess/useBotMatch';
import ChessResult from './ChessResult';
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
  const [difficulty, setDifficulty] = useState('casual');
  const bot = useBotMatch(mode === 'bot'),
    pgn = bot.state.pgn;
  const [timeControl, setTimeControl] = useState(bot.state.timeControl);
  const [theme, setTheme] = useState(() => {
    const saved = readStorage('pc-chess-theme', 'classic');
    return ['classic', 'walnut', 'midnight', 'ocean'].includes(saved) ? saved : 'classic';
  });
  const [review, setReview] = useState<number | null>(null),
    [dismissed, setDismissed] = useState('');
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 200);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    writeStorage('pc-chess-theme', theme);
  }, [theme]);
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
  const playable =
    mode === 'bot' ? !game.isGameOver() && !bot.state.result : match?.status === 'active';
  const turnAllowed = playable && review === null && game.turn() === player && !busy && !thinking;
  const moves = selected ? game.moves({ square: selected, verbose: true }) : [];
  const history = game.history({ verbose: true });
  const viewing = useMemo(() => {
    if (review === null) return game;
    const board = new Rules();
    for (const move of history.slice(0, review)) board.move(move);
    return board;
  }, [game, review]);
  const last = review === null ? history.at(-1) : history[review - 1];
  const result =
    mode === 'bot'
      ? bot.state.result ||
        (game.isCheckmate()
          ? `${game.turn() === 'w' ? 'Black' : 'White'} wins by checkmate`
          : game.isDraw()
            ? 'Draw'
            : '')
      : match && ['finished', 'expired', 'cancelled'].includes(match.status)
        ? match.result
        : '';
  const resultKey = `${mode}:${match?.id || pgn}:${result}`;
  const won =
    mode === 'bot'
      ? result.startsWith('White wins')
      : result.startsWith(mode === 'owner' ? 'Owner wins' : 'Visitor wins');
  const outcome = result.startsWith('Draw')
    ? 'draw'
    : result.includes('wins')
      ? won
        ? 'win'
        : 'lose'
      : 'ended';
  const clocks =
    mode === 'bot' ? bot.clock : { whiteMs: match?.whiteMs || 0, blackMs: match?.blackMs || 0 };
  if (mode !== 'bot' && match?.status === 'active' && match.timeControl) {
    const elapsed = Math.max(0, performance.now() - (match.receivedAt || performance.now()));
    if (game.turn() === 'w') clocks.whiteMs = Math.max(0, clocks.whiteMs - elapsed);
    else clocks.blackMs = Math.max(0, clocks.blackMs - elapsed);
  }
  const formatClock = (ms: number) =>
    `${Math.floor(Math.ceil(ms / 1000) / 60)}:${String(Math.ceil(ms / 1000) % 60).padStart(2, '0')}`;
  const timerOptions = (
    <>
      <option value={0}>Untimed</option>
      {[3, 5, 10, 15].map((n) => (
        <option key={n} value={n * 60}>
          {n} minutes
        </option>
      ))}
    </>
  );
  const changeReview = (value: number | null) => {
    setReview(value);
    setSelected(null);
    setPromotion(null);
  };
  useEffect(() => {
    changeReview(null);
  }, [mode, match?.id]);
  useEffect(() => {
    setSelected(null);
    setPromotion(null);
  }, [mode, match?.id, match?.version]);
  useEffect(() => {
    if (mode !== 'bot' || game.turn() !== 'b' || game.isGameOver() || bot.state.result) {
      setThinking(false);
      return;
    }
    setThinking(true);
    const worker = new Worker(new URL('../../lib/chess/bot.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = ({ data }) => {
      if (data) {
        try {
          bot.play(data, pgn);
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
  }, [pgn, difficulty, mode, bot.state.result]);
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
        bot.play({ from, to, promotion: promote });
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
    if (mode === 'bot') bot.start();
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
  const status = result
    ? result
    : mode !== 'bot' && match?.status !== 'active'
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
    <div
      className="chess-app"
      data-chess-theme={
        ['classic', 'walnut', 'midnight', 'ocean'].includes(theme) ? theme : 'classic'
      }
    >
      {result && dismissed !== resultKey && (
        <ChessResult
          key={resultKey}
          outcome={outcome}
          message={result}
          onClose={() => setDismissed(resultKey)}
          onReview={() => {
            setDismissed(resultKey);
            changeReview(0);
          }}
        />
      )}
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
              <label>
                New game clock
                <select
                  aria-label="New game clock"
                  value={timeControl}
                  onChange={(e) => setTimeControl(Number(e.target.value))}
                >
                  {timerOptions}
                </select>
              </label>
              <button
                onClick={() => {
                  bot.newGame(timeControl);
                  changeReview(null);
                  setDismissed('');
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
                    { nickname, timeControl },
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
              <label>
                Match clock
                <select
                  value={timeControl}
                  onChange={(e) => setTimeControl(Number(e.target.value))}
                >
                  {timerOptions}
                </select>
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
                        {m.status === 'waiting' ? 'Waiting to play' : 'Match in progress'} ·{' '}
                        {m.timeControl ? `${m.timeControl / 60} min each` : 'Untimed'}
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
          <label className="chess-theme-control">
            Board theme
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="classic">Classic green</option>
              <option value="walnut">Walnut</option>
              <option value="midnight">Midnight</option>
              <option value="ocean">Ocean blue</option>
            </select>
          </label>
          {(mode === 'bot' || match) && (
            <div className="chess-play-area">
              <div>
                <div className="chess-clocks" aria-label="Chess clocks">
                  {(['w', 'b'] as const).map((color) => (
                    <div key={color} className={playable && game.turn() === color ? 'running' : ''}>
                      <span>{color === 'w' ? 'White' : 'Black'}</span>
                      <output aria-label={color === 'w' ? 'White clock' : 'Black clock'}>
                        {(mode === 'bot' ? bot.state.timeControl : match?.timeControl)
                          ? formatClock(color === 'w' ? clocks.whiteMs : clocks.blackMs)
                          : 'Untimed'}
                      </output>
                    </div>
                  ))}
                </div>
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
                    const piece = viewing.get(square);
                    const target = moves.some((m) => m.to === square);
                    return (
                      <button
                        key={square}
                        aria-label={`${square}${piece ? ' ' + (piece.color === 'w' ? 'white' : 'black') + ' ' + names[piece.type] : ''}${target ? ' legal move' : ''}`}
                        aria-pressed={selected === square}
                        disabled={!turnAllowed}
                        className={`${(i + Math.floor(i / 8)) % 2 ? 'dark' : 'light'} ${selected === square ? 'selected' : ''} ${target ? 'legal' : ''} ${last && (last.from === square || last.to === square) ? 'last-move' : ''} ${piece?.type === 'k' && piece.color === viewing.turn() && viewing.isCheck() ? 'checked' : ''}`}
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
                  {review !== null
                    ? `Reviewing move ${review} of ${history.length}. The live game continues. `
                    : ''}
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
              <aside className="chess-history">
                <h2>Move history</h2>
                <div className="chess-history-controls">
                  <button aria-label="First position" onClick={() => changeReview(0)}>
                    |←
                  </button>
                  <button
                    aria-label="Previous move"
                    disabled={(review ?? history.length) === 0}
                    onClick={() => changeReview(Math.max(0, (review ?? history.length) - 1))}
                  >
                    ←
                  </button>
                  <button
                    aria-label="Next move"
                    disabled={review === null || review >= history.length}
                    onClick={() => changeReview(Math.min(history.length, (review ?? 0) + 1))}
                  >
                    →
                  </button>
                  <button onClick={() => changeReview(null)} aria-pressed={review === null}>
                    Live board
                  </button>
                </div>
                {review !== null && (
                  <p className="chess-review-note">
                    Move {review} / {history.length} · viewing only
                  </p>
                )}
                <ol className="chess-moves">
                  {Array.from({ length: Math.ceil(history.length / 2) }, (_, i) => (
                    <li key={i}>
                      {[0, 1].map((side) => {
                        const ply = i * 2 + side;
                        return history[ply] ? (
                          <button
                            key={side}
                            aria-label={`Review move ${ply + 1}: ${history[ply].san}`}
                            aria-pressed={review === ply + 1}
                            onClick={() => changeReview(ply + 1)}
                          >
                            {history[ply].san}
                          </button>
                        ) : (
                          <span key={side}>…</span>
                        );
                      })}
                    </li>
                  ))}
                </ol>
                {!history.length && <p>The board is yours.</p>}
                {result && <button onClick={() => setDismissed('')}>Show result</button>}
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
