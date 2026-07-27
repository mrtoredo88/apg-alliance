import { FieldValue } from './documentValues.js';
import { APP_URL } from './config.js';
import { sendBroadcastPush } from '../routes/send-push.js';

const CONTENT_NOTIFICATION_CONFIG = {
  news: {
    category: 'news',
    emoji: '📰',
    title: item => item.title || 'Новая новость АПГ',
    body: item => item.summary || item.subtitle || item.text || item.fullText || 'Открывайте подробности в приложении.',
    path: id => `/news/${encodeURIComponent(id)}`,
  },
  events: {
    category: 'events',
    emoji: '🎉',
    title: item => item.title || item.name || 'Новое событие АПГ',
    body: item => [item.date || item.eventDate, item.address || item.location].filter(Boolean).join(' · ') || item.description || 'Открыта запись на новое событие.',
    path: id => `/event/${encodeURIComponent(id)}`,
  },
  partners: {
    category: 'partners',
    emoji: '🤝',
    title: item => item.name || item.title || 'Новый партнёр АПГ',
    body: item => item.offer || item.specialOffer || item.promo || item.description || 'Познакомьтесь с новым партнёром города.',
    path: id => `/partner/${encodeURIComponent(id)}`,
  },
  experts: {
    category: 'experts',
    emoji: '🎓',
    title: item => item.name || item.title || 'Новый эксперт АПГ',
    body: item => item.specialization || item.role || item.description || item.bio || 'Познакомьтесь с новым экспертом АПГ.',
    path: id => `/expert/${encodeURIComponent(id)}`,
  },
};

function clipped(value, max = 160) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function isPublicContent(item = {}) {
  const status = String(item.contentStatus || item.lifecycleStatus || item.status || '').toLowerCase();
  if (['deleted', 'trash', 'archived', 'draft', 'moderation', 'pending_review', 'scheduled'].includes(status)) return false;
  return item.active === true || item.published === true || status === 'published';
}

export function becamePublicContent(before, after) {
  return !isPublicContent(before || {}) && isPublicContent(after || {});
}

export async function notifyContentPublished({
  db,
  resource,
  id,
  item,
  logger,
  force = false,
}) {
  const config = CONTENT_NOTIFICATION_CONFIG[resource];
  if (!config || !id || !isPublicContent(item)) return { skipped: true, reason: 'not_public_content' };

  const notificationId = `content_${resource}_${String(id).replace(/[^a-z0-9_-]/gi, '_')}`.slice(0, 900);
  const ref = db.collection('notifications').doc(notificationId);
  const existing = await ref.get();
  const existingData = existing.exists ? existing.data() || {} : {};
  if (!force && ['sent', 'partial'].includes(existingData.pushStatus)) {
    return { skipped: true, reason: 'already_dispatched', notificationId };
  }

  const title = `${config.emoji} ${clipped(config.title(item), 90)}`;
  const body = clipped(config.body(item), 180);
  const deepLink = config.path(id);
  const imageUrl = item.coverPhoto || item.imageUrl || item.logoUrl || item.photo || '';
  await ref.set({
    title,
    body,
    text: body,
    emoji: config.emoji,
    category: config.category,
    type: `${resource}:published`,
    resource,
    resourceId: String(id),
    targetType: 'all',
    audience: { type: 'all' },
    actionLabel: 'Открыть',
    deepLink,
    url: deepLink,
    imageUrl,
    priority: 'normal',
    status: 'published',
    active: true,
    pushStatus: 'pending',
    dispatchAttempts: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: existingData.createdAt || FieldValue.serverTimestamp(),
  }, { merge: true });

  try {
    return await sendBroadcastPush({
      db,
      title,
      body,
      url: `${APP_URL}${deepLink}`,
      tag: `apg-${resource}-${id}`,
      notificationId,
      category: config.category,
      type: `${resource}:published`,
      priority: 'normal',
      imageUrl,
      actionLabel: 'Открыть',
      audience: { type: 'all' },
      logger,
    });
  } catch (error) {
    await ref.set({
      pushStatus: 'error',
      pushError: clipped(error?.message || error, 300),
      pushFailedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true }).catch(() => {});
    throw error;
  }
}
