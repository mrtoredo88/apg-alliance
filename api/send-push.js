// Vercel serverless function — отправка Web Push уведомления пользователю
// Env vars: FIREBASE_SERVICE_ACCOUNT, PUSH_SECRET
//
// POST /api/send-push
// Headers: x-push-secret: <PUSH_SECRET>
// Body: { userId, title, body?, url?, tag? }
//
// Также поддерживает broadcast:
// Body: { broadcast: true, title, body?, url?, tag? }
// — отправляет всем пользователям с notificationProvider === 'webpush'

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

function initAdmin() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  }
  return { db: getFirestore(), messaging: getMessaging() };
}

const APP_URL = 'https://apg-alliance.vercel.app';

async function sendToTokens(messaging, db, tokens, userIds, title, body, url, tag) {
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

  const result = await messaging.sendEachForMulticast(message);

  // Удаляем протухшие токены
  let cleaned = 0;
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
      db.collection('users').doc(uid).update({
        fcmTokens: FieldValue.arrayRemove(...dead),
      }).catch(() => {})
    )
  );
  cleaned = Object.values(deadByUser).flat().length;

  return { sent: result.successCount, failed: result.failureCount, cleaned };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const secret = req.headers['x-push-secret'];
  const valid  = (secret && secret === process.env.PUSH_SECRET) ||
                 (secret && secret === process.env.RAFFLE_SECRET);
  if (!valid) return res.status(401).json({ error: 'unauthorized' });

  const { userId, broadcast, title, body, url, tag } = req.body ?? {};
  if (!title) return res.status(400).json({ error: 'title required' });

  let db, messaging;
  try { ({ db, messaging } = initAdmin()); }
  catch (e) { return res.status(500).json({ error: e.message }); }

  try {
    // ── Одиночная отправка ──────────────────────────────────────────────────
    if (userId && !broadcast) {
      const snap = await db.collection('users').doc(String(userId)).get();
      if (!snap.exists) return res.status(404).json({ error: 'user not found' });
      const { fcmTokens = [] } = snap.data();
      if (!fcmTokens.length) return res.json({ skipped: true, reason: 'no fcm tokens' });

      const stats = await sendToTokens(
        messaging, db,
        fcmTokens, fcmTokens.map(() => String(userId)),
        title, body, url, tag
      );
      return res.json(stats);
    }

    // ── Broadcast ───────────────────────────────────────────────────────────
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

      if (!tokens.length) return res.json({ skipped: true, reason: 'no webpush subscribers' });

      // FCM multicast — max 500 за раз
      let total = { sent: 0, failed: 0, cleaned: 0 };
      for (let i = 0; i < tokens.length; i += 500) {
        const chunk = tokens.slice(i, i + 500);
        const ids   = userIds.slice(i, i + 500);
        const s = await sendToTokens(messaging, db, chunk, ids, title, body, url, tag);
        total.sent    += s.sent;
        total.failed  += s.failed;
        total.cleaned += s.cleaned;
      }
      return res.json({ broadcast: true, subscribers: tokens.length, ...total });
    }

    return res.status(400).json({ error: 'userId or broadcast required' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
