import { APP_URL } from './config.js';
import { FieldValue } from './documentValues.js';
import { telegramUrl } from '../../../server-shared/telegram.js';
import { ECONOMY_VERSION, getEconomyReward, getReputationStatus } from '../../../server-shared/economy-engine.js';
import { REFERRAL_EVENT_TYPES } from '../../../server-shared/referral-observability.js';
import { serverFoundation } from '../apg/index.js';
import { completeReferralSessionAsync, resolveReferralSessionReferrer } from './referralSessions.js';
import { recordReferralEventAsync } from './referralEvents.js';
import { fetchAndStoreTelegramAvatar } from './telegramAvatar.js';

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
const TELEGRAM_FETCH_TIMEOUT_MS = 3500;
const TELEGRAM_POLL_TIMEOUT_MS = 7000;
const TELEGRAM_POLL_ATTEMPTS = 3;

function safeDebugString(value, max = 280) {
  return String(value ?? '').trim().slice(0, max);
}

function safeDebugPayload(value) {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return safeDebugString(JSON.stringify(value), 280);
}

async function appendTelegramTimeline(ref, entry = {}, log = console) {
  if (!ref) return;
  try {
    await ref.set({
      timeline: FieldValue.arrayUnion({
        at: new Date().toISOString(),
        ...entry,
      }),
      lastTimelineAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    log.warn?.({ message: error?.message || String(error) }, 'telegram timeline update failed');
  }
}

async function telegramFetch(url, options = {}, stage = 'telegram_api', timeoutMs = TELEGRAM_FETCH_TIMEOUT_MS) {
  try {
    return await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const diagnostics = new Error(`${stage}:${error?.name === 'TimeoutError' ? 'timeout' : 'fetch_failed'}`);
    diagnostics.cause = error;
    diagnostics.code = error?.name === 'TimeoutError' ? 'TELEGRAM_API_TIMEOUT' : 'TELEGRAM_API_FETCH_FAILED';
    throw diagnostics;
  }
}

async function telegramPollFetch(url, options = {}, log = console) {
  let lastError = null;
  for (let attempt = 1; attempt <= TELEGRAM_POLL_ATTEMPTS; attempt += 1) {
    try {
      return await telegramFetch(url, options, 'get_updates', TELEGRAM_POLL_TIMEOUT_MS);
    } catch (error) {
      lastError = error;
      log.warn?.({
        stage: 'telegram_poll_fetch_retry',
        attempt,
        attempts: TELEGRAM_POLL_ATTEMPTS,
        error: safeDebugString(error?.message, 160),
        errorCode: safeDebugString(error?.code || error?.cause?.code, 120) || null,
      }, 'telegram-poll-forensic');
      if (attempt < TELEGRAM_POLL_ATTEMPTS) await new Promise(resolve => setTimeout(resolve, attempt * 200));
    }
  }
  throw lastError;
}

async function tgSend(chatId, text, extra = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  return telegramFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, ...extra }),
  }, 'send_message').catch(() => {});
}

async function tgGetPhotoUrl(userId) {
  try {
    return await fetchAndStoreTelegramAvatar(userId, `tg_${userId}`);
  } catch {
    return null;
  }
}

async function resolveTelegramLinkOwner(ownerUserId) {
  const rawOwnerUserId = String(ownerUserId || '').trim();
  if (!rawOwnerUserId) return '';

  const asIdentity = await serverFoundation.identityV2.getUser(rawOwnerUserId).catch(() => null);
  return asIdentity?.id || '';
}

function canAttachReferral(referrerId, userId) {
  return !!referrerId && !!userId && referrerId !== userId && !referrerId.startsWith('guest_') && !userId.startsWith('guest_');
}

function buildTelegramProfilePayload(from = {}, photoUrl = '') {
  const avatar = safeDebugString(photoUrl, 1000);
  const payload = {
    firstName: from.first_name ?? null,
    lastName: from.last_name ?? null,
    username: from.username ?? null,
  };
  if (avatar) {
    payload.photo = avatar;
    payload.photo_200 = avatar;
    payload.photoUrl = avatar;
  }
  return payload;
}

async function syncTelegramAvatarToCanonicalProfile(db, userId, from = {}, photoUrl = '', log = console) {
  const avatar = safeDebugString(photoUrl, 1000);
  const canonicalUserId = safeDebugString(userId, 260);
  if (!db || !canonicalUserId || !avatar) return false;
  try {
    await db.collection('users').doc(canonicalUserId).set({
      photo: avatar,
      linkedTelegram: {
        tgId: String(from.id || ''),
        telegramId: String(from.id || ''),
        ...buildTelegramProfilePayload(from, avatar),
        linkedAt: new Date().toISOString(),
      },
      lastSeen: FieldValue.serverTimestamp(),
    }, { merge: true });
    return true;
  } catch (error) {
    log.warn?.({
      userId: canonicalUserId,
      telegramId: safeDebugString(from.id, 120),
      message: error?.message || String(error),
    }, 'telegram avatar canonical profile sync failed');
    return false;
  }
}

async function upsertUser(db, from, photoUrl, referral = {}) {
  const uid      = `tg_${from.id}`;
  const userRef  = db.collection('users').doc(uid);
  const profilePatch = {
    authProvider: 'telegram',
    displayName: [from.first_name, from.last_name].filter(Boolean).join(' ') || null,
    firstName: from.first_name ?? null,
    lastName:  from.last_name  ?? null,
    username: from.username ?? null,
    photo:     photoUrl ?? null,
    lastSeen:  FieldValue.serverTimestamp(),
  };
  const referrerId = String(referral.referrerId || '').trim();
  const referralSessionId = String(referral.referralSessionId || '').trim();
  const referralFlowId = String(referral.referralFlowId || '').trim();
  const referralReward = getEconomyReward('referral');
  await db.runTransaction(async tx => {
    const [userSnap, referrerSnap] = await Promise.all([
      tx.get(userRef),
      canAttachReferral(referrerId, uid) ? tx.get(db.collection('users').doc(referrerId)) : Promise.resolve(null),
    ]);
    const before = userSnap.data() || {};
    const referrerData = referrerSnap?.exists ? (referrerSnap.data() || {}) : {};
    const rewardedUsers = Array.isArray(referrerData.referralRewardedUsers) ? referrerData.referralRewardedUsers.map(String) : [];
    const canReward = canAttachReferral(referrerId, uid)
      && !!referrerSnap?.exists
      && !before.referredBy
      && before.referralBonusGranted !== true
      && !rewardedUsers.includes(uid);
    const baseReputation = canReward ? referralReward.reputation : 0;
    const baseStatus = getReputationStatus(baseReputation);
    const base = userSnap.exists ? profilePatch : {
      keys: canReward ? referralReward.keys : 0,
      reputation: baseReputation,
      reputationStatus: baseStatus.id,
      reputationStatusLabel: baseStatus.label,
      economyVersion: ECONOMY_VERSION,
      favorites: [],
      scannedPartners: {},
      completedTasks: [],
      streak: 0,
      onboardingDone: false,
      scanDates: [],
      lastBonusDate: new Date().toLocaleDateString('sv'),
      referredBy: canReward ? referrerId : null,
      referralBonusGranted: canReward,
      referralBonusGrantedTo: canReward ? referrerId : null,
      referralBonusGrantedAt: canReward ? FieldValue.serverTimestamp() : null,
      referralSessionId: referralSessionId || null,
      referralFlowId: referralFlowId || null,
      registeredAt: FieldValue.serverTimestamp(),
      ...profilePatch,
    };
    const patch = userSnap.exists ? {
      ...profilePatch,
      ...(referralSessionId ? { referralSessionId } : {}),
      ...(referralFlowId ? { referralFlowId } : {}),
      ...(canReward ? {
        referredBy: referrerId,
        referralBonusGranted: true,
        referralBonusGrantedTo: referrerId,
        referralBonusGrantedAt: FieldValue.serverTimestamp(),
        keys: FieldValue.increment(referralReward.keys),
        reputation: FieldValue.increment(referralReward.reputation),
        economyVersion: ECONOMY_VERSION,
      } : {}),
    } : base;
    tx.set(userRef, patch, { merge: true });
    if (!userSnap.exists) tx.set(db.collection('stats').doc('global'), { userCount: FieldValue.increment(1) }, { merge: true });
    if (canReward) {
      tx.set(db.collection('users').doc(referrerId), {
        keys: FieldValue.increment(referralReward.keys),
        reputation: FieldValue.increment(referralReward.reputation),
        economyVersion: ECONOMY_VERSION,
        referralCount: FieldValue.increment(1),
        referralRewardedUsers: FieldValue.arrayUnion(uid),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  });
  if (referrerId) {
    recordReferralEventAsync(db, {
      referralFlowId,
      sessionId: referralSessionId,
      referrerId,
      referralCode: referrerId,
      referredUserId: uid,
      type: REFERRAL_EVENT_TYPES.SESSION_ATTACHED,
      status: 'completed',
      source: 'telegram-bot',
    });
  }
}

export async function processTelegramUpdate(db, update, log = console) {
  const message = update?.message;
  if (!message?.text) return { handled: false };

  const from = message.from;
  const text = message.text.trim();
  const messageId = safeDebugString(update?.update_id, 120);
  const chatId = safeDebugString(from?.id, 120);
  log.info?.({
    messageId,
    chatId,
    from: safeDebugPayload(from),
    text: safeDebugString(text, 120),
  }, 'telegram-update-received');

  const authMatch = text.match(/^\/start auth_([a-f0-9]{32})$/);
  if (authMatch) {
    const state = authMatch[1];
    const ref   = db.collection('telegramAuthSessions').doc(state);
    const snap  = await ref.get();
    const session = snap.data() || {};
    const requestId = safeDebugString(session.requestId, 220);
    const loginSessionId = safeDebugString(session.loginSessionId, 220);
    if (snap.exists) {
      await appendTelegramTimeline(ref, {
        stage: 'telegram_auth_update_received',
        messageId,
        chatId,
        state,
        requestId,
        loginSessionId,
        telegramSessionId: state,
        text: safeDebugString(text, 120),
      }, log);
    } else {
      log.warn?.(
        {
          stage: 'telegram_auth_update_received_unknown_state',
          messageId,
          chatId,
          state,
          requestId,
          loginSessionId,
          text: safeDebugString(text, 120),
        },
        'telegram-auth-update-received'
      );
    }

    if (!snap.exists || session.status !== 'pending') {
      await appendTelegramTimeline(ref, {
        stage: 'telegram_auth_stale',
        state,
        requestId,
        loginSessionId,
        telegramSessionId: state,
        reason: snap.exists ? 'not_pending' : 'missing',
      }, log);
      tgSend(from.id, '⚠️ Ссылка устарела или уже использована. Вернитесь в приложение и нажмите кнопку снова.');
      return { handled: true, kind: 'auth_stale' };
    }

    const expiresAt = session.expiresAt;
    const expired   = (expiresAt?.toDate ? expiresAt.toDate() : new Date(expiresAt)) < new Date();
    if (expired) {
      await appendTelegramTimeline(ref, {
        stage: 'telegram_auth_expired',
        state,
        requestId,
        loginSessionId,
        telegramSessionId: state,
        expiresAt: safeDebugString(String(session.expiresAt || ''), 120),
      }, log);
      await ref.update({ status: 'expired' });
      tgSend(from.id, '⚠️ Ссылка устарела. Вернитесь в приложение и нажмите кнопку снова.');
      return { handled: true, kind: 'auth_expired' };
    }

    const tgId = `tg_${from.id}`;
    if (session.linking === true) {
      const ownerUserId = String(session.ownerUserId || '').trim();
      let linkError = '';
      let linkedOwnerId = ownerUserId || null;
      let linkedPhotoUrl = null;

      const resolvedOwnerUserId = await resolveTelegramLinkOwner(ownerUserId);
      if (!resolvedOwnerUserId) {
        linkError = 'owner_not_found';
      } else {
        linkedOwnerId = resolvedOwnerUserId;
        try {
          const telegramLinkParams = {
            telegramId: String(from.id),
            userId: resolvedOwnerUserId,
            telegram: buildTelegramProfilePayload(from),
          };
          log.info?.({
            state,
            requestId,
            loginSessionId,
            telegramSessionId: state,
            stage: 'identityV2.linkTelegram.enter',
            payload: {
              telegramId: telegramLinkParams.telegramId,
              userId: telegramLinkParams.userId,
            },
          }, 'telegram-update-linking-forensic');
          const linkResult = await serverFoundation.identityV2.linkTelegram(telegramLinkParams);
          log.info?.({
            state,
            requestId,
            loginSessionId,
            telegramSessionId: state,
            stage: 'identityV2.linkTelegram.return',
            returnValue: safeDebugString(
              linkResult === undefined ? 'undefined' : JSON.stringify(linkResult),
              360,
            ),
          }, 'telegram-update-linking-forensic');
        } catch (error) {
          log.warn?.({
            state,
            requestId,
            loginSessionId,
            telegramSessionId: state,
            stage: 'identityV2.linkTelegram.throw',
            code: error?.code || null,
            message: safeDebugString(error?.message, 220),
            stack: error?.stack ? String(error.stack).slice(0, 300) : null,
          }, 'telegram-update-linking-forensic');
          linkError = error?.code === 'TELEGRAM_ALREADY_USED'
            ? 'already_linked'
            : 'link_failed';
        }
      }
      await appendTelegramTimeline(ref, {
        stage: 'telegram_auth_link_validation',
        state,
        requestId,
        loginSessionId,
        telegramSessionId: state,
        ownerUserId,
        linkError: linkError || null,
        linkedOwnerId: linkedOwnerId || null,
      }, log);
      await ref.update({
        status: 'done',
        linking: true,
        linkError: linkError || null,
        linkedOwnerId,
        tgUserId: String(from.id),
        firstName: from.first_name ?? '',
        lastName: from.last_name ?? '',
        username: from.username ?? '',
        photoUrl: linkedPhotoUrl || null,
        photo_200: linkedPhotoUrl || null,
        completedAt: FieldValue.serverTimestamp(),
      });
      if (!linkError && resolvedOwnerUserId) {
        Promise.resolve()
          .then(() => tgGetPhotoUrl(from.id))
          .then(async photoUrl => {
            if (!photoUrl) return;
            await serverFoundation.identityV2.linkTelegram({
              telegramId: String(from.id),
              userId: resolvedOwnerUserId,
              telegram: buildTelegramProfilePayload(from, photoUrl),
            });
            await syncTelegramAvatarToCanonicalProfile(db, resolvedOwnerUserId, from, photoUrl, log);
            await ref.set({ photoUrl, photo_200: photoUrl }, { merge: true });
          })
          .catch(error => log.warn?.({
            state,
            requestId,
            stage: 'telegram_avatar_sync_after_done',
            code: error?.code || null,
            message: safeDebugString(error?.message, 220),
          }, 'telegram-update-linking-forensic'));
      }
      tgSend(from.id,
        linkError
          ? '⚠️ Не удалось подключить Telegram. Вернитесь в приложение — там показана причина.'
          : '✅ Telegram подтверждён. Вернитесь в приложение АПГ — привязка завершится автоматически.',
        { reply_markup: SOCIAL_KEYBOARD },
      );
      await appendTelegramTimeline(ref, {
        stage: 'telegram_auth_link_done',
        state,
        requestId,
        loginSessionId,
        telegramSessionId: state,
        linkError: linkError || null,
        linkedOwnerId: linkedOwnerId || null,
        linkUserId: resolvedOwnerUserId || null,
      }, log);
      return { handled: true, kind: 'auth_link' };
    }

    const referralSessionId = String(session.referralSessionId || '').trim();
    const sessionResolution = referralSessionId
      ? await resolveReferralSessionReferrer(db, referralSessionId, { markMissing: true, source: 'telegram-bot', userId: tgId })
      : { referrerId: String(session.referrerId || '').trim(), session: null };
    const resolvedReferrerId = sessionResolution.referrerId || String(session.referrerId || '').trim();
    await appendTelegramTimeline(ref, {
      stage: 'telegram_auth_resolve_referral',
      state,
      requestId,
      loginSessionId,
      telegramSessionId: state,
      referralSessionId: safeDebugString(referralSessionId, 200),
      resolvedReferrerId: safeDebugString(resolvedReferrerId, 200),
    }, log);
    await ref.update({
      status:    'done',
      tgUserId:  String(from.id),
      firstName: from.first_name ?? '',
      lastName:  from.last_name  ?? '',
      username:  from.username   ?? '',
      photoUrl:  null,
      photo_200: null,
      completedAt: FieldValue.serverTimestamp(),
      referrerId: resolvedReferrerId || null,
      referralSessionId: referralSessionId || null,
      referralCompletedAt: resolvedReferrerId ? FieldValue.serverTimestamp() : null,
    });
    if (resolvedReferrerId) {
      await appendTelegramTimeline(ref, {
        stage: 'telegram_auth_referral_recorded',
        state,
        requestId,
        loginSessionId,
        telegramSessionId: state,
        referrerId: safeDebugString(resolvedReferrerId, 200),
        referralSessionId: safeDebugString(referralSessionId, 200),
      }, log);
    }

    Promise.resolve()
      .then(() => tgGetPhotoUrl(from.id))
      .then(async resolvedPhotoUrl => {
        if (resolvedPhotoUrl) await ref.set({ photoUrl: resolvedPhotoUrl, photo_200: resolvedPhotoUrl }, { merge: true });
        return upsertUser(db, from, resolvedPhotoUrl, {
        referrerId: resolvedReferrerId,
        referralSessionId,
        referralFlowId: session.referralFlowId || sessionResolution.session?.data?.flowId || '',
        });
      })
      .then(() => {
        if (referralSessionId) completeReferralSessionAsync(db, referralSessionId, { userId: tgId, authType: 'telegram', source: 'telegram-bot' });
        if (resolvedReferrerId) {
          recordReferralEventAsync(db, {
            referralFlowId: session.referralFlowId || '',
            sessionId: referralSessionId,
            referrerId: resolvedReferrerId,
            referralCode: resolvedReferrerId,
            referredUserId: tgId,
            type: REFERRAL_EVENT_TYPES.SESSION_TELEGRAM_LINKED,
            status: 'completed',
            source: 'telegram-bot',
          });
        }
      })
      .catch(error => log.warn?.({ message: error?.message || String(error) }, 'telegram profile background update failed'));
    await appendTelegramTimeline(ref, {
      stage: 'telegram_auth_done',
      state,
      requestId,
      loginSessionId,
      telegramSessionId: state,
      resolvedReferrerId: safeDebugString(resolvedReferrerId, 200),
    }, log);
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
  log.info?.({
    stage: 'telegram_poll_start',
    startedAt: new Date(startedAt).toISOString(),
    lockWindowMs: POLL_LOCK_MS,
  }, 'telegram-poll-forensic');

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
    const res = await telegramPollFetch(`https://api.telegram.org/bot${token}/getUpdates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(offset ? { offset } : {}),
        timeout: 0,
        limit: 50,
        allowed_updates: ['message'],
      }),
    }, log).then(r => r.json());

    if (!res.ok) {
      const errorText = `${res.error_code || ''} ${res.description || 'getUpdates failed'}`.trim().slice(0, 200);
      await stateRef.set({ lockUntil: 0, lastPollAt: FieldValue.serverTimestamp(), lastError: errorText }, { merge: true }).catch(() => {});
      return { ok: false, reason: errorText, conflict: res.error_code === 409 };
    }

    const updates = Array.isArray(res.result) ? res.result : [];
    log.info?.({
      stage: 'telegram_poll_response',
      offset,
      incoming: updates.length,
      got: Array.isArray(res.result) ? res.result.length : 0,
    }, 'telegram-poll-forensic');

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
    const errorCode = safeDebugString(error?.code || error?.cause?.code || error?.cause?.cause?.code, 120) || null;
    log.warn?.({
      stage: 'telegram_poll_fetch_failed',
      error: errorText,
      errorCode,
      cause: safeDebugString(error?.cause?.message || error?.cause?.cause?.message, 200) || null,
    }, 'telegram-poll-forensic');
    await stateRef.set({ lockUntil: 0, lastPollAt: FieldValue.serverTimestamp(), lastError: errorText, lastErrorCode: errorCode }, { merge: true }).catch(() => {});
    return { ok: false, reason: errorText, errorCode };
  }
}
