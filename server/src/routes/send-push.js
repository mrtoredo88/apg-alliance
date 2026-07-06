import { APP_URL } from '../lib/config.js';
import { getDb, getDbMessaging } from '../lib/firebase.js';
import { FieldValue } from 'firebase-admin/firestore';

async function sendToTokens(tokens, userIds, title, body, url, tag) {
  if (!tokens.length) return { sent: 0, failed: 0, cleaned: 0 };

  const message = {
    tokens,
    notification: { title, body: body ?? '' },
    webpush: {
      notification: {
        icon:  `${APP_URL}/192.png`,
        badge: `${APP_URL}/32.png`,
        tag:   tag ?? 'apg-push',
        renotify: true,
      },
      fcmOptions: { link: url ?? APP_URL },
      data: url ? { url, tag: tag ?? 'apg-push' } : { tag: tag ?? 'apg-push' },
    },
  };

  const result = await getDbMessaging().sendEachForMulticast(message);

  const DEAD_CODES = new Set([
    'messaging/invalid-registration-token',
    'messaging/registration-token-not-registered',
  ]);

  const deadByUser = {};
  result.responses.forEach((r, i) => {
    if (!r.success && DEAD_CODES.has(r.error?.code)) {
      const uid = userIds[i];
      if (uid) {
        deadByUser[uid] ??= [];
        deadByUser[uid].push(tokens[i]);
      }
    }
  });

  await Promise.all(
    Object.entries(deadByUser).map(([uid, dead]) =>
      getDb().collection('users').doc(uid).update({
        fcmTokens: FieldValue.arrayRemove(...dead),
      }).catch(() => {})
    )
  );
  const cleaned = Object.values(deadByUser).flat().length;

  return { sent: result.successCount, failed: result.failureCount, cleaned };
}

export default async function sendPushRoutes(fastify) {
  fastify.post('/api/send-push', async (request, reply) => {
    const secret = request.headers['x-push-secret'];
    const valid  = (secret && secret === process.env.PUSH_SECRET) ||
                   (secret && secret === process.env.RAFFLE_SECRET);
    if (!valid) return reply.code(401).send({ error: 'unauthorized' });

    const { userId, broadcast, title, body, url, tag } = request.body ?? {};
    if (!title) return reply.code(400).send({ error: 'title required' });

    const db = getDb();

    try {
      if (userId && !broadcast) {
        const snap = await db.collection('users').doc(String(userId)).get();
        if (!snap.exists) return reply.code(404).send({ error: 'user not found' });
        const { fcmTokens = [] } = snap.data();
        if (!fcmTokens.length) return { skipped: true, reason: 'no fcm tokens' };

        return await sendToTokens(
          fcmTokens, fcmTokens.map(() => String(userId)),
          title, body, url, tag,
        );
      }

      if (broadcast) {
        const snap = await db.collection('users')
          .where('notificationProvider', '==', 'webpush')
          .get();

        const tokens  = [];
        const userIds = [];
        snap.docs.forEach(d => {
          (d.data().fcmTokens ?? []).forEach(t => {
            tokens.push(t);
            userIds.push(d.id);
          });
        });

        if (!tokens.length) return { skipped: true, reason: 'no webpush subscribers' };

        let total = { sent: 0, failed: 0, cleaned: 0 };
        for (let i = 0; i < tokens.length; i += 500) {
          const s = await sendToTokens(
            tokens.slice(i, i + 500), userIds.slice(i, i + 500),
            title, body, url, tag,
          );
          total.sent    += s.sent;
          total.failed  += s.failed;
          total.cleaned += s.cleaned;
        }
        return { broadcast: true, subscribers: tokens.length, ...total };
      }

      return reply.code(400).send({ error: 'userId or broadcast required' });
    } catch (e) {
      return reply.code(500).send({ error: e.message });
    }
  });
}
