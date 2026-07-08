import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../lib/firebase.js';

const TYPES = {
  partner: { label: 'Партнёр', emoji: '🤝' },
  expert: { label: 'Эксперт', emoji: '🧑‍💼' },
  event: { label: 'Событие', emoji: '🎉' },
  news: { label: 'Новость', emoji: '📢' },
  prize: { label: 'Приз', emoji: '🎁' },
};

function cleanText(value, max = 12000) {
  return String(value || '').replace(/\r/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().slice(0, max);
}

function lineValue(text, labels) {
  const lines = String(text || '').split('\n').map(line => line.trim()).filter(Boolean);
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const row = lines.find(line => new RegExp(`^${escaped}\\s*[:—-]\\s*`, 'i').test(line));
    if (row) return row.replace(new RegExp(`^${escaped}\\s*[:—-]\\s*`, 'i'), '').trim();
  }
  return '';
}

function normalizeUrl(value, platform = '') {
  const raw = cleanText(value, 500).normalize('NFKC').replace(/^@+/, '');
  if (!raw) return '';
  const hosts = { vk: 'vk.com', telegram: 't.me', max: 'max.ru' };
  if (platform && hosts[platform]) {
    const hostPattern = platform === 'vk' ? '(?:vk\\.com|vk\\.me|vkontakte\\.ru)' : platform === 'telegram' ? '(?:t\\.me|telegram\\.me)' : hosts[platform].replace('.', '\\.');
    const path = raw
      .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(new RegExp(`^${hostPattern}/?`, 'i'), '')
      .replace(/^@+/, '')
      .replace(/\s+/g, '');
    return path ? `https://${hosts[platform]}/${path}` : '';
  }
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

function detectCategory(text, type) {
  const q = String(text || '').toLowerCase();
  if (q.includes('маник') || q.includes('ногт') || q.includes('салон') || q.includes('красот')) return 'beauty';
  if (q.includes('кофе') || q.includes('кафе') || q.includes('ресторан') || q.includes('еда')) return 'food';
  if (q.includes('трен') || q.includes('фитнес') || q.includes('спорт')) return 'sport';
  if (q.includes('психолог') || q.includes('коуч')) return type === 'expert' ? 'psychology' : 'education';
  if (q.includes('здоров') || q.includes('массаж') || q.includes('врач')) return 'health';
  if (q.includes('афиша') || q.includes('концерт') || q.includes('театр')) return type === 'news' ? 'culture' : 'entertainment';
  return type === 'news' ? 'society' : 'other';
}

const LEGAL_ENTITY_TYPES = {
  company: 'ООО / юридическое лицо',
  entrepreneur: 'ИП',
  self_employed: 'Самозанятый',
  individual: 'Физическое лицо',
};

const LEGAL_REQUIRED_FIELDS = {
  company: ['fullName', 'inn', 'kpp', 'ogrn', 'legalAddress', 'checkingAccount', 'correspondentAccount', 'bik', 'bank', 'directorName', 'phone', 'email'],
  entrepreneur: ['fio', 'inn', 'ogrnip', 'address', 'checkingAccount', 'bank', 'bik', 'phone', 'email'],
  self_employed: ['fio', 'inn', 'phone', 'email'],
  individual: ['fio', 'phone', 'email'],
};

const LEGAL_FIELD_LIMITS = {
  comment: 3000,
  legalAddress: 1500,
  actualAddress: 1500,
  address: 1500,
  authorityBasis: 800,
};

function digits(value) {
  return cleanText(value, 80).replace(/\D/g, '');
}

function innChecksum(value) {
  const inn = digits(value);
  if (inn.length === 10) {
    const weights = [2, 4, 10, 3, 5, 9, 4, 6, 8];
    const check = weights.reduce((sum, weight, index) => sum + Number(inn[index]) * weight, 0) % 11 % 10;
    return check === Number(inn[9]);
  }
  if (inn.length === 12) {
    const weights11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    const weights12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    const check11 = weights11.reduce((sum, weight, index) => sum + Number(inn[index]) * weight, 0) % 11 % 10;
    const check12 = weights12.reduce((sum, weight, index) => sum + Number(inn[index]) * weight, 0) % 11 % 10;
    return check11 === Number(inn[10]) && check12 === Number(inn[11]);
  }
  return false;
}

function normalizeLegalProfile(raw) {
  const type = LEGAL_ENTITY_TYPES[raw?.type] ? raw.type : 'company';
  const fields = raw?.fields && typeof raw.fields === 'object' ? raw.fields : {};
  const cleaned = {};
  Object.entries(fields).forEach(([key, value]) => {
    const max = LEGAL_FIELD_LIMITS[key] || 500;
    cleaned[key] = cleanText(value, max);
  });
  ['inn', 'kpp', 'ogrn', 'ogrnip', 'bik', 'checkingAccount', 'correspondentAccount', 'cardNumber'].forEach(key => {
    if (cleaned[key]) cleaned[key] = digits(cleaned[key]);
  });
  cleaned.email = cleanText(cleaned.email, 180).toLowerCase();
  cleaned.website = normalizeUrl(cleaned.website);
  cleaned.myTaxLink = normalizeUrl(cleaned.myTaxLink);
  return { type, typeLabel: LEGAL_ENTITY_TYPES[type], fields: cleaned };
}

function analyzeLegalProfile(profile, documents) {
  const fields = profile.fields || {};
  const required = LEGAL_REQUIRED_FIELDS[profile.type] || [];
  const missingFields = required.filter(key => !fields[key]);
  const checks = [];
  const addCheck = (id, label, ok, message = '') => checks.push({ id, label, ok, message });

  if (fields.inn) addCheck('inn', 'ИНН', innChecksum(fields.inn), innChecksum(fields.inn) ? 'ИНН заполнен и прошёл контрольную проверку.' : 'Проверьте ИНН: контрольная сумма не совпадает.');
  else addCheck('inn', 'ИНН', false, 'ИНН не заполнен.');

  if (fields.kpp || profile.type === 'company') addCheck('kpp', 'КПП', profile.type !== 'company' || /^\d{9}$/.test(fields.kpp || ''), fields.kpp ? 'КПП заполнен.' : 'КПП нужен для ООО.');
  if (fields.ogrn || profile.type === 'company') addCheck('ogrn', 'ОГРН', profile.type !== 'company' || /^\d{13}$/.test(fields.ogrn || ''), fields.ogrn ? 'ОГРН заполнен.' : 'ОГРН нужен для ООО.');
  if (fields.ogrnip || profile.type === 'entrepreneur') addCheck('ogrnip', 'ОГРНИП', profile.type !== 'entrepreneur' || /^\d{15}$/.test(fields.ogrnip || ''), fields.ogrnip ? 'ОГРНИП заполнен.' : 'ОГРНИП нужен для ИП.');
  if (fields.bik || ['company', 'entrepreneur'].includes(profile.type)) addCheck('bik', 'БИК', /^\d{9}$/.test(fields.bik || ''), fields.bik ? 'БИК заполнен.' : 'БИК не заполнен.');
  if (fields.checkingAccount || ['company', 'entrepreneur'].includes(profile.type)) addCheck('checkingAccount', 'Расчётный счёт', /^\d{20}$/.test(fields.checkingAccount || ''), fields.checkingAccount ? 'Расчётный счёт заполнен.' : 'Расчётный счёт не заполнен.');
  if (fields.correspondentAccount || profile.type === 'company') addCheck('correspondentAccount', 'Корреспондентский счёт', profile.type !== 'company' || /^\d{20}$/.test(fields.correspondentAccount || ''), fields.correspondentAccount ? 'Корреспондентский счёт заполнен.' : 'Корреспондентский счёт не заполнен.');
  addCheck('documents', 'Документы', documents.length > 0, documents.length ? `Прикреплено документов: ${documents.length}.` : 'Документы не прикреплены.');

  const failed = checks.filter(item => !item.ok).map(item => item.id);
  return {
    status: missingFields.length || failed.length ? 'needs_review' : 'ready',
    score: Math.max(30, Math.min(100, 100 - missingFields.length * 8 - failed.length * 6)),
    missingFields: [...new Set(missingFields)],
    checks,
    recommendations: [
      missingFields.length ? `Заполнить: ${missingFields.join(', ')}` : '',
      documents.length ? '' : 'Прикрепить карточку предприятия или подтверждающие документы.',
      failed.includes('inn') ? 'Проверить ИНН перед подготовкой договора.' : '',
    ].filter(Boolean),
  };
}

function normalizeLegalDocuments(input) {
  return Array.isArray(input) ? input.slice(0, 12).map(file => ({
    name: cleanText(file.name, 180),
    type: cleanText(file.type, 120),
    size: Number(file.size || 0),
    url: normalizeUrl(file.url),
    documentType: cleanText(file.documentType, 60),
    documentLabel: cleanText(file.documentLabel, 120),
  })).filter(file => file.url && file.size > 0 && file.size <= 8 * 1024 * 1024) : [];
}

function buildCounterparty(type, draft, legalProfile, documents) {
  const fields = legalProfile.fields || {};
  return {
    type: legalProfile.type,
    typeLabel: legalProfile.typeLabel,
    displayName: fields.shortName || fields.fullName || fields.fio || draft.fields.title || 'Контрагент АПГ',
    publicName: draft.fields.title || '',
    status: `${TYPES[type]?.label || 'Участник'} АПГ`,
    inn: fields.inn || '',
    kpp: fields.kpp || '',
    ogrn: fields.ogrn || fields.ogrnip || '',
    directorName: fields.directorName || '',
    phone: fields.phone || '',
    email: fields.email || '',
    website: fields.website || '',
    documentsCount: documents.length,
    crmReady: true,
    future: {
      contracts: [],
      invoices: [],
      acts: [],
      commercialOffers: [],
      edo: { status: 'planned' },
    },
  };
}

function analyze(type, fields, files) {
  const sourceText = Object.entries(fields)
    .filter(([, value]) => cleanText(value))
    .map(([key, value]) => `${key}: ${cleanText(value)}`)
    .join('\n');
  const title = cleanText(fields.title || fields.name || lineValue(sourceText, ['Название', 'Заголовок', 'Имя']));
  const description = cleanText(fields.description || fields.fullDescription || fields.shortDescription || lineValue(sourceText, ['Описание', 'Подробное описание']));
  const draftFields = {
    title,
    category: cleanText(fields.category) || detectCategory(sourceText, type),
    shortDescription: cleanText(fields.shortDescription || description.split(/[.!?]\s/)[0]),
    description,
    address: cleanText(fields.address || fields.location),
    phone: cleanText(fields.phone),
    email: cleanText(fields.email),
    website: normalizeUrl(fields.website || fields.bookingUrl),
    telegram: normalizeUrl(fields.telegram, 'telegram'),
    vk: normalizeUrl(fields.vk, 'vk'),
    instagram: normalizeUrl(fields.instagram),
    hours: cleanText(fields.hours),
    services: cleanText(fields.services || fields.program),
    offer: cleanText(fields.offer || fields.bonus || fields.gift),
    cost: cleanText(fields.cost),
    date: cleanText(fields.date || fields.eventDate),
    source: cleanText(fields.source || fields.organizer || fields.provider),
    comment: cleanText(fields.comment, 3000),
  };
  const required = type === 'news' ? ['title', 'description'] : type === 'event' ? ['title', 'date', 'description'] : ['title', 'description'];
  const missingFields = required.filter(key => !draftFields[key]);
  if ((type === 'partner' || type === 'expert') && !draftFields.phone && !draftFields.website && !draftFields.telegram && !draftFields.vk) missingFields.push('contact');
  if ((type === 'partner' || type === 'expert') && !files.length) missingFields.push('photo');
  const filled = Object.values(draftFields).filter(Boolean).length;
  const confidence = Math.max(45, Math.min(96, 56 + filled * 4 - missingFields.length * 8 + (files.length ? 6 : 0)));
  return {
    type,
    fields: draftFields,
    confidence,
    fieldConfidence: Object.fromEntries(Object.entries(draftFields).map(([key, value]) => [key, value ? Math.min(98, confidence + 5) : 0])),
    missingFields: [...new Set(missingFields)],
    status: missingFields.length ? 'missing' : 'processed',
    suggestions: [
      draftFields.phone || draftFields.website || draftFields.telegram ? null : 'Добавить контакт для связи или записи',
      files.length ? null : 'Добавить хотя бы одну фотографию',
      draftFields.offer ? null : 'Уточнить бонус или акцию для пользователей АПГ',
    ].filter(Boolean),
  };
}

async function findLink(db, token) {
  const snap = await db.collection('publicFormLinks').where('token', '==', token).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ref: doc.ref, data: doc.data() || {} };
}

function linkError(message, code = 400) {
  const error = new Error(message);
  error.statusCode = code;
  return error;
}

function assertLinkAvailable(link) {
  if (!link) throw linkError('Ссылка не найдена или уже отключена.', 404);
  const data = link.data || {};
  if (!TYPES[data.type]) throw linkError('Тип формы недоступен.', 400);
  if (data.status === 'disabled') throw linkError('Эта ссылка отключена администратором.', 410);
  if (data.status === 'submitted' || data.status === 'published') throw linkError('Эта заявка уже отправлена. Попросите администратора выдать новую ссылку.', 409);
  const expiresAt = data.expiresAt?.toDate?.() || (data.expiresAt ? new Date(data.expiresAt) : null);
  if (expiresAt && expiresAt.getTime() < Date.now()) throw linkError('Срок действия ссылки истёк.', 410);
}

export default async function publicSubmitRoutes(fastify) {
  fastify.get('/api/public-submit', async (request, reply) => {
    const db = getDb();
    try {
      const token = cleanText(request.query?.token, 80);
      if (!/^[a-zA-Z0-9_-]{6,80}$/.test(token)) throw linkError('Некорректная ссылка.', 400);
      const link = await findLink(db, token);
      assertLinkAvailable(link);
      await link.ref.set({ openedAt: FieldValue.serverTimestamp(), openedCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
      const type = link.data.type;
      return { ok: true, token, type, typeLabel: TYPES[type].label, title: link.data.title || '', status: link.data.status || 'active', expiresAt: link.data.expiresAt || null };
    } catch (error) {
      request.log.error({ err: error?.message, code: error?.statusCode || 500 }, 'public-submit get failed');
      return reply.code(error?.statusCode || 500).send({ ok: false, error: error?.message || 'Не удалось открыть форму.' });
    }
  });

  fastify.post('/api/public-submit', async (request, reply) => {
    const db = getDb();
    try {
      const token = cleanText(request.body?.token, 80);
      if (!/^[a-zA-Z0-9_-]{6,80}$/.test(token)) throw linkError('Некорректная ссылка.', 400);
      const link = await findLink(db, token);
      assertLinkAvailable(link);
      const fields = request.body?.fields && typeof request.body.fields === 'object' ? request.body.fields : {};
      const files = Array.isArray(request.body?.files) ? request.body.files.slice(0, 12).map(file => ({
        name: cleanText(file.name, 180),
        type: cleanText(file.type, 80),
        size: Number(file.size || 0),
        url: normalizeUrl(file.url),
        role: cleanText(file.role, 40),
      })).filter(file => file.url && file.size <= 8 * 1024 * 1024) : [];
      const type = link.data.type;
      const draft = analyze(type, fields, files);
      const legalDocuments = normalizeLegalDocuments(request.body?.legalDocuments);
      const legalProfile = normalizeLegalProfile(request.body?.legalProfile);
      const legalCheck = analyzeLegalProfile(legalProfile, legalDocuments);
      const counterparty = buildCounterparty(type, draft, legalProfile, legalDocuments);
      const meta = TYPES[type];
      const sourceText = Object.entries(fields).map(([key, value]) => `${key}: ${cleanText(value, 4000)}`).join('\n');
      const now = FieldValue.serverTimestamp();
      const requestRef = await db.collection('aiImportRequests').add({
        type,
        typeLabel: meta.label,
        title: draft.fields.title || link.data.title || 'Публичная заявка',
        status: draft.status,
        source: 'public-form',
        sourceText: sourceText.slice(0, 20000),
        sourceFiles: files,
        draft,
        legalProfile,
        legalDocuments,
        legalCheck,
        counterparty,
        crm: {
          lifecycleStage: 'new_public_submission',
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
        confidence: draft.confidence,
        missingFields: draft.missingFields,
        legalMissingFields: legalCheck.missingFields,
        publicFormLinkId: link.id,
        publicTokenPrefix: token.slice(0, 6),
        submitter: {
          name: cleanText(fields.contactName || fields.name, 160),
          email: cleanText(fields.email, 180),
          phone: cleanText(fields.phone, 80),
        },
        createdAt: now,
        updatedAt: now,
        submittedAt: now,
        processedAt: now,
      });
      await link.ref.set({
        status: 'submitted',
        submittedAt: FieldValue.serverTimestamp(),
        submittedRequestId: requestRef.id,
        submittedCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return { ok: true, id: requestRef.id, status: draft.status, missingFields: draft.missingFields, legalCheck, confidence: draft.confidence };
    } catch (error) {
      request.log.error({ err: error?.message, code: error?.statusCode || 500 }, 'public-submit post failed');
      return reply.code(error?.statusCode || 500).send({ ok: false, error: error?.message || 'Не удалось обработать заявку.' });
    }
  });
}
