import { createHash, createHmac } from 'crypto';
import { getDb, getDbAuth } from '../lib/firebase.js';
import { FieldValue } from 'firebase-admin/firestore';

function verifyTelegramHash(data, botToken) {
  const { hash, ...rest } = data;
  const checkString = Object.keys(rest)
    .filter(k => rest[k] != null)
    .sort()
    .map(k => `${k}=${rest[k]}`)
    .join('\n');
  const secretKey = createHash('sha256').update(botToken).digest();
  const computed  = createHmac('sha256', secretKey).update(checkString).digest('hex');
  return computed === hash;
}

export default async function verifyTelegramRoutes(fastify) {
  fastify.post('/api/verify-telegram', async (request, reply) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return reply.code(500).send({ ok: false, error: 'server_misconfigured' });

    const { id, first_name, last_name, username, photo_url, auth_date, hash } = request.body ?? {};
    if (!id || !hash || !auth_date) {
      return reply.code(400).send({ ok: false, error: 'missing_fields' });
    }

    if (Date.now() / 1000 - Number(auth_date) > 86400) {
      return reply.code(400).send({ ok: false, error: 'auth_date_expired' });
    }

    const data = { id: String(id), first_name, auth_date: String(auth_date), hash };
    if (last_name)  data.last_name  = last_name;
    if (username)   data.username   = username;
    if (photo_url)  data.photo_url  = photo_url;

    if (!verifyTelegramHash(data, botToken)) {
      return reply.code(403).send({ ok: false, error: 'invalid_hash' });
    }

    const db  = getDb();
    const uid = `tg_${id}`;

    const userRef  = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const profilePatch = {
      authProvider: 'telegram',
      firstName: first_name ?? null,
      lastName:  last_name  ?? null,
      photo:     photo_url  ?? null,
      lastSeen:  FieldValue.serverTimestamp(),
    };

    if (!userSnap.exists) {
      await userRef.set({
        keys: 0, favorites: [], scannedPartners: {},
        completedTasks: [], streak: 0, onboardingDone: false,
        scanDates: [], lastBonusDate: new Date().toLocaleDateString('sv'),
        referredBy: null,
        registeredAt: FieldValue.serverTimestamp(),
        ...profilePatch,
      });
      db.collection('stats').doc('global').set(
        { userCount: FieldValue.increment(1) }, { merge: true }
      ).catch(() => {});
    } else {
      await userRef.update(profilePatch);
    }

    // Если Telegram привязан к email-аккаунту — возвращаем токен для него
    const linkSnap = await db.collection('tgLinks').doc(uid).get();
    const targetUserId = linkSnap.exists ? String(linkSnap.data().userId || uid) : uid;
    const token = await getDbAuth().createCustomToken(targetUserId);
    return {
      ok: true,
      token,
      user: { id: targetUserId, first_name, last_name: last_name ?? '', photo_200: photo_url ?? null },
    };
  });
}
