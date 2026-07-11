import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../lib/firebase.js';
import { analyzePublicSubmission } from './public-submit.js';

const TYPES = {
  partner: { label: 'Партнёр', emoji: '🤝' },
  expert: { label: 'Эксперт', emoji: '🧑‍💼' },
};

const ALLOWED_EVENTS = new Set([
  'partnership_page_opened',
  'partnership_tariff_selected',
  'partnership_form_started',
  'partnership_application_submitted',
]);

function cleanText(value, max = 12000) {
  return String(value || '').replace(/\r/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().slice(0, max);
}

function normalizeUrl(value) {
  const raw = cleanText(value, 500).normalize('NFKC');
  if (!raw) return '';
  const next = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(next);
    if (!/^https?:$/i.test(url.protocol)) return '';
    url.hostname = url.hostname.replace(/^www\./i, '');
    return url.toString();
  } catch {
    return '';
  }
}

function cleanUser(value) {
  const user = value && typeof value === 'object' ? value : {};
  return {
    id: cleanText(user.id, 160),
    name: cleanText(user.name || user.displayName, 180),
    email: cleanText(user.email, 180).toLowerCase(),
  };
}

function cleanFiles(value) {
  return Array.isArray(value) ? value.slice(0, 12).map(file => ({
    name: cleanText(file.name, 180),
    type: cleanText(file.type, 80),
    size: Number(file.size || 0),
    url: normalizeUrl(file.url),
    role: cleanText(file.role, 40),
  })).filter(file => file.url && file.size <= 8 * 1024 * 1024) : [];
}

function cleanPayload(value) {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value).slice(0, 24).map(([key, item]) => [
    cleanText(key, 80),
    typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean' || item == null
      ? item
      : cleanText(JSON.stringify(item), 1200),
  ]));
}

async function writeAnalytics(db, event, body, extra = {}) {
  if (!ALLOWED_EVENTS.has(event)) return;
  await db.collection('partnershipAnalytics').add({
    event,
    payload: cleanPayload(body?.payload),
    user: cleanUser(body?.user),
    source: 'profile-partnership-flow',
    userAgent: cleanText(body?.userAgent, 400),
    ...extra,
    createdAt: FieldValue.serverTimestamp(),
  }).catch(() => {});
}

export default async function partnershipApplicationRoutes(fastify) {
  fastify.post('/api/partnership-application', async (request, reply) => {
    const db = getDb();
    try {
      const action = cleanText(request.body?.action, 40);
      if (action === 'track') {
        const event = cleanText(request.body?.event, 80);
        await writeAnalytics(db, event, request.body);
        return { ok: true };
      }

      const type = cleanText(request.body?.type, 40);
      if (!TYPES[type]) return reply.code(400).send({ ok: false, error: 'Некорректный тип заявки.' });
      const fields = request.body?.fields && typeof request.body.fields === 'object' ? request.body.fields : {};
      const files = cleanFiles(request.body?.files);
      const draft = analyzePublicSubmission(type, fields, files);
      const meta = TYPES[type];
      const now = FieldValue.serverTimestamp();
      const user = cleanUser(request.body?.user);
      const sourceText = Object.entries(fields).map(([key, value]) => `${key}: ${cleanText(value, 4000)}`).join('\n');
      const requestRef = await db.collection('aiImportRequests').add({
        type,
        typeLabel: meta.label,
        title: draft.fields.title || fields.title || 'Заявка на партнёрство',
        status: draft.status,
        source: 'partnership-flow',
        sourceLabel: 'Заявка на партнёрство из профиля',
        sourceText: sourceText.slice(0, 20000),
        sourceFiles: files,
        draft,
        confidence: draft.confidence,
        missingFields: draft.missingFields,
        moderationStatus: 'new_partnership_application',
        partnershipFlow: {
          step: 'submitted',
          type,
          tariff: cleanText(fields.tariff, 40),
          source: 'profile',
        },
        submitter: {
          userId: user.id,
          name: cleanText(fields.contactName || fields.name || user.name, 180),
          email: cleanText(fields.email || user.email, 180),
          phone: cleanText(fields.phone, 80),
        },
        user,
        crm: {
          lifecycleStage: 'new_partnership_application',
          responsible: 'admin',
          comments: [],
          interactions: [],
          meetings: [],
          tasks: [],
          contracts: [],
          invoices: [],
          acts: [],
          commercialOffers: [],
          edo: { status: 'planned' },
        },
        createdAt: now,
        updatedAt: now,
        submittedAt: now,
        processedAt: now,
      });
      await writeAnalytics(db, 'partnership_application_submitted', request.body, { requestId: requestRef.id, type });
      return { ok: true, id: requestRef.id, status: draft.status, missingFields: draft.missingFields, confidence: draft.confidence };
    } catch (error) {
      request.log.error({ err: error?.message }, 'partnership-application failed');
      return reply.code(500).send({ ok: false, error: 'Не удалось обработать заявку.' });
    }
  });
}
