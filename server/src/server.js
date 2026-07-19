import Fastify from 'fastify';
import cors from '@fastify/cors';
import { getDb } from './lib/firebase.js';

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
import identityV2AdminRoutes from './routes/identity-v2-admin.js';

const fastify = Fastify({ logger: true, bodyLimit: 8_388_608 });

await fastify.register(cors, {
  origin: [
    'https://myapg.ru',
    'https://apg-alliance.vercel.app',
    /^http:\/\/localhost(:\d+)?$/,
    /^http:\/\/127\.0\.0\.1(:\d+)?$/,
    /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-push-secret', 'Authorization', 'X-Firebase-Auth', 'X-APG-Auth', 'X-Idempotency-Key', 'X-APG-Version'],
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
fastify.register(identityV2AdminRoutes);

fastify.get('/health', async (request, reply) => {
  try {
    await getDb().collection('_health').limit(1).get();
    return { ok: true, ts: Date.now() };
  } catch (e) {
    reply.code(503);
    return { ok: false, error: e.message };
  }
});

const port = Number(process.env.PORT ?? 3000);
await fastify.listen({ port, host: '0.0.0.0' });
