import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './_firebase-admin.js';

const TYPES = {
  partner: { label: 'Партнёр', emoji: '🤝' },
  expert: { label: 'Эксперт', emoji: '🧑‍💼' },
  event: { label: 'Событие', emoji: '🎉' },
  news: { label: 'Новость', emoji: '📢' },
  prize: { label: 'Приз', emoji: '🎁' },
};

const PARTNER_TARIFFS = ['start', 'alliance', 'premium'];
const EXPERT_TARIFFS = ['practice', 'ambassador'];

function normalizePartnerTariff(value) {
  const id = cleanText(value, 30).toLowerCase();
  if (id === 'старт') return 'start';
  if (id === 'альянс') return 'alliance';
  if (id === 'премиум') return 'premium';
  return PARTNER_TARIFFS.includes(id) ? id : 'start';
}

function normalizeExpertTariff(value) {
  const id = cleanText(value, 30).toLowerCase();
  if (id === 'практика') return 'practice';
  if (id === 'амбассадор') return 'ambassador';
  if (id === 'premium') return 'ambassador';
  if (id === 'standard' || id === 'basic' || id === 'start') return 'practice';
  return EXPERT_TARIFFS.includes(id) ? id : 'practice';
}

function cleanText(value, max = 12000) {
  return String(value || '').replace(/\r/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().slice(0, max);
}

function cleanList(value, maxItems = 12, maxLength = 500) {
  return (Array.isArray(value) ? value : []).slice(0, maxItems).map(item => typeof item === 'object' ? item : cleanText(item, maxLength)).filter(Boolean);
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
  company: ['fullName', 'inn', 'kpp', 'ogrn', 'legalAddress', 'checkingAccount', 'bank', 'bik', 'directorName'],
  entrepreneur: ['fio', 'inn', 'ogrnip', 'checkingAccount', 'bank', 'bik'],
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

function normalizeLegalProfile(raw, publicFields = {}, cooperationPlan = 'not_now') {
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
  const provided = Boolean(raw?.expanded || Object.values(fields).some(value => cleanText(value)));
  cleaned.inn = cleaned.inn || digits(publicFields.inn);
  cleaned.phone = cleaned.phone || cleanText(publicFields.phone, 80);
  cleaned.email = cleaned.email || cleanText(publicFields.email, 180).toLowerCase();
  cleaned.contactName = cleaned.contactName || cleanText(publicFields.contactName, 160);
  return { type, typeLabel: LEGAL_ENTITY_TYPES[type], cooperationPlan, provided, fields: cleaned };
}

function analyzeLegalProfile(profile, documents) {
  const fields = profile.fields || {};
  if (!profile.provided && profile.cooperationPlan !== 'paid') {
    return {
      status: 'not_required',
      statusLabel: 'Юридические данные не требуются',
      score: 100,
      missingFields: [],
      checks: [],
      recommendations: ['Партнёр размещает бесплатную карточку. Юридические данные сейчас не требуются.'],
    };
  }
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
    status: missingFields.length || failed.length ? 'partial' : 'contract_ready',
    statusLabel: missingFields.length || failed.length ? 'Юридические данные заполнены частично' : 'Полностью готов к заключению договора',
    score: Math.max(30, Math.min(100, 100 - missingFields.length * 8 - failed.length * 6)),
    missingFields: [...new Set(missingFields)],
    checks,
    recommendations: [
      missingFields.length ? `Заполнить: ${missingFields.join(', ')}` : '',
      documents.length || profile.type === 'self_employed' ? '' : 'Прикрепить карточку предприятия или подтверждающие документы.',
      failed.includes('inn') ? 'Проверить ИНН перед подготовкой договора.' : '',
      profile.cooperationPlan === 'paid' ? 'Партнёр планирует платное сотрудничество. Рекомендуется довести реквизиты до статуса готовности к договору.' : '',
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
    cooperationPlan: legalProfile.cooperationPlan || 'not_now',
    cooperationStatus: legalProfile.cooperationPlan === 'paid' ? 'paid_planned' : 'free_card',
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
  const partnerTariff = normalizePartnerTariff(fields.tariff);
  const expertTariff = normalizeExpertTariff(fields.tariff);
  const isPartnerPremium = type === 'partner' && partnerTariff === 'premium';
  const isPartnerAlliance = type === 'partner' && ['alliance', 'premium'].includes(partnerTariff);
  const isExpertAmbassador = type === 'expert' && expertTariff === 'ambassador';
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
    inn: (isPartnerPremium || isExpertAmbassador || !['partner', 'expert'].includes(type)) ? digits(fields.inn) : '',
    city: cleanText(fields.city),
    video: isPartnerAlliance || !['partner', 'expert'].includes(type) ? normalizeUrl(fields.video) : '',
    newsInfo: (isPartnerPremium || isExpertAmbassador || !['partner', 'expert'].includes(type)) ? cleanText(fields.newsInfo, 3000) : '',
    activities: (isPartnerPremium || isExpertAmbassador || !['partner', 'expert'].includes(type)) ? cleanText(fields.activities, 3000) : '',
    instagram: normalizeUrl(fields.instagram),
    hours: cleanText(fields.hours),
    services: cleanText(fields.services || fields.program),
    offer: cleanText(fields.offer || fields.bonus || fields.gift),
    cost: cleanText(fields.cost),
    date: cleanText(fields.date || fields.eventDate),
    source: cleanText(fields.source || fields.organizer || fields.provider),
    comment: cleanText(fields.comment, 3000),
    firstName: cleanText(fields.firstName, 100),
    lastName: cleanText(fields.lastName, 100),
    middleName: cleanText(fields.middleName, 100),
    categories: cleanList(fields.categories, 6, 80),
    secondaryCategories: cleanList(fields.secondaryCategories, 5, 80),
    workFormats: cleanList(fields.workFormats, 12, 80),
    audienceTags: cleanList(fields.audienceTags, 12, 80),
    videos: (isPartnerAlliance || type === 'expert') ? cleanList(fields.videos, 6) : [],
    bookingUrl: (isPartnerAlliance || type === 'expert') ? normalizeUrl(fields.bookingUrl) : '',
    max: normalizeUrl(fields.max, 'max'),
    otherSocials: cleanList(fields.otherSocials, 10).map(value => normalizeUrl(value)).filter(Boolean),
    tariff: type === 'expert' ? expertTariff : type === 'partner' ? partnerTariff : cleanText(fields.tariff, 30),
    serviceCatalog: [],
    futureServiceCatalog: { enabled: false, items: [], bookingEnabled: false, paymentEnabled: false, packagesEnabled: false },
    futureScheduleProfile: { calendarEnabled: false, timetableEnabled: false },
    futureLegalProfile: { legalType: '', ogrn: '', bik: '', checkingAccount: '' },
    futureCityProfile: { cityId: '', cityName: '' },
  };
  const required = type === 'expert' ? ['title', 'shortDescription', 'phone', 'email'] : type === 'partner' ? ['title', 'category', 'shortDescription', 'description', 'phone', 'email'] : type === 'news' ? ['title', 'description', 'inn', 'city'] : type === 'event' ? ['title', 'date', 'description', 'inn', 'city'] : ['title', 'description', 'inn', 'city'];
  if (type === 'expert' && !draftFields.categories.length) required.push('categories');
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

export { analyze as analyzePublicSubmission };

const PARTNERSHIP_EVENTS = new Set([
  'partnership_page_opened',
  'partnership_tariff_selected',
  'partnership_form_started',
  'partnership_application_submitted',
]);

function cleanPartnershipUser(value) {
  const user = value && typeof value === 'object' ? value : {};
  return {
    id: cleanText(user.id, 160),
    name: cleanText(user.name || user.displayName, 180),
    email: cleanText(user.email, 180).toLowerCase(),
  };
}

function cleanPartnershipPayload(value) {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value).slice(0, 24).map(([key, item]) => [
    cleanText(key, 80),
    typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean' || item == null
      ? item
      : cleanText(JSON.stringify(item), 1200),
  ]));
}

function cleanPartnershipFiles(value) {
  return Array.isArray(value) ? value.slice(0, 12).map(file => ({
    name: cleanText(file.name, 180),
    type: cleanText(file.type, 80),
    size: Number(file.size || 0),
    url: normalizeUrl(file.url),
    role: cleanText(file.role, 40),
  })).filter(file => file.url && file.size <= 8 * 1024 * 1024) : [];
}

async function writePartnershipAnalytics(db, event, body, extra = {}) {
  if (!PARTNERSHIP_EVENTS.has(event)) return;
  await db.collection('partnershipAnalytics').add({
    event,
    payload: cleanPartnershipPayload(body?.payload),
    user: cleanPartnershipUser(body?.user),
    source: 'profile-partnership-flow',
    ...extra,
    createdAt: FieldValue.serverTimestamp(),
  }).catch(() => {});
}

async function handlePartnershipSubmit(db, body) {
  const type = cleanText(body?.type, 40);
  if (!['partner', 'expert'].includes(type)) throw linkError('Некорректный тип заявки.', 400);
  const fields = body?.fields && typeof body.fields === 'object' ? body.fields : {};
  const files = cleanPartnershipFiles(body?.files);
  const draft = analyze(type, fields, files);
  const meta = TYPES[type];
  const now = FieldValue.serverTimestamp();
  const user = cleanPartnershipUser(body?.user);
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
  await writePartnershipAnalytics(db, 'partnership_application_submitted', body, { requestId: requestRef.id, type });
  return { ok: true, id: requestRef.id, status: draft.status, missingFields: draft.missingFields, confidence: draft.confidence };
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

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-APG-Version');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const db = getAdminDb();
  try {
    const action = cleanText(req.body?.action, 40);
    if (req.method === 'POST' && action === 'track-partnership') {
      await writePartnershipAnalytics(db, cleanText(req.body?.event, 80), req.body);
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'POST' && action === 'partnership-submit') {
      const result = await handlePartnershipSubmit(db, req.body);
      return res.status(200).json(result);
    }

    const token = cleanText(req.method === 'GET' ? req.query?.token : req.body?.token, 80);
    if (!/^[a-zA-Z0-9_-]{6,80}$/.test(token)) throw linkError('Некорректная ссылка.', 400);
    const link = await findLink(db, token);
    assertLinkAvailable(link);

    if (req.method === 'GET') {
      await link.ref.set({ openedAt: FieldValue.serverTimestamp(), openedCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
      const type = link.data.type;
      return res.status(200).json({ ok: true, token, type, typeLabel: TYPES[type].label, title: link.data.title || '', status: link.data.status || 'active', expiresAt: link.data.expiresAt || null });
    }

    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const fields = req.body?.fields && typeof req.body.fields === 'object' ? req.body.fields : {};
    const files = Array.isArray(req.body?.files) ? req.body.files.slice(0, 12).map(file => ({
      name: cleanText(file.name, 180),
      type: cleanText(file.type, 80),
      size: Number(file.size || 0),
      url: normalizeUrl(file.url),
      role: cleanText(file.role, 40),
    })).filter(file => file.url && file.size <= 8 * 1024 * 1024) : [];
    const type = link.data.type;
    const draft = analyze(type, fields, files);
    const legalDocuments = normalizeLegalDocuments(req.body?.legalDocuments);
    const cooperationPlan = cleanText(req.body?.cooperationPlan, 40) === 'paid' ? 'paid' : 'not_now';
    const legalProfile = normalizeLegalProfile(req.body?.legalProfile, fields, cooperationPlan);
    const legalCheck = analyzeLegalProfile(legalProfile, legalDocuments);
    const counterparty = buildCounterparty(type, draft, legalProfile, legalDocuments);
    const cooperationStatus = legalCheck.status === 'contract_ready'
      ? 'contract_ready'
      : legalCheck.status === 'partial'
        ? 'legal_partial'
        : cooperationPlan === 'paid'
          ? 'legal_recommended'
          : 'legal_not_required';
    const lokiCooperationNote = cooperationPlan === 'paid'
      ? 'Партнёр планирует платное сотрудничество. Рекомендуется запросить или проверить реквизиты для оформления документов.'
      : 'Партнёр размещает бесплатную карточку. Юридические данные сейчас не требуются.';
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
      cooperationPlan,
      cooperationStatus,
      lokiCooperationNote,
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
    return res.status(200).json({ ok: true, id: requestRef.id, status: draft.status, missingFields: draft.missingFields, legalCheck, confidence: draft.confidence });
  } catch (error) {
    const code = error?.statusCode || 500;
    console.error('[public-submit] failed', { code, message: error?.message });
    return res.status(code).json({ ok: false, error: error?.message || 'Не удалось обработать заявку.' });
  }
}
