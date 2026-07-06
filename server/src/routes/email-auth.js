import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { APP_URL } from '../lib/config.js';
import { getDb } from '../lib/firebase.js';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const FROM = 'noreply@myapg.ru';

let _ses = null;
function getSes() {
  if (_ses) return _ses;
  _ses = new SESv2Client({
    endpoint: 'https://postbox.cloud.yandex.net',
    region: 'ru-central1',
    credentials: {
      accessKeyId: process.env.POSTBOX_KEY_ID,
      secretAccessKey: process.env.POSTBOX_SECRET,
    },
  });
  return _ses;
}

async function sendEmail(to, subject, text) {
  const source = `АПГ <${FROM}>`;
  const endpoint = 'https://postbox.cloud.yandex.net';
  console.log('[EMAIL] Отправка:', { to, from: source, endpoint });
  await getSes().send(new SendEmailCommand({
    FromEmailAddress: FROM,
    Destination: { ToAddresses: [to] },
    Content: {
      Simple: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Text: { Data: text, Charset: 'UTF-8' } },
      },
    },
  }));
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendVerificationEmail(db, email, userId, appUrl) {
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
  await db.collection('emailVerifyTokens').doc(token).set({
    email, userId,
    expiresAt: Timestamp.fromMillis(Date.now() + 48 * 60 * 60 * 1000),
    createdAt: FieldValue.serverTimestamp(),
  });
  const verifyUrl = `${appUrl}/?verify_email=${token}`;
  await sendEmail(
    email,
    'Подтвердите адрес электронной почты — АПГ',
    [
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
  );
}

async function resolveEmailUser(db, email, ref) {
  const indexSnap = await db.collection('emailIndex').doc(email).get();
  if (indexSnap.exists) {
    const { userId } = indexSnap.data();
    db.collection('users').doc(userId).update({ lastSeen: FieldValue.serverTimestamp() }).catch(() => {});
    return userId;
  }

  const userId   = `email:${email}`;
  const userSnap = await db.collection('users').doc(userId).get();
  if (userSnap.exists) {
    await db.collection('emailIndex').doc(email).set({ userId, createdAt: FieldValue.serverTimestamp() });
    db.collection('users').doc(userId).update({ lastSeen: FieldValue.serverTimestamp() }).catch(() => {});
    return userId;
  }

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

export default async function emailAuthRoutes(fastify) {
  fastify.post('/api/email-auth', async (request, reply) => {
    const { action, email: rawEmail, code, ref } = request.body ?? {};

    const NO_EMAIL_ACTIONS = ['verify-email', 'link-telegram', 'grant-referral'];
    if (!NO_EMAIL_ACTIONS.includes(action)) {
      if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(rawEmail))) {
        return reply.code(400).send({ ok: false, error: 'invalid_email', message: 'Неверный формат email' });
      }
    }

    const email = rawEmail ? String(rawEmail).trim().toLowerCase() : '';
    const db    = getDb();
    const codeRef = email ? db.collection('emailAuthCodes').doc(email) : null;

    // ── SEND ────────────────────────────────────────────────────────────────────
    if (action === 'send') {
      const snap = await codeRef.get();
      if (snap.exists) {
        const created = snap.data().createdAt?.toMillis?.() ?? 0;
        if (Date.now() - created < 60_000) {
          return reply.code(429).send({ ok: false, error: 'rate_limited', message: 'Подождите минуту перед повторным запросом' });
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
        await sendEmail(
          email,
          'Ваш код входа в АПГ',
          [
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
        );
      } catch (e) {
        await codeRef.delete().catch(() => {});
        request.log.warn({ name: e.name, message: e.message, metadata: e.$metadata || {}, responseBody: e.$response?.body || '' }, 'Postbox send failed');
        return reply.code(500).send({ ok: false, error: 'email_error', message: 'Не удалось отправить письмо. Проверьте адрес или попробуйте позже.' });
      }

      return { ok: true };
    }

    // ── VERIFY ──────────────────────────────────────────────────────────────────
    if (action === 'verify') {
      if (!code || !/^\d{6}$/.test(String(code))) {
        return reply.code(400).send({ ok: false, error: 'invalid_code', message: 'Введите 6-значный код' });
      }

      const snap = await codeRef.get();
      if (!snap.exists) {
        return reply.code(400).send({ ok: false, error: 'code_not_found', message: 'Код не найден. Запросите новый' });
      }

      const data = snap.data();

      if (data.expiresAt.toMillis() < Date.now()) {
        await codeRef.delete().catch(() => {});
        return reply.code(400).send({ ok: false, error: 'code_expired', message: 'Код истёк. Запросите новый' });
      }

      if ((data.attempts ?? 0) >= 5) {
        return reply.code(429).send({ ok: false, error: 'too_many_attempts', message: 'Слишком много попыток. Запросите новый код' });
      }

      if (data.code !== String(code)) {
        await codeRef.update({ attempts: FieldValue.increment(1) });
        const left = 4 - (data.attempts ?? 0);
        return reply.code(400).send({ ok: false, error: 'wrong_code', message: `Неверный код. Осталось попыток: ${left}` });
      }

      await codeRef.delete();

      const userId = await resolveEmailUser(db, email, ref ?? null);

      return {
        ok: true,
        user: {
          id: userId,
          first_name: email.split('@')[0],
          last_name: '',
          photo_200: null,
          email,
        },
      };
    }

    // ── LINK TELEGRAM ────────────────────────────────────────────────────────────
    if (action === 'link-telegram') {
      const { userId, tgId, firstName, lastName, photo } = request.body ?? {};
      if (!userId || !tgId) return reply.code(400).send({ ok: false, error: 'missing_fields' });

      const existingLink = await db.collection('tgLinks').doc(tgId).get();
      if (existingLink.exists && existingLink.data().userId !== userId) {
        return reply.code(409).send({ ok: false, error: 'already_linked', message: 'Этот Telegram уже привязан к другому аккаунту' });
      }

      await db.collection('tgLinks').doc(tgId).set({ userId, createdAt: FieldValue.serverTimestamp() });
      const tgName = [firstName, lastName].filter(Boolean).join(' ') || null;
      await db.collection('users').doc(userId).update({
        linkedTelegram: { tgId, firstName: firstName ?? null, lastName: lastName ?? null, photo: photo ?? null, linkedAt: FieldValue.serverTimestamp() },
        ...(firstName ? { firstName, displayName: tgName } : {}),
        ...(lastName  ? { lastName } : {}),
        ...(photo     ? { photo } : {}),
      }).catch(() => {});

      return { ok: true };
    }

    // ── LINK EMAIL ───────────────────────────────────────────────────────────────
    if (action === 'link-email') {
      const { userId } = request.body ?? {};
      if (!userId || !email) return reply.code(400).send({ ok: false, error: 'missing_fields' });

      const userSnap = await db.collection('users').doc(userId).get();
      if (!userSnap.exists) return reply.code(404).send({ ok: false, error: 'user_not_found' });

      const existing = await db.collection('users').where('email', '==', email).limit(1).get();
      if (!existing.empty && existing.docs[0].id !== userId) {
        return reply.code(409).send({ ok: false, error: 'already_used', message: 'Этот email уже привязан к другому аккаунту' });
      }

      await db.collection('users').doc(userId).update({ linkedEmail: email });
      return { ok: true };
    }

    // ── GRANT REFERRAL ───────────────────────────────────────────────────────────
    if (action === 'grant-referral') {
      const { referrerId, newUserId } = request.body ?? {};
      if (!referrerId || !newUserId) return reply.code(400).send({ ok: false, error: 'missing_fields' });

      const newUserSnap = await db.collection('users').doc(newUserId).get();
      if (!newUserSnap.exists) return reply.code(404).send({ ok: false, error: 'user_not_found' });
      const newUserData = newUserSnap.data();
      if (newUserData.referredBy !== referrerId) return reply.code(403).send({ ok: false, error: 'ref_mismatch' });
      if (newUserData.referralBonusGranted) return reply.code(409).send({ ok: false, error: 'already_granted' });

      await db.collection('users').doc(referrerId).update({
        keys: FieldValue.increment(2),
        referralCount: FieldValue.increment(1),
      }).catch(() => {});
      await db.collection('users').doc(newUserId).update({ referralBonusGranted: true });

      return { ok: true };
    }

    // ── LOGIN ────────────────────────────────────────────────────────────────────
    if (action === 'login') {
      const { ref } = request.body ?? {};
      const userId  = await resolveEmailUser(db, email, ref ?? null);
      const userSnap = await db.collection('users').doc(userId).get();
      const ud = userSnap.data() ?? {};
      if (ud.emailVerified === false) {
        sendVerificationEmail(db, email, userId, APP_URL).catch((e) => {
          request.log.warn({ name: e.name, message: e.message, metadata: e.$metadata || {}, responseBody: e.$response?.body || '' }, 'Postbox verification email failed');
        });
      }
      return {
        ok: true,
        user: {
          id: userId,
          first_name: ud.firstName ?? email.split('@')[0],
          last_name:  ud.lastName  ?? '',
          photo_200:  ud.photo     ?? null,
          email,
          emailVerified: ud.emailVerified ?? null,
        },
      };
    }

    // ── VERIFY EMAIL ─────────────────────────────────────────────────────────────
    if (action === 'verify-email') {
      const { token } = request.body ?? {};
      if (!token) return reply.code(400).send({ ok: false, error: 'missing_token' });
      const tokenSnap = await db.collection('emailVerifyTokens').doc(String(token)).get();
      if (!tokenSnap.exists) return reply.code(404).send({ ok: false, error: 'invalid_token' });
      const { userId, expiresAt } = tokenSnap.data();
      await db.collection('emailVerifyTokens').doc(String(token)).delete();
      if (expiresAt.toMillis() < Date.now()) {
        return reply.code(400).send({ ok: false, error: 'token_expired' });
      }
      await db.collection('users').doc(userId).update({ emailVerified: true }).catch(() => {});
      return { ok: true, userId };
    }

    // ── RESEND VERIFICATION ──────────────────────────────────────────────────────
    if (action === 'resend-verification') {
      const { userId } = request.body ?? {};
      if (!userId) return reply.code(400).send({ ok: false, error: 'missing_fields' });
      const userSnap = await db.collection('users').doc(userId).get();
      if (!userSnap.exists) return reply.code(404).send({ ok: false, error: 'user_not_found' });
      const ud = userSnap.data();
      if (ud.emailVerified) return { ok: true, alreadyVerified: true };
      const userEmail = ud.email ?? email;
      if (!userEmail) return reply.code(400).send({ ok: false, error: 'no_email' });
      await sendVerificationEmail(db, userEmail, userId, APP_URL);
      return { ok: true };
    }

    return reply.code(400).send({ ok: false, error: 'invalid_action' });
  });
}
