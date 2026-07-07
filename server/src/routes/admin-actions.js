import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../lib/firebase.js';
import { adminReplyError, requireAdminPermission, writeAuditLog } from '../lib/adminSecurity.js';

const NEWS_FIELDS = new Set(['title', 'text', 'emoji', 'imageUrl', 'coverPhoto', 'linkUrl', 'linkLabel', 'priority', 'category', 'active', 'status', 'publishedAt', 'pinned', 'isPinned', 'linksCheckedAt']);
const RESOURCE_CONFIG = {
  partners: { collection: 'partners', scope: 'partners', label: 'партнёр' },
  experts: { collection: 'experts', scope: 'experts', label: 'эксперт' },
  events: { collection: 'events', scope: 'events', label: 'событие' },
  banners: { collection: 'banners', scope: 'banners', label: 'баннер' },
  prizes: { collection: 'prizes', scope: 'prizes', label: 'приз' },
  notifications: { collection: 'notifications', scope: 'notifications', label: 'уведомление' },
  customTasks: { collection: 'customTasks', scope: 'tasks', label: 'задание' },
  users: { collection: 'users', scope: 'users', label: 'пользователь' },
  prizeClaims: { collection: 'prizeClaims', scope: 'claims', label: 'выдача приза' },
  errorLogs: { collection: 'errorLogs', scope: 'errors', label: 'ошибка' },
  adminActivity: { collection: 'adminActivity', scope: 'audit', label: 'действие админки' },
  scans: { collection: 'scans', scope: 'maintenance', label: 'скан' },
  expertScans: { collection: 'expertScans', scope: 'maintenance', label: 'скан эксперта' },
  raffleEntries: { collection: 'raffleEntries', scope: 'maintenance', label: 'участие в розыгрыше' },
  expertReviews: { collection: 'expertReviews', scope: 'maintenance', label: 'отзыв эксперта' },
  guestSessions: { collection: 'guestSessions', scope: 'stats', label: 'гостевая сессия' },
  config: { collection: 'config', scope: 'settings', label: 'настройка' },
  stats: { collection: 'stats', scope: 'stats', label: 'статистика' },
};

const LIST_CONFIG = {
  users: { orderBy: null, limit: 1000 },
  prizeClaims: { orderBy: ['claimedAt', 'desc'], limit: 200 },
  banners: { orderBy: ['priority', 'asc'], limit: 200 },
  errorLogs: { orderBy: ['timestamp', 'desc'], limit: 200 },
  adminActivity: { orderBy: ['createdAt', 'desc'], limit: 200 },
  scans: { orderBy: ['scannedAt', 'desc'], limit: 500 },
  expertScans: { orderBy: ['scannedAt', 'desc'], limit: 500 },
  expertReviews: { orderBy: ['createdAt', 'desc'], limit: 300 },
  raffleEntries: { orderBy: ['createdAt', 'desc'], limit: 500 },
  guestSessions: { orderBy: ['createdAt', 'desc'], limit: 500 },
};

function cleanPatch(input = {}) {
  const patch = {};
  Object.entries(input || {}).forEach(([key, value]) => {
    if (NEWS_FIELDS.has(key)) patch[key] = value;
  });
  return patch;
}

function cleanEntityPatch(input = {}) {
  const patch = {};
  Object.entries(input || {}).forEach(([key, value]) => {
    if (['id', 'createdAt', 'updatedAt', 'deletedAt'].includes(key)) return;
    if (value === undefined) return;
    patch[key] = value;
  });
  return patch;
}

function withServerTimestamps(patch, fields = []) {
  const next = { ...patch };
  fields.forEach(field => {
    if (field) next[field] = FieldValue.serverTimestamp();
  });
  return next;
}

function serializeAdminValue(value) {
  if (!value) return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serializeAdminValue);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeAdminValue(item)]));
  }
  return value;
}

async function handleEntityList(db, request) {
  const resource = String(request.body?.resource || '').trim();
  const config = RESOURCE_CONFIG[resource];
  const listConfig = LIST_CONFIG[resource];
  if (!config || !listConfig) {
    const error = new Error('Неизвестный административный список.');
    error.statusCode = 400;
    throw error;
  }
  await requireAdminPermission(request, `${config.scope}:read`);
  let ref = db.collection(config.collection);
  if (listConfig.orderBy) ref = ref.orderBy(listConfig.orderBy[0], listConfig.orderBy[1]);
  const max = Math.min(Number(request.body?.limit || listConfig.limit || 200), listConfig.limit || 200, 1000);
  if (max > 0) ref = ref.limit(max);
  const snap = await ref.get();
  return {
    ok: true,
    resource,
    rows: snap.docs.map(doc => ({ id: doc.id, ...serializeAdminValue(doc.data() || {}) })),
    count: snap.size,
  };
}

async function writeHistory(db, actor, newsId, action, before, after) {
  await db.collection('newsChangeHistory').add({
    newsId,
    action,
    before: before || null,
    after: after || null,
    actorId: actor.userId,
    actorUid: actor.uid,
    actorName: actor.name,
    role: actor.role,
    createdAt: FieldValue.serverTimestamp(),
  });
}

async function runIdempotent(db, actor, key, fn) {
  if (!key) return fn();
  const ref = db.collection('adminIdempotency').doc(`${actor.uid}_${key}`);
  const snap = await ref.get();
  if (snap.exists) return { ...(snap.data()?.response || { ok: true }), idempotent: true };
  const result = await fn();
  await ref.set({
    actorUid: actor.uid,
    key,
    response: result,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  }, { merge: true });
  return result;
}

async function handleNewsAction(db, request, actor) {
  const action = String(request.body?.action || '').trim();
  const id = String(request.body?.id || request.body?.targetId || '').trim();
  const idempotencyKey = String(request.headers['x-idempotency-key'] || request.body?.idempotencyKey || '').trim();

  if (action === 'news:create') {
    await requireAdminPermission(request, 'news:create');
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const patch = cleanPatch(request.body?.patch);
      if (!patch.title || !patch.text) {
        const error = new Error('Для новости нужны заголовок и текст.');
        error.statusCode = 400;
        throw error;
      }
      const data = { ...patch, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
      const ref = await db.collection('news').add(data);
      await writeHistory(db, actor, ref.id, 'create', null, data);
      await writeAuditLog(db, request, actor, 'create', 'news', ref.id, { label: `Создана новость: ${patch.title}` });
      return { ok: true, id: ref.id };
    });
  }

  if (!id) {
    const error = new Error('Не указан id новости.');
    error.statusCode = 400;
    throw error;
  }

  const ref = db.collection('news').doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    const error = new Error('Новость не найдена.');
    error.statusCode = 404;
    throw error;
  }
  const before = snap.data() || {};

  if (action === 'news:update' || action === 'news:autosave') {
    await requireAdminPermission(request, 'news:update');
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const patch = { ...cleanPatch(request.body?.patch), updatedAt: FieldValue.serverTimestamp() };
      await ref.update(patch);
      await writeHistory(db, actor, id, action === 'news:autosave' ? 'autosave' : 'quick-update', before, patch);
      await writeAuditLog(db, request, actor, action, 'news', id, { label: `${action === 'news:autosave' ? 'Автосохранена' : 'Изменена'} новость: ${patch.title || before.title || id}`, fields: Object.keys(patch) });
      return { ok: true, id, patch };
    });
  }

  if (action === 'news:publish') {
    await requireAdminPermission(request, 'news:publish');
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const patch = { active: true, status: 'published', publishedAt: before.publishedAt || FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
      await ref.update(patch);
      await writeHistory(db, actor, id, 'publish', before, patch);
      await writeAuditLog(db, request, actor, 'publish', 'news', id, { label: `Опубликована новость: ${before.title || id}` });
      return { ok: true, id, patch: { active: true, status: 'published' } };
    });
  }

  if (action === 'news:pin') {
    await requireAdminPermission(request, 'news:pin');
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const next = !(before.pinned || before.isPinned);
      const patch = { pinned: next, isPinned: next, priority: next ? Math.max(Number(before.priority || 0), 9) : Number(before.priority || 0), updatedAt: FieldValue.serverTimestamp() };
      await ref.update(patch);
      await writeHistory(db, actor, id, next ? 'pin' : 'unpin', before, patch);
      await writeAuditLog(db, request, actor, next ? 'pin' : 'unpin', 'news', id, { label: `${next ? 'Закреплена' : 'Откреплена'} новость: ${before.title || id}` });
      return { ok: true, id, patch: { pinned: next, isPinned: next, priority: patch.priority } };
    });
  }

  if (action === 'news:delete') {
    await requireAdminPermission(request, 'news:delete');
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const patch = { active: false, status: 'deleted', deletedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
      await ref.update(patch);
      await writeHistory(db, actor, id, 'soft-delete', before, patch);
      await writeAuditLog(db, request, actor, 'delete', 'news', id, { label: `Удалена новость: ${before.title || id}`, softDelete: true });
      return { ok: true, id, patch: { active: false, status: 'deleted' }, previous: { ...before, id } };
    });
  }

  if (action === 'news:restore') {
    await requireAdminPermission(request, 'news:restore');
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const previous = request.body?.previous || {};
      const patch = {
        active: previous.active !== false,
        status: previous.status && previous.status !== 'deleted' ? previous.status : (previous.active === false ? 'draft' : 'published'),
        deletedAt: null,
        updatedAt: FieldValue.serverTimestamp(),
      };
      await ref.update(patch);
      await writeHistory(db, actor, id, 'restore', before, patch);
      await writeAuditLog(db, request, actor, 'restore', 'news', id, { label: `Восстановлена новость: ${before.title || previous.title || id}` });
      return { ok: true, id, patch: { active: patch.active, status: patch.status, deletedAt: null } };
    });
  }

  if (action === 'news:reorder') {
    await requireAdminPermission(request, 'news:reorder');
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const patch = { priority: Number(request.body?.priority || 0), updatedAt: FieldValue.serverTimestamp() };
      await ref.update(patch);
      await writeHistory(db, actor, id, 'drag-reorder', before, patch);
      await writeAuditLog(db, request, actor, 'drag-reorder', 'news', id, { label: `Изменён порядок новости: ${before.title || id}`, targetId: request.body?.targetId || null });
      return { ok: true, id, patch: { priority: patch.priority } };
    });
  }

  const error = new Error('Неизвестное административное действие.');
  error.statusCode = 400;
  throw error;
}

async function handleEntityAction(db, request, actor) {
  const action = String(request.body?.action || '').trim();
  const resource = String(request.body?.resource || '').trim();
  if (action === 'entity:list') return handleEntityList(db, request, actor);
  const config = RESOURCE_CONFIG[resource];
  if (!config) {
    const error = new Error('Неизвестный административный ресурс.');
    error.statusCode = 400;
    throw error;
  }

  const verb = action.split(':')[1] || '';
  const id = String(request.body?.id || request.body?.targetId || '').trim();
  const idempotencyKey = String(request.headers['x-idempotency-key'] || request.body?.idempotencyKey || '').trim();

  if (action === 'entity:create') {
    await requireAdminPermission(request, `${config.scope}:create`);
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const patch = withServerTimestamps(cleanEntityPatch(request.body?.patch), request.body?.serverTimestampFields || []);
      const data = { ...patch, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
      const ref = await db.collection(config.collection).add(data);
      await writeAuditLog(db, request, actor, `${config.scope}:create`, config.collection, ref.id, { label: `Создан ${config.label}: ${patch.name || patch.title || ref.id}` });
      return { ok: true, resource, id: ref.id, patch: data };
    });
  }

  if (!id) {
    const error = new Error('Не указан id административного объекта.');
    error.statusCode = 400;
    throw error;
  }

  const ref = db.collection(config.collection).doc(id);

  if (action === 'entity:update') {
    await requireAdminPermission(request, `${config.scope}:update`);
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const increments = request.body?.increments || {};
      const patch = withServerTimestamps(cleanEntityPatch(request.body?.patch), request.body?.serverTimestampFields || []);
      Object.entries(increments).forEach(([key, value]) => {
        patch[key] = FieldValue.increment(Number(value) || 0);
      });
      patch.updatedAt = FieldValue.serverTimestamp();
      await ref.set(patch, { merge: true });
      await writeAuditLog(db, request, actor, `${config.scope}:update`, config.collection, id, { label: `Обновлён ${config.label}: ${patch.name || patch.title || id}`, fields: Object.keys(patch) });
      return { ok: true, resource, id, patch: cleanEntityPatch(request.body?.patch), increments };
    });
  }

  if (action === 'entity:delete') {
    await requireAdminPermission(request, `${config.scope}:delete`);
    return runIdempotent(db, actor, idempotencyKey, async () => {
      await ref.delete();
      await writeAuditLog(db, request, actor, `${config.scope}:delete`, config.collection, id, { label: `Удалён ${config.label}: ${id}` });
      return { ok: true, resource, id };
    });
  }

  if (action === 'entity:set') {
    await requireAdminPermission(request, `${config.scope}:update`);
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const patch = withServerTimestamps(cleanEntityPatch(request.body?.patch), request.body?.serverTimestampFields || []);
      await ref.set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      await writeAuditLog(db, request, actor, `${config.scope}:set`, config.collection, id, { label: `Сохранён ${config.label}: ${id}`, fields: Object.keys(patch) });
      return { ok: true, resource, id, patch };
    });
  }

  const error = new Error(`Неизвестное действие ${verb || action}.`);
  error.statusCode = 400;
  throw error;
}

export default async function adminActionsRoutes(fastify) {
  fastify.post('/api/admin-actions', async (request, reply) => {
    const db = getDb();
    try {
      const actor = await requireAdminPermission(request, 'system:read');
      const action = String(request.body?.action || '');
      return action.startsWith('entity:')
        ? await handleEntityAction(db, request, actor)
        : await handleNewsAction(db, request, actor);
    } catch (error) {
      try {
        await writeAuditLog(db, request, { uid: 'unknown', userId: 'unknown', role: 'unknown' }, String(request.body?.action || 'admin-action'), 'unknown', request.body?.id || '', { error: String(error?.message || error) }, 'error');
      } catch {}
      return adminReplyError(reply, error);
    }
  });
}
