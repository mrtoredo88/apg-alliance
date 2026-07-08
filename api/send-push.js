// Vercel serverless function — отправка Web Push уведомления пользователю
// Env vars: FIREBASE_SERVICE_ACCOUNT, PUSH_SECRET
//
// POST /api/send-push
// Headers: x-push-secret: <PUSH_SECRET>
// Body: { userId, title, body?, url?, tag? }
//
// Также поддерживает broadcast:
// Body: { broadcast: true, title, body?, url?, tag? }
// — отправляет всем пользователям с notificationProvider === 'webpush'

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import webpush from 'web-push';
import { APP_URL } from './config.js';
import { requireAdminPermission, writeAuditLog } from './_admin-security.js';

function initAdmin() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  }
  return { db: getFirestore(), messaging: getMessaging() };
}

function initWebPush() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return { ok: false, error: 'WEB_PUSH_VAPID_ENV_MISSING' };
  webpush.setVapidDetails(process.env.WEB_PUSH_VAPID_SUBJECT || `mailto:support@${new URL(APP_URL).hostname}`, publicKey, privateKey);
  return { ok: true };
}

const DEFAULT_CATEGORIES = {
  news: true,
  events: true,
  partners: true,
  experts: true,
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

async function sendToFcmTokens(messaging, db, tokens, userIds, title, body, url, tag, options = {}) {
  if (!tokens.length) return { sent: 0, failed: 0, cleaned: 0 };

  const webpushNotification = {
    icon:  `${APP_URL}/192.png`,
    badge: `${APP_URL}/32.png`,
    tag:   tag ?? 'apg-push',
    renotify: true,
    requireInteraction: options.priority === 'critical',
  };
  if (options.imageUrl) webpushNotification.image = options.imageUrl;
  if (options.actionLabel) webpushNotification.actions = [{ action: 'open', title: options.actionLabel }];

  const message = {
    tokens,
    notification: { title, body: body ?? '' },
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
    webpush: {
      notification: webpushNotification,
      fcmOptions: { link: url ?? APP_URL },
    },
  };

  const result = await messaging.sendEachForMulticast(message);

  // Удаляем протухшие токены
  let cleaned = 0;
  const DEAD_CODES = new Set([
    'messaging/invalid-registration-token',
    'messaging/registration-token-not-registered',
  ]);

  const deadByUser = {};
  result.responses.forEach((r, i) => {
    if (!r.success && DEAD_CODES.has(r.error?.code)) {
      const uid = userIds[i];
      if (uid) {
        deadByUser[uid] ??= [];
        deadByUser[uid].push(tokens[i]);
      }
    }
  });

  await Promise.all(
    Object.entries(deadByUser).map(([uid, dead]) =>
      db.collection('users').doc(uid).update({
        fcmTokens: FieldValue.arrayRemove(...dead),
      }).catch(() => {})
    )
  );
  cleaned = Object.values(deadByUser).flat().length;

  const errors = result.responses
    .filter(r => !r.success)
    .slice(0, 12)
    .map(r => ({ code: r.error?.code || 'unknown', message: r.error?.message || '' }));

  return { sent: result.successCount, failed: result.failureCount, cleaned, errors };
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

async function sendToWebPushSubscriptions(db, subscriptions, userIds, title, body, url, tag, options = {}) {
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
      await webpush.sendNotification(subscription, payload, {
        TTL: options.priority === 'critical' ? 86400 : 21600,
        urgency: options.priority === 'critical' ? 'high' : 'normal',
      });
      sent += 1;
    } catch (e) {
      failed += 1;
      const code = e.statusCode ? `webpush/${e.statusCode}` : 'webpush/error';
      errors.push({ code, message: String(e.body || e.message || '').slice(0, 300) });
      if (e.statusCode === 404 || e.statusCode === 410) {
        deadByUser[userId] ??= [];
        deadByUser[userId].push(subscription);
      }
    }
  }));

  await Promise.all(
    Object.entries(deadByUser).map(([uid, dead]) =>
      db.collection('users').doc(uid).update({
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const secret = req.headers['x-push-secret'];
  const valid  = (secret && secret === process.env.PUSH_SECRET) ||
                 (secret && secret === process.env.RAFFLE_SECRET);
  let actor = null;
  if (!valid) {
    try {
      actor = await requireAdminPermission(req, 'push:*');
    } catch {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  const { userId, broadcast, title, body, url, tag, notificationId, category = 'important', type = 'info', priority = 'normal', imageUrl, actionLabel, audience = {} } = req.body ?? {};
  if (!title) return res.status(400).json({ error: 'title required' });

  let db, messaging;
  try { ({ db, messaging } = initAdmin()); }
  catch (e) { return res.status(500).json({ error: e.message }); }

  try {
    // ── Одиночная отправка ──────────────────────────────────────────────────
    if (userId && !broadcast) {
      const snap = await db.collection('users').doc(String(userId)).get();
      if (!snap.exists) return res.status(404).json({ error: 'user not found' });
      const { fcmTokens = [], webPushSubscriptions = [] } = snap.data();
      if (!fcmTokens.length && !webPushSubscriptions.length) return res.json({ skipped: true, reason: 'no push subscriptions', subscribers: 0, sent: 0, failed: 0 });

      const nativeStats = await sendToWebPushSubscriptions(
        db,
        webPushSubscriptions, webPushSubscriptions.map(() => String(userId)),
        title, body, url, tag,
        { notificationId, category, type, priority, imageUrl, actionLabel }
      );
      const fcmStats = await sendToFcmTokens(
        messaging, db,
        fcmTokens, fcmTokens.map(() => String(userId)),
        title, body, url, tag,
        { notificationId, category, type, priority, imageUrl, actionLabel }
      );
      const stats = mergeStats(nativeStats, fcmStats, webPushSubscriptions.length + fcmTokens.length);
      if (notificationId) await db.collection('notifications').doc(String(notificationId)).set({
        pushStatus: stats.failed ? 'partial' : 'sent',
        pushStats: stats,
        pushSentAt: FieldValue.serverTimestamp(),
      }, { merge: true }).catch(() => {});
      if (actor) await writeAuditLog(db, req, actor, 'push:send', 'user', userId, { label: `Push пользователю: ${title}`, sent: stats.sent, failed: stats.failed });
      return res.json(stats);
    }

    // ── Broadcast ───────────────────────────────────────────────────────────
    if (broadcast) {
      const snap = await db.collection('users').get();

      const tokens  = [];
      const tokenUserIds = [];
      const subscriptions = [];
      const subscriptionUserIds = [];
      snap.docs.forEach(d => {
        const data = d.data() || {};
        const prefs = data.notificationPreferences || DEFAULT_CATEGORIES;
        const hasConsent = data.notificationsEnabled === true || data.notificationConsent === true;
        if (!hasConsent || (data.notificationProvider && data.notificationProvider !== 'webpush')) return;
        if (!boolPref(prefs, category)) return;
        if (!userMatchesAudience(data, audience)) return;
        (data.fcmTokens ?? []).forEach(t => {
          tokens.push(t);
          tokenUserIds.push(d.id);
        });
        (data.webPushSubscriptions ?? []).forEach(s => {
          subscriptions.push(s);
          subscriptionUserIds.push(d.id);
        });
      });

      if (!tokens.length && !subscriptions.length) {
        const skipped = { skipped: true, reason: 'no matching webpush subscribers', subscribers: 0, sent: 0, failed: 0, cleaned: 0 };
        if (notificationId) await db.collection('notifications').doc(String(notificationId)).set({
          pushStatus: 'skipped',
          pushStats: skipped,
          pushSentAt: FieldValue.serverTimestamp(),
        }, { merge: true }).catch(() => {});
        return res.json(skipped);
      }

      let fcmTotal = { sent: 0, failed: 0, cleaned: 0, errors: [] };
      for (let i = 0; i < tokens.length; i += 500) {
        const chunk = tokens.slice(i, i + 500);
        const ids   = tokenUserIds.slice(i, i + 500);
        const s = await sendToFcmTokens(messaging, db, chunk, ids, title, body, url, tag, { notificationId, category, type, priority, imageUrl, actionLabel });
        fcmTotal.sent    += s.sent;
        fcmTotal.failed  += s.failed;
        fcmTotal.cleaned += s.cleaned;
        fcmTotal.errors = [...(fcmTotal.errors || []), ...(s.errors || [])].slice(0, 20);
      }
      const nativeTotal = await sendToWebPushSubscriptions(db, subscriptions, subscriptionUserIds, title, body, url, tag, { notificationId, category, type, priority, imageUrl, actionLabel });
      const total = mergeStats(nativeTotal, fcmTotal, subscriptions.length + tokens.length);
      if (notificationId) await db.collection('notifications').doc(String(notificationId)).set({
        pushStatus: total.failed ? 'partial' : 'sent',
        pushStats: total,
        pushSentAt: FieldValue.serverTimestamp(),
      }, { merge: true }).catch(() => {});
      if (actor) await writeAuditLog(db, req, actor, 'push:broadcast', 'notifications', 'broadcast', { label: `Broadcast push: ${title}`, subscribers: total.subscribers, sent: total.sent, failed: total.failed });
      return res.json({ broadcast: true, ...total });
    }

    return res.status(400).json({ error: 'userId or broadcast required' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
