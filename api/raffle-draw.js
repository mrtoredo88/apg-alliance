// Vercel serverless function — выбор победителя розыгрыша
// Требует env-переменных в Vercel Dashboard:
//   FIREBASE_SERVICE_ACCOUNT — JSON строка сервисного аккаунта Firebase
//   RAFFLE_SECRET             — секрет для ручного запуска из AdminPanel
//   CRON_SECRET               — Vercel автоматически передаёт для cron-вызовов
//
// Установить firebase-admin: npm install firebase-admin

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

let _db = null;
function getDb() {
  if (_db) return _db;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set');
  }
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  }
  _db = getFirestore(getApps()[0]);
  return _db;
}

function weightedRandom(entries) {
  const total = entries.reduce((s, e) => s + (e.ticketsCount ?? 0), 0);
  if (total === 0) return entries[Math.floor(Math.random() * entries.length)];
  let r = Math.random() * total;
  for (const e of entries) {
    r -= e.ticketsCount ?? 0;
    if (r <= 0) return e;
  }
  return entries[entries.length - 1];
}

async function drawPrize(db, prizeId) {
  const prizeRef  = db.collection('prizes').doc(prizeId);
  const prizeSnap = await prizeRef.get();
  if (!prizeSnap.exists) return { error: 'Prize not found' };

  const prize = prizeSnap.data();
  if (prize.winner) return { skipped: 'Already drawn' };

  const entriesSnap = await db.collection('raffleEntries')
    .where('prizeId', '==', prizeId)
    .get();
  if (entriesSnap.empty) return { skipped: 'No entries' };

  const entries = entriesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const winner  = weightedRandom(entries);

  await prizeRef.update({
    winner: {
      userId:    winner.userId,
      userName:  winner.userName,
      userPhoto: winner.userPhoto ?? null,
    },
    drawnAt: FieldValue.serverTimestamp(),
  });

  const uid = String(winner.userId);
  const pushTitle = '🎉 Вы выиграли розыгрыш!';
  const pushBody  = `Поздравляем! Вы выиграли: ${prize.name}. Свяжитесь с организаторами.`;

  await Promise.all([
    db.collection('users').doc(uid).collection('activity').add({
      type: 'raffle_win',
      icon: prize.emoji ?? '🎟️',
      text: `🎉 Вы выиграли: ${prize.name}!`,
      ts:   FieldValue.serverTimestamp(),
    }).catch(() => {}),
    db.collection('notifications').add({
      targetUserId: uid,
      title: pushTitle,
      body:  pushBody,
      emoji: '🎟️',
      prizeId,
      createdAt: FieldValue.serverTimestamp(),
    }).catch(() => {}),
    // Web Push — только если у победителя есть FCM токены
    (async () => {
      try {
        const userSnap = await db.collection('users').doc(uid).get();
        const { fcmTokens = [], notificationProvider } = userSnap.data() ?? {};
        if (notificationProvider !== 'webpush' || !fcmTokens.length) return;
        const APP_URL = 'https://apg-alliance.vercel.app';
        await getMessaging().sendEachForMulticast({
          tokens: fcmTokens,
          notification: { title: pushTitle, body: pushBody },
          webpush: {
            notification: { icon: `${APP_URL}/192.png`, badge: `${APP_URL}/32.png` },
            fcmOptions:   { link: APP_URL },
            data: { url: APP_URL, tag: 'raffle-win' },
          },
        });
      } catch {}
    })(),
  ]);

  return { winner: { userId: winner.userId, userName: winner.userName } };
}

export default async function handler(req, res) {
  try {
  const cronAuth  = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  const adminAuth = req.method === 'POST' && req.body?.secret === process.env.RAFFLE_SECRET;

  if (!cronAuth && !adminAuth) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  let db;
  try { db = getDb(); } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  // Ручной запуск из AdminPanel — конкретный prizeId
  if (req.body?.prizeId) {
    const result = await drawPrize(db, req.body.prizeId);
    return res.status(200).json(result);
  }

  // Автоматический cron — все завершённые розыгрыши без победителя
  const now  = new Date();
  const snap = await db.collection('prizes')
    .where('type', '==', 'raffle')
    .where('raffleDate', '<=', now)
    .get();

  const results = [];
  for (const d of snap.docs) {
    if (!d.data().winner) {
      const r = await drawPrize(db, d.id);
      results.push({ prizeId: d.id, ...r });
    }
  }

  return res.status(200).json({ drawn: results });
  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack?.slice(0, 500) });
  }
}
