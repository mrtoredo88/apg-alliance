// Vercel serverless function — верификация Telegram Login Widget
// Env: FIREBASE_SERVICE_ACCOUNT, TELEGRAM_BOT_TOKEN
//
// POST /api/verify-telegram
// Body: { id, first_name, last_name?, username?, photo_url?, auth_date, hash }
// Returns: { ok: true, token: <firebase custom token>, user: { id, first_name, last_name, photo } }

import { createHash, createHmac } from 'crypto';
import { APP_URL } from './config.js';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let _app = null;
function getAdminApp() {
  if (_app) return _app;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('FIREBASE_SERVICE_ACCOUNT not set');
  if (!getApps().length) {
    _app = initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  } else {
    _app = getApps()[0];
  }
  return _app;
}

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', APP_URL);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return res.status(500).json({ ok: false, error: 'server_misconfigured' });

  const { id, first_name, last_name, username, photo_url, auth_date, hash } = req.body ?? {};
  if (!id || !hash || !auth_date) {
    return res.status(400).json({ ok: false, error: 'missing_fields' });
  }

  // Проверяем свежесть данных (не старше 1 дня)
  if (Date.now() / 1000 - Number(auth_date) > 86400) {
    return res.status(400).json({ ok: false, error: 'auth_date_expired' });
  }

  const data = { id: String(id), first_name, auth_date: String(auth_date), hash };
  if (last_name)  data.last_name  = last_name;
  if (username)   data.username   = username;
  if (photo_url)  data.photo_url  = photo_url;

  if (!verifyTelegramHash(data, botToken)) {
    return res.status(403).json({ ok: false, error: 'invalid_hash' });
  }

  const app = getAdminApp();
  const db  = getFirestore(app);
  const uid = `tg_${id}`;

  // Создаём/обновляем пользователя в Firestore
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
    // Инкремент счётчика (только новые)
    db.collection('stats').doc('global').set(
      { userCount: FieldValue.increment(1) }, { merge: true }
    ).catch(() => {});
  } else {
    await userRef.update(profilePatch);
  }

  const token = await getAuth(app).createCustomToken(uid);
  return res.status(200).json({
    ok: true,
    token,
    user: { id: uid, first_name, last_name: last_name ?? '', photo_200: photo_url ?? null },
  });
}
