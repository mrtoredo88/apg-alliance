// POST /api/email-auth
// Body: { action: 'send', email } | { action: 'verify', email, code, ref? }
// emailAuthCodes/{email}: { code, expiresAt, attempts, createdAt }
// emailIndex/{email}: { userId, createdAt }

import nodemailer from 'nodemailer';
import { APP_URL } from './config.js';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

let _app = null;
function getAdminApp() {
  if (_app) return _app;
  const apps = getApps();
  _app = apps.length ? apps[0] : initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  return _app;
}

function makeTransport() {
  return nodemailer.createTransport({
    host: 'smtp.yandex.ru',
    port: 465,
    secure: true,
    auth: { user: process.env.YANDEX_EMAIL, pass: process.env.YANDEX_EMAIL_PASS },
  });
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', APP_URL);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  const { action, email: rawEmail, code, ref } = req.body ?? {};

  if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(rawEmail))) {
    return res.status(400).json({ ok: false, error: 'invalid_email', message: 'Неверный формат email' });
  }

  const email = String(rawEmail).trim().toLowerCase();
  const db = getFirestore(getAdminApp());
  const codeRef = db.collection('emailAuthCodes').doc(email);

  // ── SEND ────────────────────────────────────────────────────────────────────
  if (action === 'send') {
    // Rate limit: не чаще 1 раза в минуту
    const snap = await codeRef.get();
    if (snap.exists) {
      const created = snap.data().createdAt?.toMillis?.() ?? 0;
      if (Date.now() - created < 60_000) {
        return res.status(429).json({ ok: false, error: 'rate_limited', message: 'Подождите минуту перед повторным запросом' });
      }
    }

    const newCode = generateCode();
    await codeRef.set({
      code: newCode,
      expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60_000),
      attempts: 0,
      createdAt: FieldValue.serverTimestamp(),
    });

    try {
      await makeTransport().sendMail({
        from: `АПГ <${process.env.YANDEX_EMAIL}>`,
        to: email,
        subject: 'Ваш код входа в АПГ',
        text: [
          'Привет!',
          '',
          `Ваш код для входа в АПГ: ${newCode}`,
          '',
          'Код действителен 10 минут.',
          'Если вы не запрашивали код — просто игнорируйте это письмо.',
          '',
          'С уважением, команда АПГ',
          'myapg.ru',
        ].join('\n'),
      });
    } catch (e) {
      await codeRef.delete().catch(() => {});
      console.error('[email-auth] SMTP error:', e.message);
      return res.status(500).json({ ok: false, error: 'smtp_error', message: 'Не удалось отправить письмо. Проверьте адрес или попробуйте позже.' });
    }

    return res.status(200).json({ ok: true });
  }

  // ── VERIFY ──────────────────────────────────────────────────────────────────
  if (action === 'verify') {
    if (!code || !/^\d{6}$/.test(String(code))) {
      return res.status(400).json({ ok: false, error: 'invalid_code', message: 'Введите 6-значный код' });
    }

    const snap = await codeRef.get();
    if (!snap.exists) {
      return res.status(400).json({ ok: false, error: 'code_not_found', message: 'Код не найден. Запросите новый' });
    }

    const data = snap.data();

    if (data.expiresAt.toMillis() < Date.now()) {
      await codeRef.delete().catch(() => {});
      return res.status(400).json({ ok: false, error: 'code_expired', message: 'Код истёк. Запросите новый' });
    }

    if ((data.attempts ?? 0) >= 5) {
      return res.status(429).json({ ok: false, error: 'too_many_attempts', message: 'Слишком много попыток. Запросите новый код' });
    }

    if (data.code !== String(code)) {
      await codeRef.update({ attempts: FieldValue.increment(1) });
      const left = 4 - (data.attempts ?? 0);
      return res.status(400).json({ ok: false, error: 'wrong_code', message: `Неверный код. Осталось попыток: ${left}` });
    }

    // Код верный
    await codeRef.delete();

    const userId = await resolveEmailUser(db, email, ref ?? null);

    return res.status(200).json({
      ok: true,
      user: {
        id: userId,
        first_name: email.split('@')[0],
        last_name: '',
        photo_200: null,
        email,
      },
    });
  }

  // ── LINK TELEGRAM ───────────────────────────────────────────────────────────
  if (action === 'link-telegram') {
    const { userId, tgId, firstName, lastName, photo } = req.body ?? {};
    if (!userId || !tgId) return res.status(400).json({ ok: false, error: 'missing_fields' });

    // Проверяем что tgId не привязан к другому аккаунту
    const existingLink = await db.collection('tgLinks').doc(tgId).get();
    if (existingLink.exists && existingLink.data().userId !== userId) {
      return res.status(409).json({ ok: false, error: 'already_linked', message: 'Этот Telegram уже привязан к другому аккаунту' });
    }

    await db.collection('tgLinks').doc(tgId).set({ userId, createdAt: FieldValue.serverTimestamp() });
    await db.collection('users').doc(userId).update({
      linkedTelegram: { tgId, firstName: firstName ?? null, lastName: lastName ?? null, photo: photo ?? null, linkedAt: FieldValue.serverTimestamp() },
    }).catch(() => {});

    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ ok: false, error: 'invalid_action' });
}

async function resolveEmailUser(db, email, ref) {
  // 1. Проверяем emailIndex — может уже есть аккаунт с этим email
  const indexSnap = await db.collection('emailIndex').doc(email).get();
  if (indexSnap.exists) {
    const { userId } = indexSnap.data();
    db.collection('users').doc(userId).update({ lastSeen: FieldValue.serverTimestamp() }).catch(() => {});
    return userId;
  }

  // 2. Прямой документ пользователя (на случай если emailIndex устарел)
  const userId = `email:${email}`;
  const userSnap = await db.collection('users').doc(userId).get();
  if (userSnap.exists) {
    await db.collection('emailIndex').doc(email).set({ userId, createdAt: FieldValue.serverTimestamp() });
    db.collection('users').doc(userId).update({ lastSeen: FieldValue.serverTimestamp() }).catch(() => {});
    return userId;
  }

  // 3. Новый пользователь
  const isValidRef = ref && ref !== userId;
  const today = new Date().toLocaleDateString('sv');
  await db.collection('users').doc(userId).set({
    authProvider: 'email',
    email,
    displayName: email.split('@')[0],
    firstName: email.split('@')[0],
    lastName: null,
    photo: null,
    keys: isValidRef ? 2 : 0,
    favorites: [],
    scannedPartners: {},
    completedTasks: [],
    streak: 0,
    onboardingDone: false,
    scanDates: [],
    lastBonusDate: today,
    referredBy: isValidRef ? ref : null,
    registeredAt: FieldValue.serverTimestamp(),
  });

  await db.collection('emailIndex').doc(email).set({ userId, createdAt: FieldValue.serverTimestamp() });

  if (isValidRef) {
    db.collection('users').doc(ref).update({
      keys: FieldValue.increment(2),
      referralCount: FieldValue.increment(1),
    }).catch(() => {});
  }

  db.collection('stats').doc('global').set({ userCount: FieldValue.increment(1) }, { merge: true }).catch(() => {});

  return userId;
}
