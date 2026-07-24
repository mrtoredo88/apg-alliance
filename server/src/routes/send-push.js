import { APP_URL } from '../lib/config.js';
import { getDb } from '../lib/firebase.js';
import { FieldValue } from '../lib/documentValues.js';
import webpush from 'web-push';
import { requireAdminPermission, writeAuditLog } from '../lib/adminSecurity.js';

const DEFAULT_CATEGORIES = {
  news: true,
  events: true,
  partners: true,
  experts: true,
  messages: true,
  raffles: true,
  prizes: true,
  offers: true,
  reminders: true,
  loki: true,
  achievements: true,
  keys: true,
  invites: true,
  updates: true,
  important: true,
};

function boolPref(prefs, key) {
  if (prefs?.onlyCritical) return key === 'critical' || key === 'important';
  if (!key || key === 'all') return true;
  if (!prefs || prefs[key] === undefined) return true;
  return prefs[key] !== false;
}

function asMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function userMatchesAudience(data = {}, audience = {}) {
  const type = audience.type || 'all';
  if (type === 'new') return Date.now() - asMillis(data.createdAt || data.registeredAt) <= 14 * 86400000;
  if (type === 'active') return asMillis(data.lastSeen || data.updatedAt || data.lastLoginAt) >= Date.now() - 30 * 86400000;
  if (type === 'inactive') return asMillis(data.lastSeen || data.updatedAt || data.lastLoginAt) < Date.now() - Number(audience.inactiveDays || 14) * 86400000;
  if (type === 'partners') return data.role === 'partner' || data.ownerPartnerId || data.partnerId;
  if (type === 'experts') return data.role === 'expert' || data.ownerExpertId || data.expertId;
  if (type === 'admins') return ['owner', 'admin', 'moderator', 'editor'].includes(String(data.role || data.userRole || '').toLowerCase());
  if (type === 'city') return !audience.city || String(data.city || '').toLowerCase() === String(audience.city).toLowerCase();
  if (type === 'min_keys') return Number(data.keys || 0) >= Number(audience.value || 0);
  if (type === 'max_keys') return Number(data.keys || 0) < Number(audience.value || 0);
  return true;
}

function initWebPush() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return { ok: false, error: 'WEB_PUSH_VAPID_ENV_MISSING' };
  webpush.setVapidDetails(process.env.WEB_PUSH_VAPID_SUBJECT || `mailto:support@${new URL(APP_URL).hostname}`, publicKey, privateKey);
  return { ok: true };
}

// у web-push нет таймаута: зависший push-endpoint блокирует запрос до 30с лимита контейнера
export const WEB_PUSH_SEND_TIMEOUT_MS = 10000;

export function withPushTimeout(promise, ms = WEB_PUSH_SEND_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('push endpoint timed out'), { statusCode: 0, code: 'push/timeout' })), ms)),
  ]);
}

async function sendToFcmTokens(tokens, userIds, title, body, url, tag, options = {}) {
  return { sent: 0, failed: 0, cleaned: 0, skipped: tokens.length, errors: [] };
}

function buildPayload(title, body, url, tag, options = {}) {
  return JSON.stringify({
    notification: {
      title,
      body: body ?? '',
      icon: `${APP_URL}/192.png`,
      badge: `${APP_URL}/32.png`,
      image: options.imageUrl || undefined,
      tag: tag ?? 'apg-push',
    },
    data: {
      title,
      body: body ?? '',
      url: url ?? APP_URL,
      tag: tag ?? 'apg-push',
      notificationId: options.notificationId ?? '',
      category: options.category ?? 'important',
      type: options.type ?? 'info',
      priority: options.priority ?? 'normal',
    },
  });
}

function normalizeSubscription(input) {
  const endpoint = String(input?.endpoint || '').trim();
  const p256dh = String(input?.keys?.p256dh || '').trim();
  const auth = String(input?.keys?.auth || '').trim();
  if (!endpoint || !p256dh || !auth) return null;
  return { endpoint, expirationTime: input.expirationTime || null, keys: { p256dh, auth } };
}

async function sendToWebPushSubscriptions(subscriptions, userIds, title, body, url, tag, options = {}) {
  const normalized = subscriptions.map(normalizeSubscription);
  const pairs = normalized.map((subscription, index) => ({ subscription, userId: userIds[index] })).filter(x => x.subscription);
  if (!pairs.length) return { sent: 0, failed: 0, cleaned: 0, errors: [] };

  const vapid = initWebPush();
  if (!vapid.ok) {
    return { sent: 0, failed: pairs.length, cleaned: 0, errors: [{ code: vapid.error, message: 'Native Web Push VAPID keys are not configured' }] };
  }

  const payload = buildPayload(title, body, url, tag, options);
  let sent = 0;
  let failed = 0;
  const deadByUser = {};
  const errors = [];

  await Promise.all(pairs.map(async ({ subscription, userId }) => {
    try {
      await withPushTimeout(webpush.sendNotification(subscription, payload, {
        TTL: options.priority === 'critical' ? 86400 : 21600,
        urgency: options.priority === 'critical' ? 'high' : 'normal',
      }));
      sent += 1;
    } catch (e) {
      failed += 1;
      const code = e.code === 'push/timeout' ? 'webpush/timeout' : e.statusCode ? `webpush/${e.statusCode}` : 'webpush/error';
      errors.push({ code, message: String(e.body || e.message || '').slice(0, 300) });
      // 400/403 are returned by push services for subscriptions created with
      // an obsolete VAPID key as well as malformed/expired subscriptions.
      // Keeping them guarantees that every later broadcast fails again.
      if ([400, 403, 404, 410].includes(e.statusCode)) {
        deadByUser[userId] ??= [];
        deadByUser[userId].push(subscription);
      }
    }
  }));

  await Promise.all(
    Object.entries(deadByUser).map(([uid, dead]) =>
      getDb().collection('users').doc(uid).update({
        webPushSubscriptions: FieldValue.arrayRemove(...dead),
      }).catch(() => {})
    )
  );

  return { sent, failed, cleaned: Object.values(deadByUser).flat().length, errors: errors.slice(0, 12) };
}

function mergeStats(nativeStats, fcmStats, subscribers) {
  return {
    subscribers,
    sent: Number(nativeStats.sent || 0) + Number(fcmStats.sent || 0),
    failed: Number(nativeStats.failed || 0) + Number(fcmStats.failed || 0),
    cleaned: Number(nativeStats.cleaned || 0) + Number(fcmStats.cleaned || 0),
    native: nativeStats,
    fcm: fcmStats,
    errors: [...(nativeStats.errors || []), ...(fcmStats.errors || [])].slice(0, 20),
  };
}

function vkNotificationToken() {
  return process.env.VK_SERVICE_TOKEN || process.env.VK_GROUP_TOKEN || process.env.VK_USER_TOKEN || '';
}

function vkRecipientId(documentId, data = {}) {
  const candidate = data.vkUserId || data.vkId || data.linkedVk?.id || (data.notificationProvider === 'vk' ? documentId : '');
  const value = String(candidate || '').replace(/^vk[_:-]?/i, '').trim();
  return /^\d+$/.test(value) ? value : '';
}

async function sendToVkUsers(userIds, title, body, url) {
  if (!userIds.length) return { sent: 0, failed: 0, errors: [] };
  const token = vkNotificationToken();
  if (!token) {
    return {
      sent: 0,
      failed: userIds.length,
      errors: [{ code: 'vk/token_missing', message: 'VK notification token is not configured' }],
    };
  }

  let sent = 0;
  let failed = 0;
  const errors = [];
  const message = String([title, body].filter(Boolean).join('\n')).slice(0, 254);
  const fragment = (() => {
    try { return new URL(url || APP_URL).pathname.replace(/^\//, ''); } catch { return ''; }
  })();

  for (let i = 0; i < userIds.length; i += 100) {
    const batch = userIds.slice(i, i + 100);
    try {
      const params = new URLSearchParams({
        access_token: token,
        v: process.env.VK_API_VERSION || '5.199',
        user_ids: batch.join(','),
        message,
        ...(fragment ? { fragment } : {}),
      });
      const response = await withPushTimeout(fetch('https://api.vk.com/method/notifications.sendMessage', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: params,
      }), 15000);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.error) {
        failed += batch.length;
        errors.push({
          code: `vk/${payload.error?.error_code || response.status || 'error'}`,
          message: String(payload.error?.error_msg || response.statusText || 'VK notification failed').slice(0, 300),
        });
        continue;
      }
      const delivered = Array.isArray(payload.response)
        ? payload.response.filter(item => item?.status !== false && item?.status !== 0).length
        : batch.length;
      sent += delivered;
      failed += Math.max(batch.length - delivered, 0);
    } catch (error) {
      failed += batch.length;
      errors.push({
        code: error?.code === 'push/timeout' ? 'vk/timeout' : 'vk/error',
        message: String(error?.message || error).slice(0, 300),
      });
    }
  }
  return { sent, failed, errors: errors.slice(0, 12) };
}

export async function sendBroadcastPush({
  db = getDb(),
  title,
  body = '',
  url,
  tag,
  notificationId,
  category = 'important',
  type = 'info',
  priority = 'normal',
  imageUrl,
  actionLabel,
  audience = {},
  logger,
}) {
  if (!title) throw Object.assign(new Error('title required'), { statusCode: 400 });
  const snap = await db.collection('users').get();
  const tokens = [];
  const tokenUserIds = [];
  const subscriptions = [];
  const subscriptionUserIds = [];
  const vkUserIds = [];
  const skippedReasons = {
    noConsent: 0,
    vkProvider: 0,
    categoryOptOut: 0,
    audienceMismatch: 0,
    noSubscription: 0,
  };
  let reachedUsers = 0;

  snap.docs.forEach(d => {
    const data = d.data() || {};
    const prefs = data.notificationPreferences || DEFAULT_CATEGORIES;
    const hasConsent = data.notificationsEnabled === true || data.notificationConsent === true;
    if (!hasConsent) { skippedReasons.noConsent += 1; return; }
    if (!boolPref(prefs, category)) { skippedReasons.categoryOptOut += 1; return; }
    if (!userMatchesAudience(data, audience)) { skippedReasons.audienceMismatch += 1; return; }
    if (data.notificationProvider === 'vk') {
      const vkUserId = vkRecipientId(d.id, data);
      if (!vkUserId) { skippedReasons.vkProvider += 1; return; }
      vkUserIds.push(vkUserId);
      reachedUsers += 1;
      return;
    }
    if (data.notificationProvider && data.notificationProvider !== 'webpush') { skippedReasons.noSubscription += 1; return; }
    const fcmTokens = [];
    const webPushSubs = Array.isArray(data.webPushSubscriptions) ? data.webPushSubscriptions : [];
    if (!fcmTokens.length && !webPushSubs.length) { skippedReasons.noSubscription += 1; return; }
    reachedUsers += 1;
    fcmTokens.forEach(token => {
      tokens.push(token);
      tokenUserIds.push(d.id);
    });
    webPushSubs.forEach(subscription => {
      subscriptions.push(subscription);
      subscriptionUserIds.push(d.id);
    });
  });

  const audienceSummary = { totalUsers: snap.size, reachedUsers, skippedReasons };
  let total;
  if (!tokens.length && !subscriptions.length && !vkUserIds.length) {
    total = {
      skipped: true,
      reason: 'no matching webpush subscribers',
      subscribers: 0,
      sent: 0,
      failed: 0,
      cleaned: 0,
      ...audienceSummary,
    };
  } else {
    const fcmTotal = { sent: 0, failed: 0, cleaned: 0, errors: [] };
    for (let i = 0; i < tokens.length; i += 500) {
      const stats = await sendToFcmTokens(
        tokens.slice(i, i + 500),
        tokenUserIds.slice(i, i + 500),
        title,
        body,
        url,
        tag,
        { notificationId, category, type, priority, imageUrl, actionLabel },
      );
      fcmTotal.sent += stats.sent;
      fcmTotal.failed += stats.failed;
      fcmTotal.cleaned += stats.cleaned;
      fcmTotal.errors = [...fcmTotal.errors, ...(stats.errors || [])].slice(0, 20);
    }
    const nativeTotal = await sendToWebPushSubscriptions(
      subscriptions,
      subscriptionUserIds,
      title,
      body,
      url,
      tag,
      { notificationId, category, type, priority, imageUrl, actionLabel },
    );
    const vkTotal = await sendToVkUsers(vkUserIds, title, body, url);
    const webTotal = mergeStats(nativeTotal, fcmTotal, subscriptions.length + tokens.length);
    total = {
      ...webTotal,
      subscribers: webTotal.subscribers + vkUserIds.length,
      sent: webTotal.sent + vkTotal.sent,
      failed: webTotal.failed + vkTotal.failed,
      errors: [...(webTotal.errors || []), ...(vkTotal.errors || [])].slice(0, 20),
      vk: vkTotal,
      ...audienceSummary,
    };
  }

  const logEntry = {
    title,
    body,
    category,
    priority,
    audience,
    notificationId: notificationId || null,
    source: 'server-notification-pipeline',
    ...audienceSummary,
    subscribers: total.subscribers || 0,
    sent: total.sent || 0,
    failed: total.failed || 0,
    cleaned: total.cleaned || 0,
    errors: total.errors || [],
    skipped: total.skipped === true,
    createdAt: FieldValue.serverTimestamp(),
  };
  logger?.info?.({ push: { title, category, ...audienceSummary, sent: total.sent, failed: total.failed } }, 'push broadcast result');
  await db.collection('pushLogs').add(logEntry).catch(() => {});
  if (notificationId) {
    await db.collection('notifications').doc(String(notificationId)).set({
      pushStatus: total.skipped ? 'skipped' : total.failed ? 'partial' : 'sent',
      pushStats: total,
      pushSentAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true }).catch(() => {});
  }
  return total;
}

export default async function sendPushRoutes(fastify) {
  fastify.post('/api/send-push', async (request, reply) => {
    const secret = request.headers['x-push-secret'];
    const valid  = (secret && secret === process.env.PUSH_SECRET) ||
                   (secret && secret === process.env.RAFFLE_SECRET);
    let actor = null;
    if (!valid) {
      try {
        actor = await requireAdminPermission(request, 'push:*');
      } catch {
        return reply.code(401).send({ error: 'unauthorized' });
      }
    }

    const { userId, broadcast, title, body, url, tag, notificationId, category = 'important', type = 'info', priority = 'normal', imageUrl, actionLabel, audience = {} } = request.body ?? {};
    if (!title) return reply.code(400).send({ error: 'title required' });

    const db = getDb();

    try {
      if (userId && !broadcast) {
        const snap = await db.collection('users').doc(String(userId)).get();
        if (!snap.exists) return reply.code(404).send({ error: 'user not found' });
        const userData = snap.data() || {};
        const { webPushSubscriptions = [] } = userData;
        const fcmTokens = [];
        const hasConsent = userData.notificationsEnabled === true || userData.notificationConsent === true;
        if (!hasConsent) return { skipped: true, reason: 'notifications_disabled', subscribers: 0, sent: 0, failed: 0 };
        if (!boolPref(userData.notificationPreferences || DEFAULT_CATEGORIES, category)) {
          return { skipped: true, reason: 'category_disabled', subscribers: 0, sent: 0, failed: 0 };
        }
        if (userData.notificationProvider === 'vk') {
          const vkUserId = vkRecipientId(snap.id, userData);
          const stats = await sendToVkUsers(vkUserId ? [vkUserId] : [], title, body, url);
          if (notificationId) await db.collection('notifications').doc(String(notificationId)).set({
            pushStatus: stats.failed ? 'partial' : stats.sent ? 'sent' : 'skipped',
            pushStats: { ...stats, subscribers: vkUserId ? 1 : 0 },
            pushSentAt: FieldValue.serverTimestamp(),
          }, { merge: true }).catch(() => {});
          return { ...stats, subscribers: vkUserId ? 1 : 0 };
        }
        if (!fcmTokens.length && !webPushSubscriptions.length) return { skipped: true, reason: 'no push subscriptions', subscribers: 0, sent: 0, failed: 0 };

        const nativeStats = await sendToWebPushSubscriptions(
          webPushSubscriptions, webPushSubscriptions.map(() => String(userId)),
          title, body, url, tag,
          { notificationId, category, type, priority, imageUrl, actionLabel },
        );
        const fcmStats = await sendToFcmTokens(
          fcmTokens, fcmTokens.map(() => String(userId)),
          title, body, url, tag,
          { notificationId, category, type, priority, imageUrl, actionLabel },
        );
        const stats = mergeStats(nativeStats, fcmStats, webPushSubscriptions.length + fcmTokens.length);
        if (notificationId) await db.collection('notifications').doc(String(notificationId)).set({
          pushStatus: stats.failed ? 'partial' : 'sent',
          pushStats: stats,
          pushSentAt: FieldValue.serverTimestamp(),
        }, { merge: true }).catch(() => {});
        if (actor) await writeAuditLog(db, request, actor, 'push:send', 'user', userId, { label: `Push пользователю: ${title}`, sent: stats.sent, failed: stats.failed });
        return stats;
      }

      if (broadcast) {
        const total = await sendBroadcastPush({
          db,
          title,
          body,
          url,
          tag,
          notificationId,
          category,
          type,
          priority,
          imageUrl,
          actionLabel,
          audience,
          logger: request.log,
        });
        if (actor) await writeAuditLog(db, request, actor, 'push:broadcast', 'notifications', 'broadcast', { label: `Broadcast push: ${title}`, subscribers: total.subscribers, sent: total.sent, failed: total.failed });
        return { broadcast: true, ...total };
      }

      return reply.code(400).send({ error: 'userId or broadcast required' });
    } catch (e) {
      return reply.code(500).send({ error: e.message });
    }
  });

  fastify.post('/api/send-push/retry-pending', async (request, reply) => {
    const secret = request.headers['x-push-secret'];
    const valid = (secret && secret === process.env.PUSH_SECRET) || (secret && secret === process.env.RAFFLE_SECRET);
    if (!valid) {
      try {
        await requireAdminPermission(request, 'push:*');
      } catch {
        return reply.code(401).send({ error: 'unauthorized' });
      }
    }
    const db = getDb();
    const max = Math.min(Math.max(Number(request.body?.limit || 25), 1), 100);
    const maxAgeHours = Math.min(Math.max(Number(request.body?.maxAgeHours || 48), 1), 168);
    const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;
    const snapshot = await db.collection('notifications').limit(500).get();
    const pending = snapshot.docs
      .map(document => ({ id: document.id, ...(document.data() || {}) }))
      .filter(item => ['news', 'events', 'partners', 'experts'].includes(item.category))
      .filter(item => ['pending', 'error'].includes(item.pushStatus));
    const timestampMs = item => item.createdAt?.toMillis?.()
      || item.createdAt?.toDate?.().getTime()
      || new Date(item.createdAt || 0).getTime()
      || 0;
    const stale = pending.filter(item => timestampMs(item) < cutoff);
    const candidates = pending
      .filter(item => timestampMs(item) >= cutoff)
      .slice(0, max);
    if (stale.length) {
      const batch = db.batch();
      stale.forEach(item => batch.set(db.collection('notifications').doc(item.id), {
        pushStatus: 'skipped',
        pushSkipReason: 'stale_pending_notification',
        pushSkippedAt: FieldValue.serverTimestamp(),
      }, { merge: true }));
      await batch.commit();
    }
    const results = [];
    for (const item of candidates) {
      try {
        const deepLink = item.deepLink || item.url || '/';
        const targetUrl = /^https?:\/\//i.test(deepLink) ? deepLink : `${APP_URL}${deepLink.startsWith('/') ? deepLink : `/${deepLink}`}`;
        const stats = await sendBroadcastPush({
          db,
          title: item.title || 'Уведомление АПГ',
          body: item.body || item.text || '',
          url: targetUrl,
          tag: `apg-retry-${item.id}`,
          notificationId: item.id,
          category: item.category,
          type: item.type || 'info',
          priority: item.priority || 'normal',
          imageUrl: item.imageUrl || '',
          actionLabel: item.actionLabel || 'Открыть',
          audience: item.audience || { type: 'all' },
          logger: request.log,
        });
        results.push({ id: item.id, category: item.category, sent: stats.sent || 0, failed: stats.failed || 0, skipped: stats.skipped === true });
      } catch (error) {
        await db.collection('notifications').doc(item.id).set({
          pushStatus: 'error',
          pushError: String(error?.message || error).slice(0, 300),
          pushFailedAt: FieldValue.serverTimestamp(),
        }, { merge: true }).catch(() => {});
        results.push({ id: item.id, category: item.category, error: String(error?.message || error) });
      }
    }
    return {
      ok: true,
      staleSkipped: stale.length,
      candidates: candidates.length,
      processed: results.length,
      sent: results.reduce((sum, item) => sum + Number(item.sent || 0), 0),
      failed: results.reduce((sum, item) => sum + Number(item.failed || 0), 0),
      results,
    };
  });
}
