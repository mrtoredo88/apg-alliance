// GET /api/telegram-auth-check?state=XXX
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

  let snap = await ref.get();

  // Retry up to 3 times (1 s apart) — webhook cold start can take 2-3 s
  for (let i = 0; i < 3 && snap.exists && snap.data()?.status === 'pending'; i++) {
    await new Promise(r => setTimeout(r, 1000));
    snap = await ref.get();
  }

  if (!snap.exists) return res.json({ status: 'not_found' });

  const data = snap.data();

  if (data.status === 'pending') {
    const expDate = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
    const expired = expDate < new Date();
    if (expired) {
      await ref.update({ status: 'expired' });
      return res.json({ status: 'expired' });
    }
    return res.json({ status: 'pending' });
  }

  if (data.status === 'done') {
    const uid = `tg_${data.tgUserId}`;
    ref.delete().catch(() => {});
    return res.json({
      status: 'done',
      user: {
        id:         uid,
        first_name: data.firstName ?? '',
        last_name:  data.lastName  ?? '',
        photo_200:  data.photoUrl  ?? null,
      },
    });
  }

  return res.json({ status: data.status });
}
