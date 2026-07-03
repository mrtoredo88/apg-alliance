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
    const tgName = [firstName, lastName].filter(Boolean).join(' ') || null;
    await db.collection('users').doc(userId).update({
      linkedTelegram: { tgId, firstName: firstName ?? null, lastName: lastName ?? null, photo: photo ?? null, linkedAt: FieldValue.serverTimestamp() },
      ...(firstName  ? { firstName, displayName: tgName } : {}),
      ...(lastName   ? { lastName } : {}),
      ...(photo      ? { photo } : {}),
    }).catch(() => {});

    return res.status(200).json({ ok: true });
  }

  // ── LINK EMAIL TO TELEGRAM ACCOUNT ──────────────────────────────────────────
  if (action === 'link-email') {
    const { userId } = req.body ?? {};
    if (!userId || !email) return res.status(400).json({ ok: false, error: 'missing_fields' });

    const userSnap = await db.collection('users').doc(userId).get();
    if (!userSnap.exists) return res.status(404).json({ ok: false, error: 'user_not_found' });

    // Проверяем что email не занят другим аккаунтом
    const existing = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!existing.empty && existing.docs[0].id !== userId) {
      return res.status(409).json({ ok: false, error: 'already_used', message: 'Этот email уже привязан к другому аккаунту' });
    }

    await db.collection('users').doc(userId).update({ linkedEmail: email });
    return res.status(200).json({ ok: true });
  }

  // ── GRANT REFERRAL BONUS ────────────────────────────────────────────────────
  // Клиент не может писать в чужой users-документ (Firestore rules isOwner).
  // Поэтому реферальный бонус рефереру начисляем через Admin SDK здесь.
  if (action === 'grant-referral') {
    const { referrerId, newUserId } = req.body ?? {};
    if (!referrerId || !newUserId) return res.status(400).json({ ok: false, error: 'missing_fields' });

    // Проверяем что newUser действительно был создан с этим referredBy
    const newUserSnap = await db.collection('users').doc(newUserId).get();
    if (!newUserSnap.exists) return res.status(404).json({ ok: false, error: 'user_not_found' });
    const newUserData = newUserSnap.data();
    if (newUserData.referredBy !== referrerId) return res.status(403).json({ ok: false, error: 'ref_mismatch' });
    if (newUserData.referralBonusGranted) return res.status(409).json({ ok: false, error: 'already_granted' });

    await db.collection('users').doc(referrerId).update({
      keys: FieldValue.increment(2),
      referralCount: FieldValue.increment(1),
    }).catch(() => {});
    await db.collection('users').doc(newUserId).update({ referralBonusGranted: true });

    return res.status(200).json({ ok: true });
  }

  // ── LOGIN (мгновенный вход, без кода) ────────────────────────────────────────
  if (action === 'login') {
    const { ref } = req.body ?? {};
    const userId = await resolveEmailUser(db, email, ref ?? null);
    const userSnap = await db.collection('users').doc(userId).get();
    const ud = userSnap.data() ?? {};
    // Отправляем письмо-подтверждение только если ещё не подтверждён
    if (ud.emailVerified === false) {
      sendVerificationEmail(db, email, userId, APP_URL).catch(() => {});
    }
    return res.status(200).json({
      ok: true,
      user: {
        id: userId,
        first_name: ud.firstName ?? email.split('@')[0],
        last_name:  ud.lastName  ?? '',
        photo_200:  ud.photo     ?? null,
        email,
        emailVerified: ud.emailVerified ?? null,
      },
    });
  }

  // ── VERIFY-EMAIL (переход по ссылке из письма) ────────────────────────────
  if (action === 'verify-email') {
    const { token } = req.body ?? {};
    if (!token) return res.status(400).json({ ok: false, error: 'missing_token' });
    const tokenSnap = await db.collection('emailVerifyTokens').doc(String(token)).get();
    if (!tokenSnap.exists) return res.status(404).json({ ok: false, error: 'invalid_token' });
    const { userId, expiresAt } = tokenSnap.data();
    await db.collection('emailVerifyTokens').doc(String(token)).delete();
    if (expiresAt.toMillis() < Date.now()) {
      return res.status(400).json({ ok: false, error: 'token_expired' });
    }
    await db.collection('users').doc(userId).update({ emailVerified: true }).catch(() => {});
    return res.status(200).json({ ok: true, userId });
  }

  // ── RESEND-VERIFICATION (повторная отправка из профиля) ───────────────────
  if (action === 'resend-verification') {
    const { userId } = req.body ?? {};
    if (!userId) return res.status(400).json({ ok: false, error: 'missing_fields' });
    const userSnap = await db.collection('users').doc(userId).get();
    if (!userSnap.exists) return res.status(404).json({ ok: false, error: 'user_not_found' });
    const ud = userSnap.data();
    if (ud.emailVerified) return res.status(200).json({ ok: true, alreadyVerified: true });
    const userEmail = ud.email ?? email;
    if (!userEmail) return res.status(400).json({ ok: false, error: 'no_email' });
    await sendVerificationEmail(db, userEmail, userId, APP_URL);
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ ok: false, error: 'invalid_action' });
}

async function sendVerificationEmail(db, email, userId, appUrl) {
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
  await db.collection('emailVerifyTokens').doc(token).set({
    email, userId,
    expiresAt: Timestamp.fromMillis(Date.now() + 48 * 60 * 60 * 1000),
    createdAt: FieldValue.serverTimestamp(),
  });
  const verifyUrl = `${appUrl}/?verify_email=${token}`;
  const transport = nodemailer.createTransport({
    host: 'smtp.yandex.ru', port: 465, secure: true,
    auth: { user: process.env.YANDEX_EMAIL, pass: process.env.YANDEX_EMAIL_PASS },
  });
  await transport.sendMail({
    from: `АПГ <${process.env.YANDEX_EMAIL}>`,
    to: email,
    subject: 'Подтвердите адрес электронной почты — АПГ',
    text: [
      'Добро пожаловать в АПГ Зеленоград!',
      '',
      'Нажмите на ссылку, чтобы подтвердить адрес электронной почты:',
      '',
      verifyUrl,
      '',
      'Ссылка действительна 48 часов.',
      'Если вы не регистрировались в приложении АПГ — просто проигнорируйте это письмо.',
      '',
      'С уважением, команда АПГ',
      'myapg.ru',
    ].join('\n'),
  });
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
    emailVerified: false,
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
