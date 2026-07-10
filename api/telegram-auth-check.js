// GET /api/telegram-auth-check?state=XXX
// Long-polls Firestore up to 25 s, returns immediately when status changes from 'pending'
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let _app = null;
function getAdminApp() {
  if (_app) return _app;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('FIREBASE_SERVICE_ACCOUNT not set');
  const existing = getApps().find(a => a.name === 'apg-check');
  _app = existing ?? initializeApp(
    { credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) },
    'apg-check',
  );
  return _app;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (req.method !== 'GET') return res.status(405).end();
  const { state } = req.query;
  if (!state) return res.status(400).json({ status: 'error' });

  const db  = getFirestore(getAdminApp());
  const ref = db.collection('telegramAuthSessions').doc(state);

  const deadline = Date.now() + 25_000;

  while (Date.now() < deadline) {
    const snap = await ref.get();

    if (!snap.exists) return res.json({ status: 'not_found' });

    const data = snap.data();

    if (data.status === 'done') {
      const tgId = `tg_${data.tgUserId}`;
      if (data.linking === true) {
        await ref.set({ checkedAt: new Date() }, { merge: true }).catch(() => {});
        return res.json({
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
        });
      }
      ref.delete().catch(() => {});
      // Проверяем привязку к email-аккаунту
      const linkSnap = await db.collection('tgLinks').doc(tgId).get();
      const linkedUserId = linkSnap.exists ? linkSnap.data().userId : null;
      const targetUserId = linkedUserId ?? tgId;
      const token = await getAuth(getAdminApp()).createCustomToken(targetUserId);
      return res.json({
        status: 'done',
        tgId,
        token,
        user: {
          id:         targetUserId,
          first_name: data.firstName ?? '',
          last_name:  data.lastName  ?? '',
          photo_200:  data.photoUrl  ?? null,
        },
      });
    }

    if (data.status !== 'pending') {
      return res.json({ status: data.status, linking: data.linking === true, linkError: data.linkError || null });
    }

    const expDate = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
    if (expDate < new Date()) {
      await ref.update({ status: 'expired' }).catch(() => {});
      return res.json({ status: 'expired' });
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  return res.json({ status: 'pending' });
}
