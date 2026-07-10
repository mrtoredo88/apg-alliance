// POST /api/telegram-webhook
// Telegram вызывает этот endpoint при каждом сообщении боту
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { APP_URL } from './config.js';

let _app = null;
function getAdminApp() {
  if (_app) return _app;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('FIREBASE_SERVICE_ACCOUNT not set');
  _app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  return _app;
}

const TOKEN = () => process.env.TELEGRAM_BOT_TOKEN;
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
  return fetch(`https://api.telegram.org/bot${TOKEN()}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, ...extra }),
  }).catch(() => {});
}

async function tgFileUrl(fileId) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN()}/getFile?file_id=${fileId}`).then(r => r.json());
  if (!r.ok || !r.result?.file_path) return null;
  return `https://api.telegram.org/file/bot${TOKEN()}/${r.result.file_path}`;
}

async function tgGetPhotoUrl(userId) {
  try {
    // Способ 1: getUserProfilePhotos
    const photosRes = await fetch(
      `https://api.telegram.org/bot${TOKEN()}/getUserProfilePhotos?user_id=${userId}&limit=1`
    ).then(r => r.json());
    if (photosRes.ok && photosRes.result?.photos?.length) {
      const sizes = photosRes.result.photos[0];
      const url   = await tgFileUrl(sizes[sizes.length - 1].file_id);
      if (url) return url;
    }

    // Способ 2: getChat (fallback)
    const chatRes = await fetch(
      `https://api.telegram.org/bot${TOKEN()}/getChat?chat_id=${userId}`
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const update  = req.body ?? {};
  const message = update.message;

  if (!message?.text) return res.status(200).json({ ok: true });

  const from = message.from;
  const text = message.text.trim();

  // ── /start auth_STATE — авторизация в приложении ────────────────────────────
  const authMatch = text.match(/^\/start auth_([a-f0-9]{32})$/);
  if (authMatch) {
    const state = authMatch[1];
    const db    = getFirestore(getAdminApp());
    const ref   = db.collection('telegramAuthSessions').doc(state);
    const snap  = await ref.get();

    const session = snap.data() || {};
    if (!snap.exists || session.status !== 'pending') {
      tgSend(from.id, '⚠️ Ссылка устарела или уже использована. Вернитесь в приложение и нажмите кнопку снова.');
      return res.status(200).json({ ok: true });
    }

    const expiresAt = session.expiresAt;
    const expired   = (expiresAt?.toDate ? expiresAt.toDate() : new Date(expiresAt)) < new Date();
    if (expired) {
      await ref.update({ status: 'expired' });
      tgSend(from.id, '⚠️ Ссылка устарела. Вернитесь в приложение и нажмите кнопку снова.');
      return res.status(200).json({ ok: true });
    }

    const tgId = `tg_${from.id}`;
    if (session.linking === true) {
      const ownerUserId = String(session.ownerUserId || '').trim();
      let linkError = '';
      let linkedOwnerId = ownerUserId || null;
      if (!ownerUserId) {
        linkError = 'owner_not_found';
      } else {
        const [ownerSnap, linkSnap] = await Promise.all([
          db.collection('users').doc(ownerUserId).get(),
          db.collection('tgLinks').doc(tgId).get(),
        ]);
        if (!ownerSnap.exists) {
          linkError = 'owner_not_found';
        } else if (linkSnap.exists && String(linkSnap.data()?.userId || '') !== ownerUserId) {
          linkError = 'already_linked';
          linkedOwnerId = String(linkSnap.data()?.userId || '');
        }
      }
      await ref.update({
        status: 'done',
        linking: true,
        linkError: linkError || null,
        linkedOwnerId,
        tgUserId: String(from.id),
        firstName: from.first_name ?? '',
        lastName: from.last_name ?? '',
        username: from.username ?? '',
        photoUrl: null,
        completedAt: FieldValue.serverTimestamp(),
      });
      tgSend(from.id,
        linkError
          ? '⚠️ Не удалось подключить Telegram. Вернитесь в приложение — там показана причина.'
          : '✅ Telegram подтверждён. Вернитесь в приложение АПГ — привязка завершится автоматически.',
        { reply_markup: SOCIAL_KEYBOARD },
      );
      return res.status(200).json({ ok: true });
    }

    await ref.update({
      status:    'done',
      tgUserId:  String(from.id),
      firstName: from.first_name ?? '',
      lastName:  from.last_name  ?? '',
      username:  from.username   ?? '',
      photoUrl:  null,
    });

    const uid      = tgId;
    const userRef  = db.collection('users').doc(uid);
    tgGetPhotoUrl(from.id)
      .then(async (photoUrl) => {
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
      })
      .catch(error => console.warn('[telegram-webhook] profile background update failed', error?.message || String(error)));

    tgSend(from.id,
      `✅ Вы вошли в приложение АПГ!\n\nВернитесь в браузер — страница обновится автоматически.\n\n📌 Наши площадки:`,
      { reply_markup: SOCIAL_KEYBOARD },
    );
    return res.status(200).json({ ok: true });
  }

  // ── /start без payload — только приветствие. Auth требует персональный state ──
  if (text === '/start') {
    tgSend(from.id, WELCOME_TEXT, { reply_markup: SOCIAL_KEYBOARD });
    return res.status(200).json({ ok: true });
  }

  // ── /links или /social — повторный показ соцсетей ───────────────────────────
  if (text === '/links' || text === '/social') {
    tgSend(from.id, LINKS_TEXT, { reply_markup: SOCIAL_KEYBOARD });
    return res.status(200).json({ ok: true });
  }

  // ── /help ────────────────────────────────────────────────────────────────────
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
    return res.status(200).json({ ok: true });
  }

  // ── Любое другое сообщение ───────────────────────────────────────────────────
  tgSend(from.id,
    `Для входа в приложение открой ${APP_URL} и нажми «Войти через Telegram».\n\n` +
    'Чтобы быстро попасть в АПГ — нажми «Локи АПГ».',
    { reply_markup: SOCIAL_KEYBOARD },
  );
  return res.status(200).json({ ok: true });
}
