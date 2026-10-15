// Read-only helper: prints private chat IDs that have already messaged this bot.
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token || !/^\d+:[\w-]+$/.test(token)) {
  console.error(
    'Set TELEGRAM_BOT_TOKEN privately in this terminal first. See docs/os-games-and-media.md.',
  );
  process.exitCode = 1;
} else {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok || !data.ok)
      throw new Error(
        'Telegram rejected the request. Check the bot token and ensure no webhook is configured.',
      );
    const ids = [
      ...new Set(
        data.result
          .map((update) => update.message?.chat)
          .filter((chat) => chat?.type === 'private')
          .map((chat) => String(chat.id)),
      ),
    ];
    if (ids.length) for (const id of ids) console.log('Private chat ID: ' + id);
    else console.log('Open your bot in Telegram, send /start, then run this helper again.');
  } catch (error) {
    console.error(
      error.name === 'TimeoutError'
        ? 'Telegram timed out. Try again.'
        : 'Could not read Telegram chats. Check your token, connection, and whether this bot uses a webhook.',
    );
    process.exitCode = 1;
  }
}
