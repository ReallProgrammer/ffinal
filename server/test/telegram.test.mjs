import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notifyChessTelegram } from '../src/telegram.mjs';
const config = {
  telegramBotToken: '123:TEST_ONLY',
  telegramChatId: '12345',
  chessSiteUrl: 'https://example.com/ffinal/',
};
test('Telegram challenge uses the configured private chat and a dashboard deep link without a match token', async () => {
  let called = false;
  await notifyChessTelegram(config, 'Visitor <b>name</b>', async (url, options) => {
    called = true;
    assert.equal(url, 'https://api.telegram.org/bot123:TEST_ONLY/sendMessage');
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    const payload = JSON.parse(options.body);
    assert.equal(payload.chat_id, '12345');
    assert.match(payload.text, /Visitor <b>name<\/b>/);
    assert.equal(payload.parse_mode, undefined);
    assert.equal(
      payload.reply_markup.inline_keyboard[0][0].url,
      'https://example.com/ffinal/?chess=owner',
    );
    assert.ok(!options.body.includes(config.telegramBotToken));
    return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 });
  });
  assert.ok(called);
});
test('Telegram errors report a safe failure without leaking bot credentials', async () => {
  await assert.rejects(
    notifyChessTelegram(
      config,
      'Visitor',
      async () =>
        new Response(JSON.stringify({ ok: false, description: 'unauthorized' }), { status: 401 }),
    ),
    (e) => e.statusCode === 401 && !e.message.includes(config.telegramBotToken),
  );
  await assert.rejects(
    notifyChessTelegram(
      config,
      'Visitor',
      async () => new Response('invalid response', { status: 200 }),
    ),
    /could not deliver/,
  );
});
