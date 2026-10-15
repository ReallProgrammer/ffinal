// Token stays on the server; message text uses no Telegram HTML/Markdown parsing.
export async function notifyChessTelegram(config, nickname, send = fetch) {
  const url = new URL(config.chessSiteUrl);
  url.searchParams.set('chess', 'owner');
  const response = await send(
    `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        chat_id: config.telegramChatId,
        text: `♟ New chess challenge\n\n${nickname} would like to play. The request waits for 15 minutes. Open your owner dashboard and choose Join match.`,
        link_preview_options: { is_disabled: true },
        reply_markup: { inline_keyboard: [[{ text: 'Open chess dashboard', url: url.href }]] },
      }),
    },
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok !== true)
    throw Object.assign(new Error('Telegram could not deliver the chess notification.'), {
      statusCode: response.status,
    });
}
