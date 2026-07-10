import { getDb, getDbAuth } from '../lib/firebase.js';

export default async function telegramAuthCheckRoutes(fastify) {
  fastify.get('/api/telegram-auth-check', async (request, reply) => {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate');

    const { state } = request.query;
    if (!state) return reply.code(400).send({ status: 'error' });

    const db  = getDb();
    const ref = db.collection('telegramAuthSessions').doc(state);

    const deadline = Date.now() + 25_000;

    while (Date.now() < deadline) {
      const snap = await ref.get();

      if (!snap.exists) return { status: 'not_found' };

      const data = snap.data();

      if (data.status === 'done') {
        const tgId = `tg_${data.tgUserId}`;
        if (data.linking === true) {
          await ref.set({ checkedAt: new Date() }, { merge: true }).catch(() => {});
          return {
            status: 'done',
            linking: true,
            tgId,
            linkError: data.linkError || null,
            linkedOwnerId: data.linkedOwnerId || data.ownerUserId || null,
            user: {
              id: data.ownerUserId || null,
              first_name: data.firstName ?? '',
              last_name: data.lastName ?? '',
              username: data.username ?? '',
              photo_200: data.photoUrl ?? null,
            },
          };
        }
        ref.delete().catch(() => {});
        const linkSnap = await db.collection('tgLinks').doc(tgId).get();
        const linkedUserId = linkSnap.exists ? linkSnap.data().userId : null;
        const targetUserId = linkedUserId ?? tgId;
        const token = await getDbAuth().createCustomToken(targetUserId);
        return {
          status: 'done',
          tgId,
          token,
          user: {
            id:         targetUserId,
            first_name: data.firstName ?? '',
            last_name:  data.lastName  ?? '',
            photo_200:  data.photoUrl  ?? null,
          },
        };
      }

      if (data.status !== 'pending') {
        return { status: data.status, linking: data.linking === true, linkError: data.linkError || null };
      }

      const expDate = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
      if (expDate < new Date()) {
        await ref.update({ status: 'expired' }).catch(() => {});
        return { status: 'expired' };
      }

      await new Promise(r => setTimeout(r, 1000));
    }

    return { status: 'pending' };
  });
}
