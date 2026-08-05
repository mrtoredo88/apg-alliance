import Fastify from 'fastify';
import cors from '@fastify/cors';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { serverFoundation } from './apg/index.js';
import { getDb } from './lib/documentStore.js';
import { pollTelegramUpdates } from './lib/telegramUpdates.js';

import vkNewsRoutes           from './routes/vk-news.js';
import uploadPhotoRoutes      from './routes/upload-photo.js';
import telegramAuthStartRoutes from './routes/telegram-auth-start.js';
import telegramAuthCheckRoutes from './routes/telegram-auth-check.js';
import telegramWebhookRoutes  from './routes/telegram-webhook.js';
import verifyTelegramRoutes   from './routes/verify-telegram.js';
import referralSessionRoutes  from './routes/referral-session.js';
import referralMonitoringRoutes from './routes/referral-monitoring.js';
import emailAuthRoutes        from './routes/email-auth.js';
import sendPushRoutes         from './routes/send-push.js';
import expertRotationRoutes   from './routes/expert-rotation.js';
import raffleDrawRoutes       from './routes/raffle-draw.js';
import activityIndexRoutes    from './routes/activity-index.js';
import qrTokenRoutes          from './routes/qr-token.js';
import newsCommentsRoutes     from './routes/news-comments.js';
import newsEngagementRoutes   from './routes/news-engagement.js';
import adminLoginRoutes       from './routes/admin-login.js';
import adminActionsRoutes     from './routes/admin-actions.js';
import adminSecurityRoutes    from './routes/admin-security.js';
import systemStatusRoutes     from './routes/system-status.js';
import userActionsRoutes      from './routes/user-actions.js';
import lokiEditorRoutes       from './routes/loki-editor.js';
import publicDataRoutes       from './routes/public-data.js';
import publicSubmitRoutes     from './routes/public-submit.js';
import partnershipApplicationRoutes from './routes/partnership-application.js';
import accountRoutes from './routes/account.js';
import appDataRoutes from './routes/app-data.js';
import mergedAccountMaintenanceRoutes from './routes/merged-account-maintenance.js';
import authSessionRoutes from './routes/auth-session.js';

const fastify = Fastify({ logger: true, bodyLimit: 8_388_608 });

function fileSha256(relativePath) {
  const filePath = path.join(process.cwd(), relativePath);
  try {
    const data = fs.readFileSync(filePath);
    return createHash('sha256').update(data).digest('hex');
  } catch {
    return '';
  }
}

await fastify.register(cors, {
  origin: [
    'https://myapg.ru',
    'https://apg-alliance.vercel.app',
    'https://localhost',
    'capacitor://localhost',
    /^http:\/\/localhost(:\d+)?$/,
    /^http:\/\/127\.0\.0\.1(:\d+)?$/,
    /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  // RuStore 1.3.x sends the native APG bearer in X-Firebase-Auth. Keep the
  // legacy name accepted until every installed build has moved to X-APG-Auth.
  allowedHeaders: ['Content-Type', 'x-push-secret', 'Authorization', 'X-APG-Auth', 'X-Firebase-Auth', 'X-Idempotency-Key', 'X-APG-Version'],
});

fastify.addHook('onSend', async (request, reply) => {
  reply.header('X-Frame-Options', 'ALLOWALL');
  reply.header('Content-Security-Policy', 'frame-ancestors *');
});

fastify.register(vkNewsRoutes);
fastify.register(uploadPhotoRoutes);
fastify.register(telegramAuthStartRoutes);
fastify.register(telegramAuthCheckRoutes);
fastify.register(telegramWebhookRoutes);
fastify.register(verifyTelegramRoutes);
fastify.register(referralSessionRoutes);
fastify.register(referralMonitoringRoutes);
fastify.register(emailAuthRoutes);
fastify.register(sendPushRoutes);
fastify.register(expertRotationRoutes);
fastify.register(raffleDrawRoutes);
fastify.register(activityIndexRoutes);
fastify.register(qrTokenRoutes);
fastify.register(newsCommentsRoutes);
fastify.register(newsEngagementRoutes);
fastify.register(adminLoginRoutes);
fastify.register(adminActionsRoutes);
fastify.register(adminSecurityRoutes);
fastify.register(systemStatusRoutes);
fastify.register(userActionsRoutes);
fastify.register(lokiEditorRoutes);
fastify.register(publicDataRoutes);
fastify.register(publicSubmitRoutes);
fastify.register(partnershipApplicationRoutes);
fastify.register(accountRoutes);
fastify.register(appDataRoutes);
fastify.register(mergedAccountMaintenanceRoutes);
fastify.register(authSessionRoutes);

fastify.get('/version', async () => ({
  git: process.env.GIT_SHA || process.env.APP_VERSION || '',
  image: process.env.IMAGE_DIGEST || '',
  build: process.env.BUILD_TIME || '',
  appVersion: process.env.APP_VERSION || '',
  telegramUpdatesSha256: fileSha256('src/lib/telegramUpdates.js'),
}));

fastify.get('/health', async (request, reply) => {
  try {
    const postgres = await serverFoundation.data.adapter.health();
    return { ok: Boolean(postgres), storage: 'postgres', ts: Date.now() };
  } catch (e) {
    reply.code(503);
    return { ok: false, error: e.message };
  }
});

const port = Number(process.env.PORT ?? 3000);
await fastify.listen({ port, host: '0.0.0.0' });

if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_DELIVERY_MODE === 'background') {
  let telegramPollRunning = false;
  const runTelegramPoll = async () => {
    if (telegramPollRunning) return;
    telegramPollRunning = true;
    try {
      await pollTelegramUpdates(getDb(), fastify.log);
    } catch (error) {
      fastify.log.warn({ message: error?.message || String(error) }, 'telegram background poll failed');
    } finally {
      telegramPollRunning = false;
    }
  };
  setInterval(runTelegramPoll, 5000);
  setTimeout(runTelegramPoll, 1000);
}
