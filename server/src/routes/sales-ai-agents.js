import { FieldValue } from '../lib/documentValues.js';
import { getDb } from '../lib/documentStore.js';
import { adminReplyError, requireAdminPermission, writeAuditLog } from '../lib/adminSecurity.js';
import { analyzeLead, buildCommunicatorDraft, buildManagerSummary, buildSalesOffer, inferStageFromMessage } from '../lib/salesAgents.js';
import { availableOutreachChannels, sendSalesOutreach } from '../lib/salesOutreach.js';

const LEADS = 'salesLeads';
const MESSAGES = 'salesCommunications';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const serialize = value => {
  if (value == null) return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  return value;
};

async function getLead(db, id) {
  const ref = db.collection(LEADS).doc(clean(id, 180));
  const snap = await ref.get();
  if (!snap.exists) {
    const error = new Error('Лид не найден.');
    error.statusCode = 404;
    throw error;
  }
  return { ref, lead: { id: snap.id, ...serialize(snap.data() || {}) } };
}

async function listMessages(db, leadId = '') {
  const snap = await db.collection(MESSAGES).limit(2000).get();
  return snap.docs
    .map(doc => ({ id: doc.id, ...serialize(doc.data() || {}) }))
    .filter(row => !leadId || row.leadId === leadId)
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
}

export default async function salesAiAgentRoutes(fastify) {
  fastify.post('/api/sales-ai-agents', async (request, reply) => {
    const db = getDb();
    try {
      const action = clean(request.body?.action, 80);
      const readOnly = ['communication:list', 'manager:summary'].includes(action);
      const actor = await requireAdminPermission(request, readOnly ? 'partners:read' : 'partners:update');

      if (action === 'analyst:refresh') {
        const { ref, lead } = await getLead(db, request.body?.leadId);
        const analysis = analyzeLead(lead);
        await ref.set({ ...analysis, stage: lead.stage === 'discovered' ? 'qualified' : lead.stage, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.userId || actor.uid }, { merge: true });
        await writeAuditLog(db, request, actor, 'sales-ai:analyst-refresh', LEADS, lead.id, { label: `Аналитик пересчитал ${lead.name}`, score: analysis.score });
        return reply.send({ ok: true, analysis });
      }

      if (action === 'salesperson:refresh') {
        const { ref, lead } = await getLead(db, request.body?.leadId);
        const offerDraft = buildSalesOffer(lead);
        const stage = ['discovered', 'qualified'].includes(lead.stage) ? 'offer_ready' : lead.stage;
        await ref.set({ offerDraft, stage, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.userId || actor.uid }, { merge: true });
        await writeAuditLog(db, request, actor, 'sales-ai:salesperson-refresh', LEADS, lead.id, { label: `Продажник обновил оффер: ${lead.name}` });
        return reply.send({ ok: true, offerDraft, stage });
      }

      if (action === 'communication:list') {
        const leadId = clean(request.body?.leadId, 180);
        return reply.send({ ok: true, messages: await listMessages(db, leadId) });
      }

      if (action === 'communication:draft') {
        const { lead } = await getLead(db, request.body?.leadId);
        const messages = await listMessages(db, lead.id);
        const mode = request.body?.mode === 'followup' ? 'followup' : 'reply';
        const draft = buildCommunicatorDraft(lead, messages, mode);
        return reply.send({ ok: true, draft, mode });
      }

      if (action === 'communication:record') {
        const { ref: leadRef, lead } = await getLead(db, request.body?.leadId);
        const direction = request.body?.direction === 'inbound' ? 'inbound' : 'outbound';
        const channel = clean(request.body?.channel || 'manual', 40);
        const text = clean(request.body?.text, 8000);
        if (!text) {
          const error = new Error('Текст сообщения пуст.');
          error.statusCode = 400;
          throw error;
        }
        const messageRef = db.collection(MESSAGES).doc();
        await messageRef.set({
          leadId: lead.id,
          leadName: lead.name || '',
          direction,
          channel,
          text,
          createdAt: FieldValue.serverTimestamp(),
          createdBy: actor.userId || actor.uid,
        });
        const nextStage = inferStageFromMessage({ direction, text });
        const stage = lead.stage === 'won' ? 'won' : nextStage;
        await leadRef.set({ stage, lastCommunicationAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.userId || actor.uid }, { merge: true });
        await writeAuditLog(db, request, actor, 'sales-ai:communication-record', MESSAGES, messageRef.id, { label: `${direction === 'inbound' ? 'Входящее' : 'Исходящее'} сообщение: ${lead.name}`, channel, leadId: lead.id });
        const saved = await messageRef.get();
        return reply.send({ ok: true, message: { id: saved.id, ...serialize(saved.data() || {}) }, stage });
      }

      if (action === 'communication:channels') {
        const { lead } = await getLead(db, request.body?.leadId);
        return reply.send({ ok: true, channels: availableOutreachChannels(lead) });
      }

      if (action === 'communication:send') {
        const { ref: leadRef, lead } = await getLead(db, request.body?.leadId);
        if (['contacted', 'replied', 'meeting', 'won'].includes(lead.stage) && !request.body?.allowRepeat) {
          return reply.code(409).send({ ok: false, code: 'sales-ai/already-contacted', error: 'Лид уже отмечен как связанный. Повторная отправка остановлена.' });
        }
        const text = clean(request.body?.text || lead.offerDraft, 8000);
        const preferredChannel = ['auto', 'email', 'vk', 'telegram'].includes(request.body?.channel) ? request.body.channel : 'auto';
        const delivery = await sendSalesOutreach(lead, text, preferredChannel);
        const messageRef = db.collection(MESSAGES).doc();
        await messageRef.set({
          leadId: lead.id,
          leadName: lead.name || '',
          direction: 'outbound',
          channel: delivery.channel,
          text,
          providerMessageId: delivery.providerMessageId || '',
          deliveryStatus: 'sent',
          createdAt: FieldValue.serverTimestamp(),
          createdBy: actor.userId || actor.uid,
        });
        await leadRef.set({ stage: 'contacted', lastCommunicationAt: FieldValue.serverTimestamp(), lastOutreachChannel: delivery.channel, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.userId || actor.uid }, { merge: true });
        await writeAuditLog(db, request, actor, 'sales-ai:communication-send', MESSAGES, messageRef.id, { label: `Сообщение отправлено: ${lead.name}`, channel: delivery.channel, leadId: lead.id });
        return reply.send({ ok: true, delivery, stage: 'contacted' });
      }

      if (action === 'manager:summary') {
        const leadSnap = await db.collection(LEADS).limit(1000).get();
        const leads = leadSnap.docs.map(doc => ({ id: doc.id, ...serialize(doc.data() || {}) }));
        const messages = await listMessages(db);
        return reply.send({ ok: true, summary: buildManagerSummary(leads, messages) });
      }

      const error = new Error('Неизвестное действие агента AI-продаж.');
      error.statusCode = 400;
      throw error;
    } catch (error) {
      return adminReplyError(reply, error);
    }
  });
}
