import { API_BASE_URL } from './constants.js';
import { auth } from './firebase.js';
import { getPwaVersion } from './pwa/PwaUpdateManager.js';
import {
  APG_EVENT_TYPES,
  emitAppActionEvent,
} from './intelligence/EventBus.js';
import { routeEventThroughPipeline, wireDefaultNotificationPipeline } from './intelligence/NotificationPipeline.js';

wireDefaultNotificationPipeline();

function safeValue(value, fallback = null) {
  if (value == null || value === '') return fallback;
  return value;
}

function toActionEntityType(action = '') {
  if (!action) return null;
  const [rawNamespace] = String(action).split(':', 2);
  if (!rawNamespace) return null;
  return rawNamespace
    .replace('profile', 'user')
    .replace('partner', 'partner')
    .replace('expert', 'expert')
    .replace('news', 'news')
    .replace('event', 'event')
    .replace('comment', 'comment')
    .replace('publicQr', 'qrcode')
    .replace('task', 'task')
    .replace('prize', 'reward')
    .replace('loki', 'system')
    .replace('raffle', 'reward')
    .replace('economy', 'user')
    .replace('guest', 'user')
    .replace('auth', 'user')
    .replace('identity', 'user')
    .replace('log', 'system')
    .replace('diagnostic', 'system');
}

function normalizeEventFromAction(action, payload = {}, result = {}) {
  const normalized = String(action || '').trim();
  const normalizedPayload = payload && typeof payload === 'object' ? { ...payload } : {};
  const actor = {
    id: safeValue(auth.currentUser?.id) || safeValue(auth.currentUser?.uid),
    source: safeValue(normalizedPayload.source) || 'web-app',
    platform: 'web-app',
  };
  const id = safeValue(normalizedPayload.id) || safeValue(normalizedPayload.userId) || safeValue(normalizedPayload.partnerId) || safeValue(normalizedPayload.expertId) || safeValue(normalizedPayload.newsId) || safeValue(normalizedPayload.eventId) || safeValue(normalizedPayload.qrId);
  const namespace = normalized.split(':', 1)[0] || '';
  const verb = normalized.split(':')[1] || '';
  let type = APG_EVENT_TYPES.APP_ACTION;

  if (namespace === 'partner') {
    if (/create|created|added/.test(verb)) type = APG_EVENT_TYPES.PARTNER_CREATED;
    else if (/update|updated|edit|changed|profileUpdate|aiDraft/.test(verb)) type = APG_EVENT_TYPES.PARTNER_UPDATED;
    else if (/delete|remove|archive|archived/.test(verb)) type = APG_EVENT_TYPES.PARTNER_DELETED;
    else type = APG_EVENT_TYPES.PARTNER_UPDATED;
  } else if (namespace === 'expert') {
    if (/create|created|added/.test(verb)) type = APG_EVENT_TYPES.EXPERT_CREATED;
    else if (/update|updated|edit|changed|profileUpdate/.test(verb)) type = APG_EVENT_TYPES.EXPERT_UPDATED;
    else if (/delete|remove|archive|archived/.test(verb)) type = APG_EVENT_TYPES.EXPERT_DELETED;
    else type = APG_EVENT_TYPES.EXPERT_UPDATED;
  } else if (namespace === 'news') {
    if (/publish|published|create|created/.test(verb)) type = APG_EVENT_TYPES.NEWS_PUBLISHED;
    else if (/archive|archived/.test(verb)) type = APG_EVENT_TYPES.NEWS_ARCHIVED;
    else if (/update|updated|edit|changed/.test(verb)) type = APG_EVENT_TYPES.NEWS_UPDATED;
    else if (/reaction|react|like/.test(verb) && (normalizedPayload.type === 'comment' || result?.comment)) type = APG_EVENT_TYPES.COMMENT_LIKED;
    else type = APG_EVENT_TYPES.APP_ACTION;
  } else if (namespace === 'event') {
    if (/created|create/.test(verb)) type = APG_EVENT_TYPES.EVENT_CREATED;
    else if (/publish|published/.test(verb)) type = APG_EVENT_TYPES.EVENT_PUBLISHED;
    else if (/archive|archived/.test(verb)) type = APG_EVENT_TYPES.EVENT_ARCHIVED;
    else if (/update|updated|edit|changed|toggle/.test(verb)) type = APG_EVENT_TYPES.EVENT_UPDATED;
    else type = APG_EVENT_TYPES.EVENT_UPDATED;
  } else if (namespace === 'comment') {
    if (/like/.test(verb)) type = APG_EVENT_TYPES.COMMENT_LIKED;
    else type = APG_EVENT_TYPES.COMMENT_CREATED;
  } else if (namespace === 'task') {
    if (/claim|complete/.test(verb)) {
      type = APG_EVENT_TYPES.TASK_CLAIMED;
      if (/completed/.test(verb)) type = APG_EVENT_TYPES.TASK_COMPLETED;
    }
  } else if (namespace === 'prize' || namespace === 'reward') {
    type = APG_EVENT_TYPES.REWARD_CLAIMED;
  } else if (namespace === 'auth') {
    if (/link|authorize|login|register/.test(verb)) {
      if (/register/.test(verb)) type = APG_EVENT_TYPES.USER_REGISTERED;
      else type = APG_EVENT_TYPES.USER_AUTHORIZED;
    }
  } else if (namespace === 'profile') {
    if (/acceptConsent/.test(verb) || /consent/.test(verb)) {
      type = APG_EVENT_TYPES.CONSENT_ACCEPTED;
    } else {
      type = APG_EVENT_TYPES.PROFILE_UPDATED;
    }
  } else if (namespace === 'publicQr' || namespace === 'qr') {
    type = APG_EVENT_TYPES.QR_SCANNED;
  } else if (normalized === 'reward:claim') {
    type = APG_EVENT_TYPES.REWARD_CLAIMED;
  } else if (normalized === 'raffle:enter') {
    type = APG_EVENT_TYPES.REFERRAL_REGISTERED;
    normalizedPayload.referralType = normalizedPayload.referralType || 'raffle_enter';
  } else if (normalized === 'task:claim') {
    type = APG_EVENT_TYPES.TASK_CLAIMED;
  }

  return {
    type,
    actor,
    entityType: toActionEntityType(normalized),
    entityId: id,
    payload: {
      action: normalized,
      ...normalizedPayload,
      eventResult: result,
    },
    source: safeValue(normalizedPayload.source) || 'web-app',
    platform: 'web-app',
  };
}

export async function userAction(action, payload = {}) {
  const current = auth.currentUser;
  if (!current) {
    const error = new Error('Требуется авторизация.');
    error.code = 'AUTH_REQUIRED';
    throw error;
  }
  const [token, version] = await Promise.all([current.getIdToken(), getPwaVersion()]);
  const response = await fetch(`${API_BASE_URL}/api/user-actions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Firebase-Auth': token,
      'X-APG-Version': version,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.error || 'Не удалось выполнить действие.');
    error.code = data.code;
    error.status = response.status;
    if (response.status === 401 || response.status === 403) error.isAuthError = true;
    throw error;
  }

  try {
    const eventPayload = normalizeEventFromAction(action, payload, data);
    const event = emitAppActionEvent(eventPayload);
    await routeEventThroughPipeline(event, { action, payload, result: data, type: 'userAction' }).catch(() => {});
  } catch {
    // eventing is non-blocking for compatibility
  }

  return data;
}
