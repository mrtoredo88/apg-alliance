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

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', '1', 'yes'].includes(value.toLowerCase().trim());
  return Boolean(value);
}

function safeString(value, max = 320) {
  return String(value ?? '').trim().slice(0, max);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body ?? {};
  const linking = normalizeBoolean(body.linking);
  const ownerUserId = safeString(body.ownerUserId, 200);
  const ownerEmail = safeString(body.email || body.ownerEmail, 220).toLowerCase();
  const source = safeString(body.source, 120) || 'profile_panel';
  if (linking && !ownerUserId) {
    return res.status(400).json({ ok: false, message: 'owner_required' });
  }

  const state = randomBytes(16).toString('hex');
  const db = getFirestore(getAdminApp());

  await db.collection('telegramAuthSessions').doc(state).set({
    status: 'pending',
    linking: linking === true,
    ownerUserId: ownerUserId || null,
    ownerEmail: ownerEmail || null,
    source,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });

  return res.json({ state, url: `https://t.me/apg_zelenograd_bot?start=auth_${state}` });
}
