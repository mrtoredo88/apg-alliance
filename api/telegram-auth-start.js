// POST /api/telegram-auth-start
// Создаёт сессию и возвращает ссылку на бота
import { randomBytes } from 'crypto';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

let _app = null;
function getAdminApp() {
  if (_app) return _app;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('FIREBASE_SERVICE_ACCOUNT not set');
  _app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  return _app;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const state = randomBytes(16).toString('hex');
  const db = getFirestore(getAdminApp());
  await db.collection('telegramAuthSessions').doc(state).set({
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });
  return res.json({ state, url: `https://t.me/apg_zelenograd_bot?start=auth_${state}` });
}
