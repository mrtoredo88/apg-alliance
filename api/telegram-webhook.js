// POST /api/telegram-webhook
// Telegram вызывает этот endpoint при каждом сообщении боту
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

let _app = null;
function getAdminApp() {
  if (_app) return _app;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('FIREBASE_SERVICE_ACCOUNT not set');
  _app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  return _app;
}

async function tgSend(chatId, text) {
  return fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => {});
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const update  = req.body ?? {};
  const message = update.message;

  if (!message?.text) return res.status(200).json({ ok: true });

  const from = message.from;

  // /start auth_STATE
  const authMatch = message.text.match(/^\/start auth_([a-f0-9]{32})$/);
  if (authMatch) {
    const state = authMatch[1];
    const db    = getFirestore(getAdminApp());
    const ref   = db.collection('telegramAuthSessions').doc(state);
    const snap  = await ref.get();

    if (!snap.exists || snap.data().status !== 'pending') {
      await tgSend(from.id, '⚠️ Ссылка устарела или уже использована. Вернитесь в приложение и нажмите кнопку снова.');
      return res.status(200).json({ ok: true });
    }

    const expiresAt = snap.data().expiresAt;
    const expired   = (expiresAt?.toDate ? expiresAt.toDate() : new Date(expiresAt)) < new Date();
    if (expired) {
      await ref.update({ status: 'expired' });
      await tgSend(from.id, '⚠️ Ссылка устарела. Вернитесь в приложение и нажмите кнопку снова.');
      return res.status(200).json({ ok: true });
    }

    // Помечаем сессию как завершённую
    await ref.update({
      status:    'done',
      tgUserId:  String(from.id),
      firstName: from.first_name ?? '',
      lastName:  from.last_name  ?? '',
      username:  from.username   ?? '',
    });

    // Создаём/обновляем пользователя в Firestore
    const uid      = `tg_${from.id}`;
    const userRef  = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const profilePatch = {
      authProvider: 'telegram',
      firstName: from.first_name ?? null,
      lastName:  from.last_name  ?? null,
      photo:     null,
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
      db.collection('stats').doc('global')
        .set({ userCount: FieldValue.increment(1) }, { merge: true })
        .catch(() => {});
    } else {
      await userRef.update(profilePatch);
    }

    await tgSend(from.id, '✅ Вы вошли в приложение АПГ!\n\nВернитесь в браузер — страница обновится автоматически.');
    return res.status(200).json({ ok: true });
  }

  // Любое другое сообщение
  await tgSend(from.id, 'Привет! Этот бот используется для авторизации в приложении АПГ Зеленоград.\n\nОткройте приложение и нажмите «Войти через Telegram».');
  return res.status(200).json({ ok: true });
}
