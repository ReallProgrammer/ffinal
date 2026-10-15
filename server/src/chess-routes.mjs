import { Chess } from 'chess.js';
import { notifyChessTelegram } from './telegram.mjs';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import webpush from 'web-push';
const hash = (v) => createHash('sha256').update(v).digest('hex');
const uuid = z.string().uuid();
const problem = (status, message) => Object.assign(new Error(message), { status });
const token = (req) => /^Bearer ([\w-]{43})$/.exec(req.headers.authorization || '')?.[1] || '';
const snapshot = (row) => ({
  id: row.id,
  nickname: row.nickname,
  status: row.status,
  fen: row.fen,
  pgn: row.pgn,
  version: row.version,
  result: row.result,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  expiresAt: row.expires_at,
});
export function chessRoutes(api, { db, owner, session, config }) {
  const telegramReady = Boolean(
    config.telegramBotToken && config.telegramChatId && config.chessSiteUrl,
  );
  const pushReady = Boolean(config.vapidPublicKey && config.vapidPrivateKey && config.vapidSubject);
  const expire = () =>
    db.query(
      "UPDATE chess_matches SET status='expired',result='Session expired',version=version+1 WHERE status IN ('waiting','active') AND expires_at<now()",
    );
  api.get('/chess/config', (_req, res) =>
    res.json({
      pushAvailable: pushReady,
      telegramAvailable: telegramReady,
      publicKey: pushReady ? config.vapidPublicKey : null,
      waitingMinutes: 15,
    }),
  );
  api.post(
    '/chess/matches',
    rateLimit({
      windowMs: 10 * 60 * 1000,
      limit: 3,
      legacyHeaders: false,
      message: { error: 'Please wait before requesting another match.' },
    }),
    async (req, res) => {
      const { nickname } = z
        .object({ nickname: z.string().trim().min(1).max(40) })
        .strict()
        .parse(req.body);
      const secret = randomBytes(32).toString('base64url'),
        id = randomUUID();
      const c = await db.connect();
      let row;
      try {
        await c.query('BEGIN');
        await c.query('SELECT pg_advisory_xact_lock(78245003)');
        await c.query(
          "UPDATE chess_matches SET status='expired',result='Request expired',version=version+1 WHERE status='waiting' AND expires_at<now()",
        );
        const count = Number(
          (await c.query("SELECT count(*) FROM chess_matches WHERE status='waiting'")).rows[0]
            .count,
        );
        if (count >= 50) throw problem(429, 'The owner queue is full. Try a bot while you wait.');
        row = (
          await c.query(
            "INSERT INTO chess_matches(id,nickname,guest_hash,fen,expires_at) VALUES($1,$2,$3,$4,now()+interval '15 minutes') RETURNING *",
            [id, nickname, hash(secret), new Chess().fen()],
          )
        ).rows[0];
        await c.query('COMMIT');
      } catch (e) {
        await c.query('ROLLBACK');
        throw e;
      } finally {
        c.release();
      }
      res.status(201).json({ match: snapshot(row), token: secret });
      if (telegramReady)
        void notifyChessTelegram(config, nickname).catch((error) =>
          console.error('Chess Telegram delivery failed:', error.statusCode || error.name),
        );
      // Durable dashboard request is saved even when a push service is unavailable.
      if (pushReady)
        void (async () => {
          const subscriptions = (await db.query('SELECT * FROM chess_push_subscriptions')).rows;
          await Promise.allSettled(
            subscriptions.map(async (sub) => {
              try {
                await webpush.sendNotification(
                  sub.subscription,
                  JSON.stringify({
                    title: 'New chess challenge',
                    body: `${nickname} would like to play. Open your dashboard to join.`,
                  }),
                  {
                    TTL: 900,
                    timeout: 8000,
                    vapidDetails: {
                      subject: config.vapidSubject,
                      publicKey: config.vapidPublicKey,
                      privateKey: config.vapidPrivateKey,
                    },
                  },
                );
              } catch (e) {
                if ([404, 410].includes(e.statusCode))
                  await db.query('DELETE FROM chess_push_subscriptions WHERE endpoint=$1', [
                    sub.endpoint,
                  ]);
                else console.error('Chess push delivery failed:', e.statusCode || e.code || e.name);
              }
            }),
          );
        })().catch(() => console.error('Chess push queue unavailable'));
    },
  );
  api.get('/admin/chess/matches', owner, async (_req, res) => {
    await expire();
    res.json(
      (
        await db.query(
          "SELECT * FROM chess_matches WHERE status IN ('waiting','active') OR updated_at>now()-interval '1 day' ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'waiting' THEN 1 ELSE 2 END,created_at DESC LIMIT 80",
        )
      ).rows.map(snapshot),
    );
  });
  api.get('/chess/matches/:id', async (req, res) => {
    await expire();
    const row = (
      await db.query('SELECT * FROM chess_matches WHERE id=$1', [uuid.parse(req.params.id)])
    ).rows[0];
    if (!row || (!(await session(req)) && (!token(req) || row.guest_hash !== hash(token(req)))))
      throw problem(404, 'Match not found or this session is not yours.');
    res.json(snapshot(row));
  });
  async function locked(req, work) {
    const id = uuid.parse(req.params.id),
      isOwner = await session(req),
      c = await db.connect();
    try {
      await c.query('BEGIN');
      await c.query('SELECT pg_advisory_xact_lock(78245004)');
      const row = (await c.query('SELECT * FROM chess_matches WHERE id=$1 FOR UPDATE', [id]))
        .rows[0];
      if (!row || (!isOwner && (!token(req) || row.guest_hash !== hash(token(req)))))
        throw problem(404, 'Match not found or this session is not yours.');
      if (new Date(row.expires_at) < new Date() && ['waiting', 'active'].includes(row.status))
        throw problem(409, 'This session expired. Request a new match.');
      await work(c, row, isOwner);
      const next = (await c.query('SELECT * FROM chess_matches WHERE id=$1', [id])).rows[0];
      await c.query('COMMIT');
      return snapshot(next);
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }
  api.post('/admin/chess/matches/:id/accept', owner, async (req, res) =>
    res.json(
      await locked(req, async (c, row) => {
        if (row.status !== 'waiting') throw problem(409, 'This request is no longer waiting.');
        if (
          (
            await c.query(
              "SELECT 1 FROM chess_matches WHERE status='active' AND expires_at>now() LIMIT 1",
            )
          ).rowCount
        )
          throw problem(409, 'Finish your current match before joining another.');
        await c.query(
          "UPDATE chess_matches SET status='active',version=version+1,updated_at=now(),expires_at=now()+interval '1 day' WHERE id=$1",
          [row.id],
        );
      }),
    ),
  );
  api.post('/chess/matches/:id/close', async (req, res) =>
    res.json(
      await locked(req, async (c, row, isOwner) => {
        if (!['waiting', 'active'].includes(row.status))
          throw problem(409, 'This match has already ended.');
        const result =
          row.status === 'waiting'
            ? isOwner
              ? 'Owner declined the request'
              : 'Visitor cancelled the request'
            : isOwner
              ? 'Visitor wins by resignation'
              : 'Owner wins by resignation';
        await c.query(
          'UPDATE chess_matches SET status=$2,result=$3,version=version+1,updated_at=now() WHERE id=$1',
          [row.id, row.status === 'waiting' ? 'cancelled' : 'finished', result],
        );
      }),
    ),
  );
  api.post(
    '/chess/matches/:id/moves',
    rateLimit({ windowMs: 60000, limit: 120, legacyHeaders: false }),
    async (req, res) => {
      const move = z
        .object({
          from: z.string().regex(/^[a-h][1-8]$/),
          to: z.string().regex(/^[a-h][1-8]$/),
          promotion: z.enum(['q', 'r', 'b', 'n']).optional(),
          version: z.number().int().nonnegative(),
        })
        .strict()
        .parse(req.body);
      res.json(
        await locked(req, async (c, row, isOwner) => {
          if (row.status !== 'active') throw problem(409, 'The match is not active.');
          if (row.version !== move.version)
            throw problem(409, 'The board changed. Wait for the latest move and try again.');
          const game = new Chess();
          if (row.pgn) game.loadPgn(row.pgn);
          if (game.turn() !== (isOwner ? 'b' : 'w')) throw problem(403, 'It is not your turn.');
          try {
            game.move({ from: move.from, to: move.to, promotion: move.promotion });
          } catch {
            throw problem(400, 'That move is not legal.');
          }
          const over = game.isGameOver() || game.history().length >= 600;
          const result = game.isCheckmate()
            ? isOwner
              ? 'Owner wins by checkmate'
              : 'Visitor wins by checkmate'
            : over
              ? 'Draw'
              : '';
          await c.query(
            "UPDATE chess_matches SET fen=$2,pgn=$3,status=$4,result=$5,version=version+1,updated_at=now(),expires_at=now()+interval '1 day' WHERE id=$1",
            [row.id, game.fen(), game.pgn(), over ? 'finished' : 'active', result],
          );
        }),
      );
    },
  );
  const subscription = z
    .object({
      endpoint: z
        .string()
        .url()
        .max(2048)
        .refine((v) => {
          const u = new URL(v);
          return (
            u.protocol === 'https:' &&
            !u.port &&
            !u.username &&
            !u.password &&
            (/^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com)$/.test(
              u.hostname,
            ) ||
              u.hostname.endsWith('.notify.windows.com'))
          );
        }),
      keys: z.object({
        p256dh: z
          .string()
          .regex(/^[\w=-]+$/)
          .max(200),
        auth: z
          .string()
          .regex(/^[\w=-]+$/)
          .max(100),
      }),
      expirationTime: z.number().nullable().optional(),
    })
    .strict();
  api.post('/admin/chess/push', owner, async (req, res) => {
    if (!pushReady)
      throw problem(
        503,
        'Phone notifications need VAPID keys configured on the server. Dashboard requests are ready.',
      );
    const sub = subscription.parse(req.body);
    if (
      Number((await db.query('SELECT count(*) FROM chess_push_subscriptions')).rows[0].count) >=
        10 &&
      !(await db.query('SELECT 1 FROM chess_push_subscriptions WHERE endpoint=$1', [sub.endpoint]))
        .rowCount
    )
      throw problem(409, 'Remove an old notification device before adding another.');
    await db.query(
      'INSERT INTO chess_push_subscriptions(endpoint,subscription) VALUES($1,$2) ON CONFLICT(endpoint) DO UPDATE SET subscription=$2',
      [sub.endpoint, sub],
    );
    res.sendStatus(204);
  });
  api.delete('/admin/chess/push', owner, async (req, res) => {
    const endpoint = z.string().url().parse(req.body.endpoint);
    await db.query('DELETE FROM chess_push_subscriptions WHERE endpoint=$1', [endpoint]);
    res.sendStatus(204);
  });
}
