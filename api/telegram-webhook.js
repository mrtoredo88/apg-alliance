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

async function tgFileUrl(token, fileId) {
  const r = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`).then(r => r.json());
  if (!r.ok || !r.result?.file_path) return null;
  return `https://api.telegram.org/file/bot${token}/${r.result.file_path}`;
}

async function tgGetPhotoUrl(userId) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    // Способ 1: getUserProfilePhotos
    const photosRes = await fetch(
      `https://api.telegram.org/bot${token}/getUserProfilePhotos?user_id=${userId}&limit=1`
    ).then(r => r.json());
    if (photosRes.ok && photosRes.result?.photos?.length) {
      const sizes  = photosRes.result.photos[0];
      const fileId = sizes[sizes.length - 1].file_id;
      const url    = await tgFileUrl(token, fileId);
      if (url) return url;
    }

    // Способ 2: getChat (fallback — работает даже при некоторых privacy-настройках)
    const chatRes = await fetch(
      `https://api.telegram.org/bot${token}/getChat?chat_id=${userId}`
    ).then(r => r.json());
    if (chatRes.ok && chatRes.result?.photo?.big_file_id) {
      const url = await tgFileUrl(token, chatRes.result.photo.big_file_id);
      if (url) return url;
    }

    return null;
  } catch {
    return null;
  }
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

    // Получаем фото профиля (параллельно с остальным)
    const photoUrl = await tgGetPhotoUrl(from.id);

    // Помечаем сессию как завершённую
    await ref.update({
      status:    'done',
      tgUserId:  String(from.id),
      firstName: from.first_name ?? '',
      lastName:  from.last_name  ?? '',
      username:  from.username   ?? '',
      photoUrl:  photoUrl ?? null,
    });

    // Создаём/обновляем пользователя в Firestore
    const uid      = `tg_${from.id}`;
    const userRef  = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const profilePatch = {
      authProvider: 'telegram',
      firstName: from.first_name ?? null,
      lastName:  from.last_name  ?? null,
      photo:     photoUrl ?? null,
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
