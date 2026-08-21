import { FieldValue } from '../lib/documentValues.js';
import { getDb } from '../lib/documentStore.js';
import { adminReplyError, requireAdminPermission, writeAuditLog } from '../lib/adminSecurity.js';

const COLLECTION = 'salesLeads';
const STAGES = new Set(['discovered', 'qualified', 'offer_ready', 'contacted', 'replied', 'meeting', 'won', 'lost']);
const PRIORITIES = new Set(['high', 'medium', 'low']);

function cleanText(value, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}

function cleanUrl(value) {
  const raw = cleanText(value, 1000);
  if (!raw) return '';
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).toString();
  } catch {
    return raw;
  }
}

function serialize(value) {
  if (value == null) return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  return value;
}

function sanitizeLead(input = {}, update = false) {
  const out = {};
  for (const key of ['name', 'category', 'city', 'district', 'contact', 'source']) {
    if (!update || Object.prototype.hasOwnProperty.call(input, key)) out[key] = cleanText(input[key], key === 'name' ? 180 : 300);
  }
  for (const key of ['website', 'vk', 'telegram', 'sourceUrl']) {
    if (!update || Object.prototype.hasOwnProperty.call(input, key)) out[key] = cleanUrl(input[key]);
  }
  for (const key of ['local', 'hasOfflinePoint', 'activeSocials', 'runsEvents', 'hasRepeatCustomers', 'canBringAudience', 'decisionMakerFound']) {
    if (!update || Object.prototype.hasOwnProperty.call(input, key)) out[key] = Boolean(input[key]);
  }
  if (!update || Object.prototype.hasOwnProperty.call(input, 'score')) out.score = Math.max(0, Math.min(100, Math.round(Number(input.score) || 0)));
  if (!update || Object.prototype.hasOwnProperty.call(input, 'priority')) out.priority = PRIORITIES.has(input.priority) ? input.priority : 'low';
  if (!update || Object.prototype.hasOwnProperty.call(input, 'stage')) out.stage = STAGES.has(input.stage) ? input.stage : 'discovered';
  if (!update || Object.prototype.hasOwnProperty.call(input, 'reasons')) out.reasons = Array.isArray(input.reasons) ? input.reasons.slice(0, 12).map(item => cleanText(item, 180)).filter(Boolean) : [];
  if (!update || Object.prototype.hasOwnProperty.call(input, 'offerDraft')) out.offerDraft = cleanText(input.offerDraft, 8000);
  return out;
}

function fingerprint(value) {
  return cleanText(value, 1000).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

async function findDuplicate(db, candidate, excludeId = '') {
  const snap = await db.collection(COLLECTION).limit(1000).get();
  const keys = {
    name: fingerprint(candidate.name), city: fingerprint(candidate.city), website: fingerprint(candidate.website),
    vk: fingerprint(candidate.vk), telegram: fingerprint(candidate.telegram),
  };
  for (const doc of snap.docs) {
    if (doc.id === excludeId) continue;
    const row = doc.data() || {};
    if (keys.website && keys.website === fingerprint(row.website)) return { id: doc.id, ...serialize(row) };
    if (keys.vk && keys.vk === fingerprint(row.vk)) return { id: doc.id, ...serialize(row) };
    if (keys.telegram && keys.telegram === fingerprint(row.telegram)) return { id: doc.id, ...serialize(row) };
    if (keys.name && keys.name === fingerprint(row.name) && keys.city === fingerprint(row.city)) return { id: doc.id, ...serialize(row) };
  }
  return null;
}

export default async function salesAiRoutes(fastify) {
  fastify.post('/api/sales-ai', async (request, reply) => {
    const db = getDb();
    try {
      const action = String(request.body?.action || 'list');
      const permission = action === 'list' ? 'partners:read' : 'partners:update';
      const actor = await requireAdminPermission(request, permission);

      if (action === 'list') {
        const snap = await db.collection(COLLECTION).limit(1000).get();
        const leads = snap.docs.map(doc => ({ id: doc.id, ...serialize(doc.data() || {}) }))
          .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
        return reply.send({ ok: true, leads });
      }

      if (action === 'create') {
        const lead = sanitizeLead(request.body?.lead || {});
        if (!lead.name) {
          const error = new Error('Укажите название компании.');
          error.statusCode = 400;
          throw error;
        }
        const duplicate = await findDuplicate(db, lead);
        if (duplicate) return reply.code(409).send({ ok: false, code: 'sales-ai/duplicate', error: `Похожий лид уже существует: ${duplicate.name || duplicate.id}`, duplicate });
        const ref = db.collection(COLLECTION).doc();
        await ref.set({ ...lead, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), createdBy: actor.userId || actor.uid, updatedBy: actor.userId || actor.uid });
        await writeAuditLog(db, request, actor, 'sales-ai:create', COLLECTION, ref.id, { label: `Создан лид AI-продаж: ${lead.name}`, score: lead.score, priority: lead.priority, source: lead.source });
        const saved = await ref.get();
        return reply.send({ ok: true, lead: { id: ref.id, ...serialize(saved.data() || {}) } });
      }

      if (action === 'update') {
        const id = cleanText(request.body?.id, 180);
        const ref = db.collection(COLLECTION).doc(id);
        const existing = await ref.get();
        if (!existing.exists) {
          const error = new Error('Лид не найден.');
          error.statusCode = 404;
          throw error;
        }
        const patch = sanitizeLead(request.body?.patch || {}, true);
        const merged = { ...(existing.data() || {}), ...patch };
        const duplicate = await findDuplicate(db, merged, id);
        if (duplicate) return reply.code(409).send({ ok: false, code: 'sales-ai/duplicate', error: `Изменение создаёт дубль: ${duplicate.name || duplicate.id}`, duplicate });
        await ref.set({ ...patch, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.userId || actor.uid }, { merge: true });
        await writeAuditLog(db, request, actor, 'sales-ai:update', COLLECTION, id, { label: `Обновлён лид AI-продаж: ${merged.name || id}`, fields: Object.keys(patch) });
        const saved = await ref.get();
        return reply.send({ ok: true, lead: { id, ...serialize(saved.data() || {}) } });
      }

      const error = new Error('Неизвестное действие AI-отдела продаж.');
      error.statusCode = 400;
      throw error;
    } catch (error) {
      return adminReplyError(reply, error);
    }
  });
}
