# Chess, media, and desktop additions

The new applications reuse the existing window manager, owner account, PostgreSQL database, and private S3-compatible bucket. They do not require another database or authentication provider.

## Where to find them

- Finish the boot screen to reach the challenge terminal. Follow `ls` → `cat README.txt` → `cd training` → `cat briefing.txt`. Navigate into the archive and reveal hidden directories with `ls -a` to find `ctf.txt`. Submit its exact contents with `-flag FLAG{...}`. This unlocks the full portfolio terminal; type `help` to explore or `UIstart` to launch Windows. `hint` repeats the clue and `reset-challenge` restores missing challenge files. Challenge files are stored separately from portfolio files. Progress lasts for the current browser tab, including refreshes. This is a welcome puzzle, not an authorization mechanism.
- Start → Games → Chess, or Run → `chess`. Choose Beginner, Casual, or Club for a local bot; these are relative search strengths, not rated Elo levels. Games survive refreshes in browser storage. Choose Untimed or 3, 5, 10, or 15 minutes per side, then New game to apply the clock. A fresh bot clock starts when you first interact with the board; it pauses when you leave bot mode or close the chess window. Reviewing moves does not pause a live game. Four board themes are saved locally. Click move notation or use the history arrows to review positions; Live board returns to play. Win, loss, and draw dialogs offer move review.
- Chess → Play the owner creates a request. Chess → Owner dashboard uses the collection's owner sign-in and lists requests. The visitor plays White; the owner plays Black. A request expires after 15 minutes. Accepted games expire after 24 hours without a move. Choose the match clock before requesting. Clocks start when the owner joins and continue through refreshes or disconnections. The server enforces turns, legal moves, promotion, castling, en passant, draws, checkmate, and timeouts. Each poll or attempted move settles an expired clock; the client cannot submit clock values. Resignation and cancellation are supported. Refreshing the visitor's existing tab preserves their match; opening a different tab does not transfer that private session.
- Start → Media Player, or Run → `media`. “On this device” stores MP3/MP4/M4A files in IndexedDB. “Manage library” uses owner sign-in to upload, publish/unpublish, and delete hosted media. Visitors see only published entries. Larger movies can use a direct HTTPS media-file URL. A streaming-service webpage is not a playable file URL.
- Internet Explorer's home page includes a suspicious screensaver link. It runs a clearly labelled visual Trojan simulation with blocked-connection and quarantine stages, then stops at the all-clear screen. It downloads or executes nothing; Escape or Close exits immediately.

## Deployment

Deploy the server and frontend together. The server automatically applies migrations through version 8 at startup. Migration 7 adds `chess_matches`, `chess_push_subscriptions`, and `media_items` with row-level security; migration 8 adds authoritative chess clock fields. Existing matches remain untimed, preserving games created before this update. Existing collection data and permissions are preserved. The existing `VITE_LIBRARY_API_URL` points the frontend to the new API routes.

No new secrets are required for bot chess, dashboard matches, or media. Telegram alerts require the three settings below. Keep the existing database, owner authentication, S3 and CORS variables. The backend must be running for owner matches and hosted media. A sleeping free Render service may take time to wake; a stopped or suspended deployment must be restored in Render. The frontend reports service errors rather than pretending the owner is online.

Uploads are limited to 100 MiB per file, one concurrent server upload, and 30 uploads per hour per IP. MP3/MP4 file signatures are checked on the server. Your storage provider may impose a lower limit; for example, configure the Supabase bucket's file-size and MIME restrictions to accept the media you intend to upload. H.264 video with AAC audio is the most compatible MP4 choice. Public media streams support byte ranges for seeking. Private files remain owner-only. Media files share the existing storage quota; external hosted links use their own host's bandwidth.

## Telegram phone notifications (preferred)

1. In Telegram, open the verified **@BotFather**, send `/newbot`, and choose the bot name and username. Save its bot token privately.
2. Open your newly created bot and send `/start`. A bot cannot message your private account until you start that conversation.
3. Find your private chat ID using the read-only helper in your Codespaces terminal. From the repository folder, run each step separately:

   ```bash
   read -r -s -p 'Paste your Telegram bot token: ' TELEGRAM_BOT_TOKEN
   ```

   Paste the token at that hidden prompt and press Enter. Then run:

   ```bash
   export TELEGRAM_BOT_TOKEN
   node server/src/telegram-setup.mjs
   unset TELEGRAM_BOT_TOKEN
   ```

   The helper prints only private chat IDs; it never prints the bot token or message contents. Use your own chat ID. Use a dedicated bot so another application does not consume its updates or install a webhook before this setup step.

4. In Render → personal-library-api → Environment, add:
   - `TELEGRAM_BOT_TOKEN`: the BotFather token.
   - `TELEGRAM_CHAT_ID`: your private chat ID from the helper.
   - `CHESS_SITE_URL`: `https://reallprogrammer.github.io/ffinal/`
5. Save and redeploy. Chess → Owner dashboard will show **Telegram configured**. Enable Telegram app notifications in your phone settings. Request a match from a separate visitor browser to verify real delivery.

The alert includes **Open chess dashboard**. Tap it, complete the flag challenge if needed, sign in with your existing collection owner account, and select **Join match**. The dashboard request remains available if Telegram delivery fails. The bot token and chat ID remain backend-only. Do not paste the token in chat or source control. Browser notification keys are **not needed for Telegram**.

## Optional browser push notifications

Browser Web Push is optional. Dashboard requests persist even without it. Push delivery is best effort and depends on the phone, browser, and push service; an alert does not mean a match was accepted.

1. In a private Codespaces terminal, from `server`, run `npx web-push generate-vapid-keys --json`. This uses the installed `web-push` package. Keep the generated private key out of source control, screenshots, and chat.
2. Add these **backend-only** Render environment variables, then redeploy:
   - `VAPID_PUBLIC_KEY`: the generated `publicKey`.
   - `VAPID_PRIVATE_KEY`: the generated `privateKey`.
   - `VAPID_SUBJECT`: `mailto:` followed by your real contact email, or your HTTPS contact URL.
3. Open the deployed website on the phone. On iPhone/iPad (iOS 16.4+), use Safari → Share → Add to Home Screen, then launch that installed icon. On supported Android browsers, open the HTTPS site normally.
4. Complete the entry challenge, open Chess → Owner dashboard, sign in, and tap **Enable browser alerts**. Allow the browser permission. Repeat on any other device that should receive alerts (up to ten).
5. Request a match from a separate visitor browser. A notification should open the site's owner chess dashboard. Sign in if the owner session has ended, then choose **Join match**. Keep the guest's original tab open.

“Disable browser alerts” removes its subscription. If you rotate VAPID keys, disable and re-enable notifications on each registered device. The service worker only handles notifications; it does not cache pages or intercept requests. No private key is bundled into the frontend. Notifications are sent only to validated major browser push-service endpoints.

## API additions

All paths use `/api/v1`. Owner endpoints use the existing bearer session. Visitors receive a separate unguessable match token; only its SHA-256 hash is stored. Match mutations use database locks and version checks, and only participants can retrieve a match.

| Endpoint                               | Purpose                                                      |
| -------------------------------------- | ------------------------------------------------------------ |
| `GET /chess/config`                    | Public notification availability and VAPID public key        |
| `POST /chess/matches`                  | Request a match; returns match and private visitor token     |
| `GET /chess/matches/:id`               | Participant-only current board                               |
| `POST /chess/matches/:id/moves`        | Participant move with from/to/promotion/version              |
| `POST /chess/matches/:id/close`        | Participant cancellation or resignation                      |
| `GET /admin/chess/matches`             | Owner queue and recent matches                               |
| `POST /admin/chess/matches/:id/accept` | Owner accepts a waiting visitor                              |
| `POST, DELETE /admin/chess/push`       | Owner notification subscription management                   |
| `GET /media`                           | Published playlist                                           |
| `GET /admin/media`                     | Owner's complete playlist                                    |
| `POST /admin/media/uploads`            | Owner multipart MP3/MP4 upload                               |
| `POST /admin/media/links`              | Owner direct HTTPS audio/video link                          |
| `PUT, DELETE /admin/media/:id`         | Owner publication/title change or deletion                   |
| `GET /media/:id/content`               | Authorized stream, byte-range response, or external redirect |

## Verification

`server/test/os-services.test.mjs` uses the real local API, database, and object storage to test authorization, game outcomes, persistence, media validation, privacy, and seeking. `tests/chess-desktop-refinement.spec.ts` covers clock controls, themes, history, result dialogs, and responsive icon placement. `server/test/chess-clock.test.mjs` and the online integration test cover clock accounting and timeout enforcement. `tests/os-upgrade.spec.ts` covers the terminal flag hunt, tray exclusivity, window selection layering, simulation, all bot difficulties, two browser participants, and persistent MP3/MP4 playback. Tests use generated tones and solid-color video fixtures; no personal media is uploaded by the test suite. Follow the existing local integration-test credential setup. The new services do not require FFmpeg at runtime.
