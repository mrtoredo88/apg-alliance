// GET /api/telegram-auth-check?state=XXX
// Опрашивает статус сессии, при готовности возвращает Firebase custom token
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let _app = null;
function getAdminApp() {
  if (_app) return _app;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('FIREBASE_SERVICE_ACCOUNT not set');
  _app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  return _app;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { state } = req.query;
  if (!state) return res.status(400).json({ status: 'error' });

  const db  = getFirestore(getAdminApp());
  const ref = db.collection('telegramAuthSessions').doc(state);
  const snap = await ref.get();

  if (!snap.exists) return res.json({ status: 'not_found' });

  const data = snap.data();

  if (data.status === 'pending') {
    const expired = data.expiresAt instanceof Date
      ? data.expiresAt < new Date()
      : data.expiresAt.toDate() < new Date();
    if (expired) {
      await ref.update({ status: 'expired' });
      return res.json({ status: 'expired' });
    }
    return res.json({ status: 'pending' });
  }

  if (data.status === 'done') {
    const uid   = `tg_${data.tgUserId}`;
    const token = await getAuth(getAdminApp()).createCustomToken(uid);
    ref.delete().catch(() => {});
    return res.json({
      status: 'done', token,
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
