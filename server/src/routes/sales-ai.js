import { FieldValue } from '../lib/documentValues.js';
import { getDb } from '../lib/documentStore.js';
import { adminReplyError, requireAdminPermission, writeAuditLog } from '../lib/adminSecurity.js';
import { runSalesScout } from '../lib/salesScout.js';

const COLLECTION = 'salesLeads';
const SCOUT_CANDIDATES = 'salesScoutCandidates';
const SCOUT_RUNS = 'salesScoutRuns';
const STAGES = new Set(['discovered', 'qualified', 'offer_ready', 'contacted', 'replied', 'meeting', 'won', 'lost']);
const PRIORITIES = new Set(['high', 'medium', 'low']);
const CANDIDATE_STATUSES = new Set(['pending', 'approved', 'dismissed', 'duplicate']);

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
  for (const key of ['name', 'category', 'city', 'district', 'contact', 'source', 'email', 'telegramChatId', 'vkPeerId']) {
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
  if (!update || Object.prototype.hasOwnProperty.call(input, 'confidence')) out.confidence = Math.max(0, Math.min(1, Number(input.confidence) || 0));
  if (!update || Object.prototype.hasOwnProperty.call(input, 'evidence')) out.evidence = sanitizeEvidence(input.evidence);
  return out;
}

function sanitizeEvidence(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map(item => ({
    field: cleanText(item?.field, 120),
    value: cleanText(item?.value, 1000),
    sourceUrl: cleanUrl(item?.sourceUrl),
    confidence: Math.max(0, Math.min(1, Number(item?.confidence) || 0)),
  })).filter(item => item.field && item.value);
}

function sanitizeScoutCandidate(input = {}) {
  return {
    name: cleanText(input.name, 180),
    category: cleanText(input.category || 'other', 80),
    city: cleanText(input.city || 'Зеленоград', 120),
    district: cleanText(input.district, 120),
    website: cleanUrl(input.website),
    vk: cleanUrl(input.vk),
    telegram: cleanUrl(input.telegram),
    source: cleanText(input.source || 'scout', 120),
    sourceUrl: cleanUrl(input.sourceUrl),
    snippet: cleanText(input.snippet, 800),
    confidence: Math.max(0, Math.min(1, Number(input.confidence) || 0)),
    evidence: sanitizeEvidence(input.evidence),
    scout: {
      provider: cleanText(input?.scout?.provider, 80),
      query: cleanText(input?.scout?.query, 500),
    },
  };
}

function fingerprint(value) {
  return cleanText(value, 1000).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

function sameCandidate(left = {}, right = {}) {
  const leftWebsite = fingerprint(left.website || left.sourceUrl);
  const rightWebsite = fingerprint(right.website || right.sourceUrl);
  if (leftWebsite && leftWebsite === rightWebsite) return true;
  if (left.vk && fingerprint(left.vk) === fingerprint(right.vk)) return true;
  if (left.telegram && fingerprint(left.telegram) === fingerprint(right.telegram)) return true;
  return fingerprint(left.name) && fingerprint(left.name) === fingerprint(right.name)
    && fingerprint(left.city) === fingerprint(right.city);
}

async function findDuplicate(db, candidate, excludeId = '') {
  const snap = await db.collection(COLLECTION).limit(1000).get();
  for (const doc of snap.docs) {
    if (doc.id === excludeId) continue;
    const row = doc.data() || {};
    if (sameCandidate(row, candidate)) return { id: doc.id, ...serialize(row) };
  }
  return null;
}

async function listScoutCandidates(db, status = 'pending') {
  const snap = await db.collection(SCOUT_CANDIDATES).limit(500).get();
  return snap.docs
    .map(doc => ({ id: doc.id, ...serialize(doc.data() || {}) }))
    .filter(item => !status || item.status === status)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

async function createLead(db, request, actor, input, auditAction = 'sales-ai:create') {
  const lead = sanitizeLead(input || {});
  if (!lead.name) {
    const error = new Error('Укажите название компании.');
    error.statusCode = 400;
    throw error;
  }
  const duplicate = await findDuplicate(db, lead);
  if (duplicate) return { duplicate };
  const ref = db.collection(COLLECTION).doc();
  await ref.set({
    ...lead,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: actor.userId || actor.uid,
    updatedBy: actor.userId || actor.uid,
  });
  await writeAuditLog(db, request, actor, auditAction, COLLECTION, ref.id, {
    label: `Создан лид AI-продаж: ${lead.name}`,
    score: lead.score,
    priority: lead.priority,
    source: lead.source,
  });
  const saved = await ref.get();
  return { lead: { id: ref.id, ...serialize(saved.data() || {}) } };
}

export default async function salesAiRoutes(fastify) {
  fastify.post('/api/sales-ai', async (request, reply) => {
    const db = getDb();
    try {
      const action = String(request.body?.action || 'list');
      const readOnly = ['list', 'scout:list'].includes(action);
      const actor = await requireAdminPermission(request, readOnly ? 'partners:read' : 'partners:update');

      if (action === 'list') {
        const snap = await db.collection(COLLECTION).limit(1000).get();
        const leads = snap.docs.map(doc => ({ id: doc.id, ...serialize(doc.data() || {}) }))
          .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
        return reply.send({ ok: true, leads });
      }

      if (action === 'create') {
        const result = await createLead(db, request, actor, request.body?.lead || {});
        if (result.duplicate) return reply.code(409).send({ ok: false, code: 'sales-ai/duplicate', error: `Похожий лид уже существует: ${result.duplicate.name || result.duplicate.id}`, duplicate: result.duplicate });
        return reply.send({ ok: true, lead: result.lead });
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

      if (action === 'scout:list') {
        const status = cleanText(request.body?.status || 'pending', 40);
        const candidates = await listScoutCandidates(db, CANDIDATE_STATUSES.has(status) ? status : 'pending');
        return reply.send({ ok: true, candidates });
      }

      if (action === 'scout:search') {
        const task = {
          city: cleanText(request.body?.task?.city || 'Зеленоград', 120),
          district: cleanText(request.body?.task?.district, 120),
          category: cleanText(request.body?.task?.category || 'other', 80),
          query: cleanText(request.body?.task?.query, 300),
          limit: Math.max(1, Math.min(50, Number(request.body?.task?.limit) || 20)),
        };
        const runRef = db.collection(SCOUT_RUNS).doc();
        await runRef.set({ task, status: 'running', actorId: actor.userId || actor.uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        try {
          const result = await runSalesScout(task);
          const existingPending = await listScoutCandidates(db, 'pending');
          const savedCandidates = [];
          let skippedDuplicates = 0;
          for (const raw of result.candidates) {
            const candidate = sanitizeScoutCandidate(raw);
            if (!candidate.name || !candidate.sourceUrl) continue;
            const leadDuplicate = await findDuplicate(db, candidate);
            const queueDuplicate = existingPending.some(item => sameCandidate(item, candidate)) || savedCandidates.some(item => sameCandidate(item, candidate));
            if (leadDuplicate || queueDuplicate) {
              skippedDuplicates += 1;
              continue;
            }
            const ref = db.collection(SCOUT_CANDIDATES).doc();
            await ref.set({
              ...candidate,
              status: 'pending',
              runId: runRef.id,
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
              createdBy: actor.userId || actor.uid,
            });
            const saved = await ref.get();
            savedCandidates.push({ id: ref.id, ...serialize(saved.data() || {}) });
          }
          await runRef.set({ status: 'completed', provider: result.provider, query: result.query, found: result.candidates.length, queued: savedCandidates.length, skippedDuplicates, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          await writeAuditLog(db, request, actor, 'sales-ai:scout-search', SCOUT_RUNS, runRef.id, { label: `Scout: ${task.city}, ${task.category}`, found: result.candidates.length, queued: savedCandidates.length, skippedDuplicates, provider: result.provider });
          return reply.send({ ok: true, runId: runRef.id, provider: result.provider, query: result.query, candidates: savedCandidates, skippedDuplicates });
        } catch (error) {
          await runRef.set({ status: 'failed', error: cleanText(error?.message, 500), code: cleanText(error?.code, 120), updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
          throw error;
        }
      }

      if (action === 'scout:dismiss') {
        const id = cleanText(request.body?.id, 180);
        const ref = db.collection(SCOUT_CANDIDATES).doc(id);
        const snap = await ref.get();
        if (!snap.exists) {
          const error = new Error('Кандидат Scout не найден.');
          error.statusCode = 404;
          throw error;
        }
        await ref.set({ status: 'dismissed', dismissedAt: FieldValue.serverTimestamp(), dismissedBy: actor.userId || actor.uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        await writeAuditLog(db, request, actor, 'sales-ai:scout-dismiss', SCOUT_CANDIDATES, id, { label: `Scout-кандидат отклонён: ${snap.data()?.name || id}` });
        return reply.send({ ok: true, id });
      }

      if (action === 'scout:approve') {
        const id = cleanText(request.body?.id, 180);
        const candidateRef = db.collection(SCOUT_CANDIDATES).doc(id);
        const candidateSnap = await candidateRef.get();
        if (!candidateSnap.exists) {
          const error = new Error('Кандидат Scout не найден.');
          error.statusCode = 404;
          throw error;
        }
        const candidate = candidateSnap.data() || {};
        if (candidate.status !== 'pending') {
          const error = new Error('Этот кандидат уже обработан.');
          error.statusCode = 409;
          throw error;
        }
        const prepared = { ...candidate, ...(request.body?.lead || {}), source: candidate.source || 'scout', sourceUrl: candidate.sourceUrl, confidence: candidate.confidence, evidence: candidate.evidence };
        const result = await createLead(db, request, actor, prepared, 'sales-ai:scout-approve');
        if (result.duplicate) {
          await candidateRef.set({ status: 'duplicate', duplicateLeadId: result.duplicate.id, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          return reply.code(409).send({ ok: false, code: 'sales-ai/duplicate', error: `Похожий лид уже существует: ${result.duplicate.name || result.duplicate.id}`, duplicate: result.duplicate });
        }
        await candidateRef.set({ status: 'approved', leadId: result.lead.id, approvedAt: FieldValue.serverTimestamp(), approvedBy: actor.userId || actor.uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        return reply.send({ ok: true, lead: result.lead, candidateId: id });
      }

      const error = new Error('Неизвестное действие AI-отдела продаж.');
      error.statusCode = 400;
      throw error;
    } catch (error) {
      return adminReplyError(reply, error);
    }
  });
}
