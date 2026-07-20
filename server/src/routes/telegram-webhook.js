import { getDb } from '../lib/firebase.js';
import { processTelegramUpdate, pollTelegramUpdates } from '../lib/telegramUpdates.js';

export default async function telegramWebhookRoutes(fastify) {
  // Webhook оставлен на случай возврата push-доставки; основной канал — getUpdates-поллинг
  fastify.post('/api/telegram-webhook', async (request) => {
    const requestId = String(request.headers['x-request-id'] || request.headers['x-telegram-bot-api-secret-token'] || '').trim();
    const payload = request.body ?? {};
    const messageText = String(payload?.message?.text || '').slice(0, 120);
    const chatId = String(payload?.message?.chat?.id || payload?.message?.from?.id || '').trim();
    request.log.info?.({
      stage: 'telegram_webhook_called',
      requestId,
      chatId,
      updateId: payload?.update_id || null,
      text: messageText,
    }, 'telegram-webhook-forensic');
    const db = getDb();
    await processTelegramUpdate(db, payload, request.log).catch(error => {
      request.log.warn({ message: error?.message || String(error) }, 'telegram webhook processing failed');
    });
    return { ok: true };
  });

  // Вызывается cron-триггером Yandex раз в минуту: подхватывает органические команды боту
  fastify.post('/api/telegram-poll', async (request, reply) => {
    const secret = request.body?.secret || request.headers['x-cron-secret'];
    const valid = secret && [process.env.CRON_SECRET, process.env.PUSH_SECRET].filter(Boolean).includes(secret);
    if (!valid) return reply.code(401).send({ ok: false, error: 'unauthorized' });
    const result = await pollTelegramUpdates(getDb(), request.log);
    return { ok: true, ...result };
  });
}
