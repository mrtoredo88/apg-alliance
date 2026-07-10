// POST /api/email-auth
// Body: { action: 'send', email } | { action: 'verify', email, code, ref? }
// emailAuthCodes/{email}: { code, expiresAt, attempts, createdAt }
// emailIndex/{email}: { userId, createdAt }

import nodemailer from 'nodemailer';
import { APP_URL } from './config.js';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

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

function getBearerToken(req) {
  const direct = String(req.headers['x-firebase-auth'] || req.headers['X-Firebase-Auth'] || req.headers['x-apg-auth'] || req.headers['X-APG-Auth'] || '').trim();
  if (direct) return direct.replace(/^Bearer\s+/i, '');
  const header = String(req.headers.authorization || req.headers.Authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

function safeString(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeTgId(value) {
  const raw = safeString(value, 80);
  if (!raw) return '';
  return raw.startsWith('tg_') ? raw : `tg_${raw}`;
}

async function attachPendingPartnerInvites(db, email, userId) {
  const normalizedEmail = safeString(email, 200).toLowerCase();
  if (!normalizedEmail || !userId) return;
  const snap = await db.collection('partnerInvites').where('email', '==', normalizedEmail).limit(10).get().catch(() => null);
  if (!snap || snap.empty) return;
  const pending = snap.docs.filter(doc => ['sent', 'prepared'].includes(String(doc.data()?.status || '')));
  await Promise.all(pending.map(async inviteDoc => {
    const invite = inviteDoc.data() || {};
    const partnerId = safeString(invite.partnerId, 160);
    if (!partnerId) return;
    await db.collection('partners').doc(partnerId).set({
      ownerId: userId,
      ownerEmail: normalizedEmail,
      connectionEmail: normalizedEmail,
      partnerCabinetEnabled: true,
      connectionStatus: 'registration_completed',
      connectionStatusLabel: 'Регистрация завершена',
      lifecycleStatus: 'card_setup',
      lifecycleStatusLabel: 'Карточка оформляется',
      partnerConnectionEvents: FieldValue.arrayUnion({
        type: 'registration_completed',
        label: `Партнёр зарегистрировался по приглашению: ${normalizedEmail}`,
        at: new Date().toISOString(),
        actorUid: userId,
        actorId: userId,
        actorName: normalizedEmail,
      }),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await db.collection('users').doc(userId).set({
      partnerId,
      partnerCabinetIds: FieldValue.arrayUnion(partnerId),
      partnerCabinetEnabled: true,
      role: 'partner',
      linkedPartnerAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await inviteDoc.ref.set({ status: 'accepted', acceptedBy: userId, acceptedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await db.collection('partnerConnectionEvents').add({
      partnerId,
      type: 'registration_completed',
      label: `Партнёр зарегистрировался по приглашению: ${normalizedEmail}`,
      email: normalizedEmail,
      userId,
      createdAt: FieldValue.serverTimestamp(),
    });
  }));
}

async function getActor(req, db) {
  const token = getBearerToken(req);
  if (!token) {
    const error = new Error('Требуется авторизация.');
    error.statusCode = 401;
    throw error;
  }
  const decoded = await getAuth(getAdminApp()).verifyIdToken(token);
  const uid = decoded.uid;
  const direct = await db.collection('users').doc(uid).get().catch(() => null);
  if (direct?.exists) return { uid, userId: uid, user: direct.data() || {}, source: 'users.uid' };
  const map = await db.collection('auth_map').doc(uid).get().catch(() => null);
  const mappedUserId = map?.exists ? safeString(map.data()?.userId || map.data()?.vkId, 180) : '';
  if (mappedUserId) {
    const mapped = await db.collection('users').doc(mappedUserId).get().catch(() => null);
    return { uid, userId: mappedUserId, user: mapped?.data?.() || {}, source: 'auth_map' };
  }
  return { uid, userId: uid, user: {}, source: 'token' };
}

async function auditAccountLink(db, req, payload) {
  await db.collection('accountLinkAudit').add({
    ...payload,
    userAgent: safeString(req.headers['user-agent'], 300),
    appVersion: safeString(req.headers['x-apg-version'], 80),
    createdAt: FieldValue.serverTimestamp(),
  }).catch(() => {});
}

async function createFirebaseToken(userId) {
  return getAuth(getAdminApp()).createCustomToken(String(userId));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', APP_URL);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-Auth, X-APG-Auth, X-APG-Version');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  const { action, email: rawEmail, code, ref } = req.body ?? {};

  const NO_EMAIL_ACTIONS = ['verify-email', 'link-telegram', 'grant-referral', 'resend-verification'];
  if (!NO_EMAIL_ACTIONS.includes(action)) {
    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(rawEmail))) {
      return res.status(400).json({ ok: false, error: 'invalid_email', message: 'Неверный формат email' });
    }
  }

  const email = rawEmail ? String(rawEmail).trim().toLowerCase() : '';
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
      console.warn('[email-auth] SMTP error:', e.message);
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

    const token = await createFirebaseToken(userId);
    return res.status(200).json({
      ok: true,
      token,
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
    const { userId, tgId, firstName, lastName, username, photo } = req.body ?? {};
    const normalizedTgId = normalizeTgId(tgId);
    if (!userId || !normalizedTgId) return res.status(400).json({ ok: false, error: 'missing_fields' });

    const actor = await getActor(req, db);
    if (String(actor.userId) !== String(userId)) {
      await auditAccountLink(db, req, { action: 'link-telegram', result: 'blocked_owner_mismatch', firebaseUid: actor.uid, actorUserId: actor.userId, requestedUserId: String(userId), telegramId: normalizedTgId });
      return res.status(403).json({ ok: false, error: 'owner_mismatch', message: 'Нельзя привязать Telegram к другому аккаунту.' });
    }

    const otherUserByTg = await db.collection('users').where('linkedTelegram.tgId', '==', normalizedTgId).limit(1).get();
    if (!otherUserByTg.empty && otherUserByTg.docs[0].id !== String(userId)) {
      await auditAccountLink(db, req, { action: 'link-telegram', result: 'blocked_existing_user_link', firebaseUid: actor.uid, actorUserId: actor.userId, requestedUserId: String(userId), telegramId: normalizedTgId, existingUserId: otherUserByTg.docs[0].id });
      return res.status(409).json({ ok: false, error: 'already_linked', message: 'Этот Telegram уже привязан к другому аккаунту.' });
    }

    try {
      await db.runTransaction(async tx => {
        const linkRef = db.collection('tgLinks').doc(normalizedTgId);
        const userRef = db.collection('users').doc(String(userId));
        const [existingLink, userSnap] = await Promise.all([tx.get(linkRef), tx.get(userRef)]);
        if (!userSnap.exists) throw Object.assign(new Error('Аккаунт не найден.'), { statusCode: 404 });
        if (existingLink.exists && String(existingLink.data().userId) !== String(userId)) {
          throw Object.assign(new Error('Этот Telegram уже привязан к другому аккаунту.'), { statusCode: 409 });
        }
        tx.set(linkRef, {
          userId: String(userId),
          telegramId: normalizedTgId,
          firebaseUid: actor.uid,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: existingLink.exists ? existingLink.data().createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.set(userRef, {
          linkedTelegram: { tgId: normalizedTgId, firstName: firstName ?? null, lastName: lastName ?? null, username: username ?? null, photo: photo ?? null, linkedAt: FieldValue.serverTimestamp() },
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      });
    } catch (e) {
      return res.status(e.statusCode || 500).json({ ok: false, error: e.statusCode === 409 ? 'already_linked' : 'link_failed', message: e.message || 'Не удалось привязать Telegram.' });
    }
    await auditAccountLink(db, req, { action: 'link-telegram', result: 'success', firebaseUid: actor.uid, actorUserId: actor.userId, requestedUserId: String(userId), telegramId: normalizedTgId });

    return res.status(200).json({ ok: true });
  }

  // ── LINK EMAIL TO TELEGRAM ACCOUNT ──────────────────────────────────────────
  if (action === 'link-email') {
    const { userId } = req.body ?? {};
    if (!userId || !email) return res.status(400).json({ ok: false, error: 'missing_fields' });

    const actor = await getActor(req, db);
    if (String(actor.userId) !== String(userId)) {
      await auditAccountLink(db, req, { action: 'link-email', result: 'blocked_owner_mismatch', firebaseUid: actor.uid, actorUserId: actor.userId, requestedUserId: String(userId), email });
      return res.status(403).json({ ok: false, error: 'owner_mismatch', message: 'Нельзя привязать email к другому аккаунту.' });
    }

    const existing = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!existing.empty && existing.docs[0].id !== userId) {
      await auditAccountLink(db, req, { action: 'link-email', result: 'blocked_existing_user_email', firebaseUid: actor.uid, actorUserId: actor.userId, requestedUserId: String(userId), email, existingUserId: existing.docs[0].id });
      return res.status(409).json({ ok: false, error: 'already_used', message: 'Этот email уже привязан к другому аккаунту' });
    }

    try {
      await db.runTransaction(async tx => {
        const userRef = db.collection('users').doc(String(userId));
        const emailRef = db.collection('emailIndex').doc(email);
        const [userSnap, emailSnap] = await Promise.all([tx.get(userRef), tx.get(emailRef)]);
        if (!userSnap.exists) throw Object.assign(new Error('Аккаунт не найден.'), { statusCode: 404 });
        if (emailSnap.exists && String(emailSnap.data().userId) !== String(userId)) {
          throw Object.assign(new Error('Этот email уже привязан к другому аккаунту.'), { statusCode: 409 });
        }
        tx.set(emailRef, {
          userId: String(userId),
          firebaseUid: actor.uid,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: emailSnap.exists ? emailSnap.data().createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.set(userRef, { linkedEmail: email, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      });
    } catch (e) {
      return res.status(e.statusCode || 500).json({ ok: false, error: e.statusCode === 409 ? 'already_used' : 'link_failed', message: e.message || 'Не удалось привязать email.' });
    }
    await auditAccountLink(db, req, { action: 'link-email', result: 'success', firebaseUid: actor.uid, actorUserId: actor.userId, requestedUserId: String(userId), email });
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
    const token = await createFirebaseToken(userId);
    return res.status(200).json({
      ok: true,
      token,
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
  await attachPendingPartnerInvites(db, email, userId).catch(() => {});

  if (isValidRef) {
    db.collection('users').doc(ref).update({
      keys: FieldValue.increment(2),
      referralCount: FieldValue.increment(1),
    }).catch(() => {});
  }

  db.collection('stats').doc('global').set({ userCount: FieldValue.increment(1) }, { merge: true }).catch(() => {});

  return userId;
}
