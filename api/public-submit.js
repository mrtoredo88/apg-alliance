import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './_firebase-admin.js';

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

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-APG-Version');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const db = getAdminDb();
  try {
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
      confidence: draft.confidence,
      missingFields: draft.missingFields,
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
    return res.status(200).json({ ok: true, id: requestRef.id, status: draft.status, missingFields: draft.missingFields, confidence: draft.confidence });
  } catch (error) {
    const code = error?.statusCode || 500;
    console.error('[public-submit] failed', { code, message: error?.message });
    return res.status(code).json({ ok: false, error: error?.message || 'Не удалось обработать заявку.' });
  }
}
