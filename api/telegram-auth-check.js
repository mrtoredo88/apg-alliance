// GET /api/telegram-auth-check?state=XXX
// Long-polls Firestore up to 25 s, returns immediately when status changes from 'pending'
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

    if (!snap.exists()) return res.json({ status: 'not_found' });

    const data = snap.data();

    if (data.status === 'done') {
      ref.delete().catch(() => {});
      return res.json({
        status: 'done',
        user: {
          id:         `tg_${data.tgUserId}`,
          first_name: data.firstName ?? '',
          last_name:  data.lastName  ?? '',
          photo_200:  data.photoUrl  ?? null,
        },
      });
    }

    if (data.status !== 'pending') {
      return res.json({ status: data.status });
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
