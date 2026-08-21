import assert from 'node:assert/strict';
import { availableOutreachChannels, sendSalesOutreach } from '../server/src/lib/salesOutreach.js';

const originalFetch = globalThis.fetch;
const previousToken = process.env.TELEGRAM_BOT_TOKEN;

try {
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  const lead = { name: 'Тестовое кафе', telegramChatId: '123456' };
  assert.deepEqual(availableOutreachChannels(lead), ['telegram']);

  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ ok: true, result: { message_id: 42 } }) };
  };
  const result = await sendSalesOutreach(lead, 'Тестовое сообщение');
  assert.equal(result.channel, 'telegram');
  assert.equal(result.providerMessageId, '42');
  assert.equal(request.body.chat_id, '123456');
  assert.equal(request.body.text, 'Тестовое сообщение');

  await assert.rejects(
    () => sendSalesOutreach({ name: 'Без контактов' }, 'Текст'),
    error => error.code === 'sales-ai/no-outreach-channel',
  );
  console.log(JSON.stringify({ status: 'PASS', channel: result.channel }));
} finally {
  globalThis.fetch = originalFetch;
  if (previousToken == null) delete process.env.TELEGRAM_BOT_TOKEN;
  else process.env.TELEGRAM_BOT_TOKEN = previousToken;
}

