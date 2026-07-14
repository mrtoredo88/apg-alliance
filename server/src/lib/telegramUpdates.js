import { APP_URL } from './config.js';
import { FieldValue } from 'firebase-admin/firestore';
import { telegramUrl } from '../../../server-shared/telegram.js';

const TELEGRAM_HELPER_URL = `${APP_URL}/#/telegram-helper`;

const SOCIAL_KEYBOARD = {
  inline_keyboard: [
    [{ text: '◌ Локи АПГ', web_app: { url: TELEGRAM_HELPER_URL } }],
    [{ text: '🚀 Быстрый вход в АПГ', web_app: { url: TELEGRAM_HELPER_URL } }],
    [{ text: '🔗 Приложение АПГ', url: APP_URL }],
    [{ text: '📱 ВКонтакте',      url: 'https://vk.com/apgzelenograd'   },
     { text: '📢 Telegram-канал', url: telegramUrl('apgzel')            }],
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

export async function processTelegramUpdate(db, update, log = console) {
  const message = update?.message;
  if (!message?.text) return { handled: false };

  const from = message.from;
  const text = message.text.trim();

  const authMatch = text.match(/^\/start auth_([a-f0-9]{32})$/);
  if (authMatch) {
    const state = authMatch[1];
    const ref   = db.collection('telegramAuthSessions').doc(state);
    const snap  = await ref.get();

    const session = snap.data() || {};
    if (!snap.exists || session.status !== 'pending') {
      tgSend(from.id, '⚠️ Ссылка устарела или уже использована. Вернитесь в приложение и нажмите кнопку снова.');
      return { handled: true, kind: 'auth_stale' };
    }

    const expiresAt = session.expiresAt;
    const expired   = (expiresAt?.toDate ? expiresAt.toDate() : new Date(expiresAt)) < new Date();
    if (expired) {
      await ref.update({ status: 'expired' });
      tgSend(from.id, '⚠️ Ссылка устарела. Вернитесь в приложение и нажмите кнопку снова.');
      return { handled: true, kind: 'auth_expired' };
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
      return { handled: true, kind: 'auth_link' };
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
      .catch(error => log.warn?.({ message: error?.message || String(error) }, 'telegram profile background update failed'));
    tgSend(from.id,
      `✅ Вы вошли в приложение АПГ!\n\nВернитесь в браузер — страница обновится автоматически.\n\n📌 Наши площадки:`,
      { reply_markup: SOCIAL_KEYBOARD },
    );
    return { handled: true, kind: 'auth_done' };
  }

  if (text === '/start') {
    tgSend(from.id, WELCOME_TEXT, { reply_markup: SOCIAL_KEYBOARD });
    return { handled: true, kind: 'start' };
  }

  if (text === '/links' || text === '/social') {
    tgSend(from.id, LINKS_TEXT, { reply_markup: SOCIAL_KEYBOARD });
    return { handled: true, kind: 'links' };
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
    return { handled: true, kind: 'help' };
  }

  tgSend(from.id,
    `Для входа в приложение открой ${APP_URL} и нажми «Войти через Telegram».\n\n` +
    'Чтобы быстро попасть в АПГ — нажми «Локи АПГ».',
    { reply_markup: SOCIAL_KEYBOARD },
  );
  return { handled: true, kind: 'fallback' };
}

// Poll-модель вместо webhook: входящий путь Telegram → Yandex Cloud ненадёжен
// (getWebhookInfo: connection timed out; доставка с опозданием в десятки минут).
const POLL_LOCK_MS = 5000;
const POLL_STATE_REF = db => db.collection('config').doc('telegramPolling');

export async function pollTelegramUpdates(db, log = console) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, reason: 'no_token' };

  const stateRef = POLL_STATE_REF(db);
  const startedAt = Date.now();
  let offset = 0;

  const acquired = await db.runTransaction(async tx => {
    const snap = await tx.get(stateRef);
    const data = snap.data() || {};
    if (Number(data.lockUntil || 0) > startedAt) return false;
    offset = Number(data.offset || 0);
    tx.set(stateRef, { lockUntil: startedAt + POLL_LOCK_MS }, { merge: true });
    return true;
  }).catch(() => false);
  if (!acquired) return { ok: true, skipped: 'locked' };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(offset ? { offset } : {}),
        timeout: 0,
        limit: 50,
        allowed_updates: ['message'],
      }),
    }).then(r => r.json());

    if (!res.ok) {
      const errorText = `${res.error_code || ''} ${res.description || 'getUpdates failed'}`.trim().slice(0, 200);
      await stateRef.set({ lockUntil: 0, lastPollAt: FieldValue.serverTimestamp(), lastError: errorText }, { merge: true }).catch(() => {});
      return { ok: false, reason: errorText, conflict: res.error_code === 409 };
    }

    const updates = Array.isArray(res.result) ? res.result : [];
    let processed = 0;
    for (const update of updates) {
      try {
        await processTelegramUpdate(db, update, log);
        processed += 1;
      } catch (error) {
        log.warn?.({ message: error?.message || String(error), updateId: update?.update_id }, 'telegram update processing failed');
      }
    }

    const nextOffset = updates.length ? updates[updates.length - 1].update_id + 1 : offset;
    await stateRef.set({
      lockUntil: 0,
      offset: nextOffset,
      lastPollAt: FieldValue.serverTimestamp(),
      lastError: null,
      ...(updates.length ? { lastUpdateAt: FieldValue.serverTimestamp(), processedTotal: FieldValue.increment(processed) } : {}),
    }, { merge: true });
    return { ok: true, received: updates.length, processed, tookMs: Date.now() - startedAt };
  } catch (error) {
    const errorText = String(error?.message || error).slice(0, 200);
    await stateRef.set({ lockUntil: 0, lastPollAt: FieldValue.serverTimestamp(), lastError: errorText }, { merge: true }).catch(() => {});
    return { ok: false, reason: errorText };
  }
}
