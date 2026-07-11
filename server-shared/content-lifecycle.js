export const CONTENT_LIFECYCLE_VERSION = 'content-lifecycle-v1';

export const CONTENT_STATUSES = [
  'draft',
  'moderation',
  'scheduled',
  'published',
  'completed',
  'archived',
  'deleted',
  'trash',
];

export const CONTENT_STATUS_LABELS = {
  draft: 'Черновик',
  moderation: 'На модерации',
  scheduled: 'Запланировано',
  published: 'Опубликовано',
  completed: 'Завершено',
  archived: 'Архив',
  deleted: 'Удалено',
  trash: 'Корзина',
};

export const CONTENT_RESOURCES = {
  news: { collection: 'news', label: 'Новости', titleFields: ['title', 'headline'], dateFields: ['publishedAt', 'createdAt'] },
  events: { collection: 'events', label: 'Мероприятия', titleFields: ['title', 'name'], dateFields: ['startAt', 'startsAt', 'eventDate', 'date'] },
  promotions: { collection: 'partners', label: 'Акции', titleFields: ['offer', 'promo', 'name', 'title'], dateFields: ['offerUntil', 'updatedAt', 'createdAt'], filter: item => Boolean(item?.offer || item?.promo || item?.discount || item?.specialOffer) },
  partners: { collection: 'partners', label: 'Партнёры', titleFields: ['name', 'title'], dateFields: ['publishedAt', 'createdAt'] },
  experts: { collection: 'experts', label: 'Эксперты', titleFields: ['name', 'title'], dateFields: ['publishedAt', 'createdAt'] },
  prizes: { collection: 'prizes', label: 'Призы', titleFields: ['name', 'title'], dateFields: ['raffleDate', 'createdAt'] },
  tasks: { collection: 'customTasks', label: 'Задания', titleFields: ['title', 'name'], dateFields: ['createdAt'] },
  banners: { collection: 'banners', label: 'Реклама', titleFields: ['title', 'name'], dateFields: ['endDate', 'createdAt'] },
};

const PUBLIC_STATUSES = new Set(['published']);
const ARCHIVE_STATUSES = new Set(['archived']);
const DELETED_STATUSES = new Set(['deleted', 'trash']);
const PENDING_STATUSES = new Set(['draft', 'new', 'pending', 'pending_review', 'review', 'revision_requested']);

export function toLifecycleMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function normalizeContentStatus(item = {}) {
  const explicit = String(item.lifecycle?.status || item.lifecycleStatus || item.contentStatus || item.status || '').trim().toLowerCase();
  if (explicit === 'archive') return 'archived';
  if (explicit === 'pending_review' || explicit === 'review' || explicit === 'new') return 'moderation';
  if (explicit === 'active') return 'published';
  if (CONTENT_STATUSES.includes(explicit)) return explicit;
  if (item.deleted === true || item.deletedAt) return 'deleted';
  if (item.archived === true || item.archivedAt) return 'archived';
  if (item.active === false || item.published === false) return 'draft';
  return 'published';
}

export function isLifecyclePublic(item) {
  const status = normalizeContentStatus(item);
  return PUBLIC_STATUSES.has(status) && item?.archived !== true && item?.deleted !== true && item?.hidden !== true && item?.active !== false;
}

export function isLifecycleArchived(item) {
  return ARCHIVE_STATUSES.has(normalizeContentStatus(item)) || item?.archived === true;
}

export function isLifecycleDeleted(item) {
  return DELETED_STATUSES.has(normalizeContentStatus(item)) || item?.deleted === true || Boolean(item?.deletedAt);
}

export function lifecycleBucket(item) {
  const status = normalizeContentStatus(item);
  if (status === 'archived') return 'archive';
  if (status === 'deleted' || status === 'trash') return 'deleted';
  if (status === 'completed') return 'completed';
  if (status === 'scheduled') return 'scheduled';
  if (status === 'moderation') return 'moderation';
  if (status === 'draft') return 'draft';
  return 'active';
}

export function contentTitle(item = {}, resource = '') {
  const fields = CONTENT_RESOURCES[resource]?.titleFields || ['title', 'name'];
  return fields.map(key => item?.[key]).find(Boolean) || item?.id || 'Без названия';
}

export function contentDate(item = {}, resource = '') {
  const fields = CONTENT_RESOURCES[resource]?.dateFields || ['publishedAt', 'createdAt'];
  return fields.map(key => item?.[key]).find(Boolean) || item?.updatedAt || item?.createdAt || null;
}

export function isEventPast(item = {}, now = Date.now()) {
  const end = toLifecycleMillis(item.endAt || item.endsAt || item.endDate);
  if (end) return end < now;
  const start = toLifecycleMillis(item.startAt || item.startsAt || item.eventDate || item.date);
  return start > 0 && start < now;
}

export function getLifecycleAutoRecommendation(resource, item = {}, options = {}) {
  const now = Number(options.now || Date.now());
  const status = normalizeContentStatus(item);
  if (resource === 'events' && status === 'published' && isEventPast(item, now)) {
    return { action: 'complete', targetStatus: 'completed', reason: 'Мероприятие уже прошло. Его нужно оставить в истории прошедших мероприятий.' };
  }
  if (resource === 'events' && status === 'completed') {
    const completedAt = toLifecycleMillis(item.lifecycle?.completedAt || item.completedAt || item.endAt || item.eventDate || item.date);
    const days = Number(options.completedEventArchiveDays ?? 60);
    if (completedAt && now - completedAt > days * 86400000) return { action: 'archive', targetStatus: 'archived', reason: `Прошедшее мероприятие старше ${days} дней можно архивировать.` };
  }
  if (resource === 'news' && status === 'published') {
    const publishedAt = toLifecycleMillis(item.publishedAt || item.createdAt);
    const days = Number(options.newsArchiveDays ?? 180);
    if (publishedAt && now - publishedAt > days * 86400000) return { action: 'archive', targetStatus: 'archived', reason: `Новость старше ${days} дней можно отправить в архив.` };
  }
  return null;
}

export function buildLifecyclePatch({ item = {}, resource = '', nextStatus = 'published', actorId = 'admin', reason = '', serverTimestamp = null } = {}) {
  const status = CONTENT_STATUSES.includes(nextStatus) ? nextStatus : 'published';
  const current = normalizeContentStatus(item);
  const ts = serverTimestamp || new Date().toISOString();
  const event = {
    status,
    from: current,
    reason: String(reason || '').slice(0, 500),
    actorId,
    at: ts,
    resource,
  };
  const history = Array.isArray(item.lifecycleHistory) ? item.lifecycleHistory.slice(-49) : [];
  const patch = {
    lifecycleStatus: status,
    contentStatus: status,
    lifecycle: {
      ...(item.lifecycle || {}),
      version: CONTENT_LIFECYCLE_VERSION,
      status,
      updatedAt: ts,
      updatedBy: actorId,
      resource,
    },
    lifecycleHistory: [...history, event],
  };
  if (status === 'draft') Object.assign(patch, { active: false, archived: false, deleted: false });
  if (status === 'moderation') Object.assign(patch, { active: false, archived: false, deleted: false, moderationStatus: 'pending_review' });
  if (status === 'scheduled') Object.assign(patch, { active: false, archived: false, deleted: false });
  if (status === 'published') Object.assign(patch, { active: true, archived: false, deleted: false, deletedAt: null, archivedAt: null, publishedAt: item.publishedAt || ts });
  if (status === 'completed') Object.assign(patch, { active: false, archived: false, deleted: false, completedAt: item.completedAt || ts });
  if (status === 'archived') Object.assign(patch, { active: false, archived: true, deleted: false, archivedAt: ts, archivedBy: actorId });
  if (status === 'deleted') Object.assign(patch, { active: false, archived: true, deleted: true, deletedAt: ts, deletedBy: actorId });
  if (status === 'trash') Object.assign(patch, { active: false, archived: true, deleted: true, trashAt: ts, deletedAt: item.deletedAt || ts, deletedBy: actorId });
  return patch;
}

export function summarizeLifecycle(items = [], resource = '') {
  const rows = (Array.isArray(items) ? items : []).filter(item => CONTENT_RESOURCES[resource]?.filter ? CONTENT_RESOURCES[resource].filter(item) : true);
  return rows.reduce((acc, item) => {
    const status = normalizeContentStatus(item);
    acc.total += 1;
    acc[status] = (acc[status] || 0) + 1;
    acc[lifecycleBucket(item)] = (acc[lifecycleBucket(item)] || 0) + 1;
    return acc;
  }, { total: 0, active: 0, draft: 0, moderation: 0, scheduled: 0, completed: 0, archived: 0, deleted: 0, trash: 0 });
}

export function filterByLifecycleView(items = [], view = 'active', resource = '') {
  const filtered = (Array.isArray(items) ? items : []).filter(item => CONTENT_RESOURCES[resource]?.filter ? CONTENT_RESOURCES[resource].filter(item) : true);
  if (view === 'all') return filtered;
  if (view === 'archive') return filtered.filter(isLifecycleArchived);
  if (view === 'deleted') return filtered.filter(isLifecycleDeleted);
  if (view === 'completed') return filtered.filter(item => normalizeContentStatus(item) === 'completed');
  if (view === 'draft') return filtered.filter(item => normalizeContentStatus(item) === 'draft');
  if (view === 'moderation') return filtered.filter(item => normalizeContentStatus(item) === 'moderation' || PENDING_STATUSES.has(String(item.status || item.moderationStatus || '').toLowerCase()));
  if (view === 'scheduled') return filtered.filter(item => normalizeContentStatus(item) === 'scheduled');
  return filtered.filter(item => !isLifecycleArchived(item) && !isLifecycleDeleted(item));
}
