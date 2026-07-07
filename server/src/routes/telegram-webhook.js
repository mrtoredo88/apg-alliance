import { APP_URL } from '../lib/config.js';
import { getDb } from '../lib/firebase.js';
import { FieldValue } from 'firebase-admin/firestore';

const TELEGRAM_HELPER_URL = `${APP_URL}/#/telegram-helper`;

const SOCIAL_KEYBOARD = {
  inline_keyboard: [
    [{ text: '◌ Локи АПГ', web_app: { url: TELEGRAM_HELPER_URL } }],
    [{ text: '🚀 Быстрый вход в АПГ', web_app: { url: TELEGRAM_HELPER_URL } }],
    [{ text: '🔗 Приложение АПГ', url: APP_URL }],
    [{ text: '📱 ВКонтакте',      url: 'https://vk.com/apgzelenograd'   },
     { text: '📢 Telegram-канал', url: 'https://t.me/apgzel'            }],
    [{ text: '🎥 YouTube',        url: 'https://www.youtube.com/@ВиталийСтроитАПГ' }],
    [{ text: '📸 Instagram',      url: 'https://www.instagram.com/mr_toredo88' },
     { text: '🎵 Дзен',          url: 'https://dzen.ru/apgzel'          }],
  ],
};

const WELCOME_TEXT =
`Привет! Это бот АПГ — Альянса Партнёров Города 🏙️

Здесь можно авторизоваться, открыть Локи и быстро попасть в экосистему АПГ 👇`;

const LINKS_TEXT = '📌 Все наши площадки:';

async function tgSend(chatId, text, extra = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, ...extra }),
  }).catch(() => {});
}

async function tgFileUrl(fileId) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const r = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`).then(r => r.json());
  if (!r.ok || !r.result?.file_path) return null;
  return `https://api.telegram.org/file/bot${token}/${r.result.file_path}`;
}

async function tgGetPhotoUrl(userId) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const photosRes = await fetch(
      `https://api.telegram.org/bot${token}/getUserProfilePhotos?user_id=${userId}&limit=1`
    ).then(r => r.json());
    if (photosRes.ok && photosRes.result?.photos?.length) {
      const sizes = photosRes.result.photos[0];
      const url   = await tgFileUrl(sizes[sizes.length - 1].file_id);
      if (url) return url;
    }
    const chatRes = await fetch(
      `https://api.telegram.org/bot${token}/getChat?chat_id=${userId}`
    ).then(r => r.json());
    if (chatRes.ok && chatRes.result?.photo?.big_file_id) {
      const url = await tgFileUrl(chatRes.result.photo.big_file_id);
      if (url) return url;
    }
    return null;
  } catch {
    return null;
  }
}

async function upsertUser(db, from, photoUrl) {
  const uid      = `tg_${from.id}`;
  const userRef  = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const profilePatch = {
    authProvider: 'telegram',
    displayName: [from.first_name, from.last_name].filter(Boolean).join(' ') || null,
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
}

export default async function telegramWebhookRoutes(fastify) {
  fastify.post('/api/telegram-webhook', async (request, reply) => {
    const update  = request.body ?? {};
    const message = update.message;

    if (!message?.text) return { ok: true };

    const from = message.from;
    const text = message.text.trim();

    // /start auth_STATE
    const authMatch = text.match(/^\/start auth_([a-f0-9]{32})$/);
    if (authMatch) {
      const state = authMatch[1];
      const db    = getDb();
      const ref   = db.collection('telegramAuthSessions').doc(state);
      const snap  = await ref.get();

      if (!snap.exists || snap.data().status !== 'pending') {
        tgSend(from.id, '⚠️ Ссылка устарела или уже использована. Вернитесь в приложение и нажмите кнопку снова.');
        return { ok: true };
      }

      const expiresAt = snap.data().expiresAt;
      const expired   = (expiresAt?.toDate ? expiresAt.toDate() : new Date(expiresAt)) < new Date();
      if (expired) {
        await ref.update({ status: 'expired' });
        tgSend(from.id, '⚠️ Ссылка устарела. Вернитесь в приложение и нажмите кнопку снова.');
        return { ok: true };
      }

      await ref.update({
        status:    'done',
        tgUserId:  String(from.id),
        firstName: from.first_name ?? '',
        lastName:  from.last_name  ?? '',
        username:  from.username   ?? '',
        photoUrl:  null,
      });

      tgGetPhotoUrl(from.id)
        .then(photoUrl => upsertUser(db, from, photoUrl))
        .catch(error => request.log.warn({ message: error?.message || String(error) }, 'telegram profile background update failed'));
      tgSend(from.id,
        `✅ Вы вошли в приложение АПГ!\n\nВернитесь в браузер — страница обновится автоматически.\n\n📌 Наши площадки:`,
        { reply_markup: SOCIAL_KEYBOARD },
      );
      return { ok: true };
    }

    // /start без payload: только приветствие. Auth требует персональный state.
    if (text === '/start') {
      tgSend(from.id, WELCOME_TEXT, { reply_markup: SOCIAL_KEYBOARD });
      return { ok: true };
    }

    if (text === '/links' || text === '/social') {
      tgSend(from.id, LINKS_TEXT, { reply_markup: SOCIAL_KEYBOARD });
      return { ok: true };
    }

    if (text === '/help') {
      tgSend(from.id,
        'ℹ️ Команды бота АПГ:\n\n' +
        '/start — приветствие и ссылки\n' +
        '/links — наши соцсети\n' +
        '/help — эта справка\n\n' +
        '◌ Кнопка «Локи АПГ» открывает карманную версию Локи прямо внутри Telegram.\n\n' +
        `Для входа в приложение открой ${APP_URL} и нажми «Войти через Telegram».`,
        { reply_markup: SOCIAL_KEYBOARD },
      );
      return { ok: true };
    }

    tgSend(from.id,
      `Для входа в приложение открой ${APP_URL} и нажми «Войти через Telegram».\n\n` +
      'Чтобы быстро попасть в АПГ — нажми «Локи АПГ».',
      { reply_markup: SOCIAL_KEYBOARD },
    );
    return { ok: true };
  });
}
