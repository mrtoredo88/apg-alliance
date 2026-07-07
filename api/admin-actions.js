import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './_firebase-admin.js';
import { adminError, requireAdminPermission, writeAuditLog } from './_admin-security.js';

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
  scans: { collection: 'scans', scope: 'maintenance', label: 'скан' },
  raffleEntries: { collection: 'raffleEntries', scope: 'maintenance', label: 'участие в розыгрыше' },
  expertReviews: { collection: 'expertReviews', scope: 'maintenance', label: 'отзыв эксперта' },
  config: { collection: 'config', scope: 'settings', label: 'настройка' },
  stats: { collection: 'stats', scope: 'stats', label: 'статистика' },
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

async function handleNewsAction(db, req, actor) {
  const action = String(req.body?.action || '').trim();
  const id = String(req.body?.id || req.body?.targetId || '').trim();
  const idempotencyKey = String(req.headers['x-idempotency-key'] || req.body?.idempotencyKey || '').trim();

  if (action === 'news:create') {
    await requireAdminPermission(req, 'news:create');
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const patch = cleanPatch(req.body?.patch);
      if (!patch.title || !patch.text) {
        const error = new Error('Для новости нужны заголовок и текст.');
        error.statusCode = 400;
        throw error;
      }
      const data = { ...patch, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
      const ref = await db.collection('news').add(data);
      await writeHistory(db, actor, ref.id, 'create', null, data);
      await writeAuditLog(db, req, actor, 'create', 'news', ref.id, { label: `Создана новость: ${patch.title}` });
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
    await requireAdminPermission(req, 'news:update');
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const patch = { ...cleanPatch(req.body?.patch), updatedAt: FieldValue.serverTimestamp() };
      await ref.update(patch);
      await writeHistory(db, actor, id, action === 'news:autosave' ? 'autosave' : 'quick-update', before, patch);
      await writeAuditLog(db, req, actor, action, 'news', id, { label: `${action === 'news:autosave' ? 'Автосохранена' : 'Изменена'} новость: ${patch.title || before.title || id}`, fields: Object.keys(patch) });
      return { ok: true, id, patch };
    });
  }

  if (action === 'news:publish') {
    await requireAdminPermission(req, 'news:publish');
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const patch = { active: true, status: 'published', publishedAt: before.publishedAt || FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
      await ref.update(patch);
      await writeHistory(db, actor, id, 'publish', before, patch);
      await writeAuditLog(db, req, actor, 'publish', 'news', id, { label: `Опубликована новость: ${before.title || id}` });
      return { ok: true, id, patch: { active: true, status: 'published' } };
    });
  }

  if (action === 'news:pin') {
    await requireAdminPermission(req, 'news:pin');
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const next = !(before.pinned || before.isPinned);
      const patch = { pinned: next, isPinned: next, priority: next ? Math.max(Number(before.priority || 0), 9) : Number(before.priority || 0), updatedAt: FieldValue.serverTimestamp() };
      await ref.update(patch);
      await writeHistory(db, actor, id, next ? 'pin' : 'unpin', before, patch);
      await writeAuditLog(db, req, actor, next ? 'pin' : 'unpin', 'news', id, { label: `${next ? 'Закреплена' : 'Откреплена'} новость: ${before.title || id}` });
      return { ok: true, id, patch: { pinned: next, isPinned: next, priority: patch.priority } };
    });
  }

  if (action === 'news:delete') {
    await requireAdminPermission(req, 'news:delete');
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const patch = { active: false, status: 'deleted', deletedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
      await ref.update(patch);
      await writeHistory(db, actor, id, 'soft-delete', before, patch);
      await writeAuditLog(db, req, actor, 'delete', 'news', id, { label: `Удалена новость: ${before.title || id}`, softDelete: true });
      return { ok: true, id, patch: { active: false, status: 'deleted' }, previous: { ...before, id } };
    });
  }

  if (action === 'news:restore') {
    await requireAdminPermission(req, 'news:restore');
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const previous = req.body?.previous || {};
      const patch = {
        active: previous.active !== false,
        status: previous.status && previous.status !== 'deleted' ? previous.status : (previous.active === false ? 'draft' : 'published'),
        deletedAt: null,
        updatedAt: FieldValue.serverTimestamp(),
      };
      await ref.update(patch);
      await writeHistory(db, actor, id, 'restore', before, patch);
      await writeAuditLog(db, req, actor, 'restore', 'news', id, { label: `Восстановлена новость: ${before.title || previous.title || id}` });
      return { ok: true, id, patch: { active: patch.active, status: patch.status, deletedAt: null } };
    });
  }

  if (action === 'news:reorder') {
    await requireAdminPermission(req, 'news:reorder');
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const patch = { priority: Number(req.body?.priority || 0), updatedAt: FieldValue.serverTimestamp() };
      await ref.update(patch);
      await writeHistory(db, actor, id, 'drag-reorder', before, patch);
      await writeAuditLog(db, req, actor, 'drag-reorder', 'news', id, { label: `Изменён порядок новости: ${before.title || id}`, targetId: req.body?.targetId || null });
      return { ok: true, id, patch: { priority: patch.priority } };
    });
  }

  const error = new Error('Неизвестное административное действие.');
  error.statusCode = 400;
  throw error;
}

async function handleEntityAction(db, req, actor) {
  const action = String(req.body?.action || '').trim();
  const resource = String(req.body?.resource || '').trim();
  const config = RESOURCE_CONFIG[resource];
  if (!config) {
    const error = new Error('Неизвестный административный ресурс.');
    error.statusCode = 400;
    throw error;
  }

  const verb = action.split(':')[1] || '';
  const id = String(req.body?.id || req.body?.targetId || '').trim();
  const idempotencyKey = String(req.headers['x-idempotency-key'] || req.body?.idempotencyKey || '').trim();

  if (action === 'entity:create') {
    await requireAdminPermission(req, `${config.scope}:create`);
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const patch = withServerTimestamps(cleanEntityPatch(req.body?.patch), req.body?.serverTimestampFields || []);
      const data = { ...patch, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
      const ref = await db.collection(config.collection).add(data);
      await writeAuditLog(db, req, actor, `${config.scope}:create`, config.collection, ref.id, { label: `Создан ${config.label}: ${patch.name || patch.title || ref.id}` });
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
    await requireAdminPermission(req, `${config.scope}:update`);
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const increments = req.body?.increments || {};
      const patch = withServerTimestamps(cleanEntityPatch(req.body?.patch), req.body?.serverTimestampFields || []);
      Object.entries(increments).forEach(([key, value]) => {
        patch[key] = FieldValue.increment(Number(value) || 0);
      });
      patch.updatedAt = FieldValue.serverTimestamp();
      await ref.set(patch, { merge: true });
      await writeAuditLog(db, req, actor, `${config.scope}:update`, config.collection, id, { label: `Обновлён ${config.label}: ${patch.name || patch.title || id}`, fields: Object.keys(patch) });
      return { ok: true, resource, id, patch: cleanEntityPatch(req.body?.patch), increments };
    });
  }

  if (action === 'entity:delete') {
    await requireAdminPermission(req, `${config.scope}:delete`);
    return runIdempotent(db, actor, idempotencyKey, async () => {
      await ref.delete();
      await writeAuditLog(db, req, actor, `${config.scope}:delete`, config.collection, id, { label: `Удалён ${config.label}: ${id}` });
      return { ok: true, resource, id };
    });
  }

  if (action === 'entity:set') {
    await requireAdminPermission(req, `${config.scope}:update`);
    return runIdempotent(db, actor, idempotencyKey, async () => {
      const patch = withServerTimestamps(cleanEntityPatch(req.body?.patch), req.body?.serverTimestampFields || []);
      await ref.set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      await writeAuditLog(db, req, actor, `${config.scope}:set`, config.collection, id, { label: `Сохранён ${config.label}: ${id}`, fields: Object.keys(patch) });
      return { ok: true, resource, id, patch };
    });
  }

  const error = new Error(`Неизвестное действие ${verb || action}.`);
  error.statusCode = 400;
  throw error;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Idempotency-Key,X-APG-Version');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const db = getAdminDb();
  try {
    const actor = await requireAdminPermission(req, 'system:read');
    const action = String(req.body?.action || '');
    const result = action.startsWith('entity:')
      ? await handleEntityAction(db, req, actor)
      : await handleNewsAction(db, req, actor);
    return res.status(200).json(result);
  } catch (error) {
    try {
      await writeAuditLog(db, req, { uid: 'unknown', userId: 'unknown', role: 'unknown' }, String(req.body?.action || 'admin-action'), 'unknown', req.body?.id || '', { error: String(error?.message || error) }, 'error');
    } catch {}
    return adminError(res, error);
  }
}
