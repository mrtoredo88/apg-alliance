import { getDb } from '../lib/documentStore.js';
import { processTelegramUpdate, pollTelegramUpdates } from '../lib/telegramUpdates.js';
import { createHash, timingSafeEqual } from 'node:crypto';

function sameSecret(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function shortHash(value) {
  return value ? createHash('sha256').update(String(value)).digest('hex').slice(0, 16) : null;
}

function timerSecret(request) {
  if (request.headers['x-cron-secret']) return request.headers['x-cron-secret'];
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) return request.body.secret;
  try {
    const raw = Buffer.isBuffer(request.body) ? request.body.toString('utf8') : String(request.body || '');
    return raw ? JSON.parse(raw).secret : '';
  } catch {
    return '';
  }
}

export default async function telegramWebhookRoutes(fastify) {
  fastify.post('/api/telegram-webhook', async (request, reply) => {
    const configuredSecret = String(process.env.TELEGRAM_WEBHOOK_SECRET || process.env.PUSH_SECRET || '').trim();
    const suppliedSecret = String(request.headers['x-telegram-bot-api-secret-token'] || '').trim();
    if (!configuredSecret || !sameSecret(suppliedSecret, configuredSecret)) {
      return reply.code(401).send({ ok: false });
    }
    const requestId = String(request.headers['x-request-id'] || request.id || '').trim();
    const payload = request.body ?? {};
    const messageText = String(payload?.message?.text || '').slice(0, 120);
    const chatId = String(payload?.message?.chat?.id || payload?.message?.from?.id || '').trim();
    const correlationId = `tg_${payload?.update_id || 'unknown'}_${requestId}`;
    const startedAt = Date.now();
    request.log.info?.({
      stage: 'update_received',
      correlationId,
      requestId,
      chatIdHash: shortHash(chatId),
      updateId: payload?.update_id || null,
      command: messageText.split(/\s+/, 1)[0] || null,
      revision: process.env.GIT_SHA || process.env.APP_VERSION || null,
    }, 'telegram-webhook-forensic');
    const db = getDb();
    try {
      const result = await processTelegramUpdate(db, payload, request.log);
      request.log.info?.({
        stage: 'webhook_handled', correlationId, updateId: payload?.update_id || null,
        kind: result?.kind || 'unknown', latencyMs: Date.now() - startedAt,
        revision: process.env.GIT_SHA || process.env.APP_VERSION || null,
      }, 'telegram-webhook-forensic');
      return { ok: true, handled: Boolean(result?.handled), kind: result?.kind || 'unknown' };
    } catch (error) {
      request.log.warn({
        stage: 'reply_failed', correlationId, updateId: payload?.update_id || null,
        latencyMs: Date.now() - startedAt, errorCode: error?.code || null,
        message: error?.message || String(error),
        revision: process.env.GIT_SHA || process.env.APP_VERSION || null,
      }, 'telegram webhook processing failed');
      return reply.code(500).send({ ok: false });
    }
  });

  // Yandex timer invokes this once a minute for ordinary bot commands. Login
  // checks also poll immediately, so authorization does not wait for the timer.
  fastify.post('/api/telegram-poll', async (request, reply) => {
    const secret = timerSecret(request);
    const valid = secret && [process.env.CRON_SECRET, process.env.PUSH_SECRET].filter(Boolean).includes(secret);
    if (!valid) {
      request.log.warn({
        stage: 'telegram_timer_unauthorized',
        bodyType: Buffer.isBuffer(request.body) ? 'buffer' : typeof request.body,
        contentType: request.headers['content-type'] || null,
        revision: process.env.GIT_SHA || process.env.APP_VERSION || null,
      }, 'telegram-timer-forensic');
      return reply.code(401).send({ ok: false, error: 'unauthorized' });
    }
    const result = await pollTelegramUpdates(getDb(), request.log);
    return { ok: true, ...result };
  });
}
