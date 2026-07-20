import { APP_URL } from '../lib/config.js';
import { getDb, getDbMessaging } from '../lib/firebase.js';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdminPermission } from '../lib/adminSecurity.js';

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

  const uid       = String(winner.userId);
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
    (async () => {
      try {
        const userSnap = await db.collection('users').doc(uid).get();
        const { fcmTokens = [], notificationProvider } = userSnap.data() ?? {};
        if (notificationProvider !== 'webpush' || !fcmTokens.length) return;
        await getDbMessaging().sendEachForMulticast({
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

export default async function raffleDrawRoutes(fastify) {
  fastify.post('/api/raffle-draw', async (request, reply) => {
    try {
      const cronAuth  = request.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
      const secretAuth = request.body?.secret === process.env.RAFFLE_SECRET;
      if (!cronAuth && !secretAuth) await requireAdminPermission(request, 'prizes:update');

      const db = getDb();

      if (request.body?.prizeId) {
        const result = await drawPrize(db, request.body.prizeId);
        return result;
      }

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

      return { drawn: results };
    } catch (e) {
      return reply.code(500).send({ error: e.message, stack: e.stack?.slice(0, 500) });
    }
  });
}
