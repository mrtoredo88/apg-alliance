import { normalizeText, titleOf } from '../lokiCoreUtils.js';

const ORDINALS = [
  ['перв', 0],
  ['втор', 1],
  ['трет', 2],
  ['четвер', 3],
  ['пят', 4],
  ['последн', -1],
];

const PRONOUNS = ['он', 'она', 'оно', 'они', 'этот', 'эта', 'это', 'эти', 'тот', 'та', 'там', 'туда', 'сюда', 'здесь'];
const FOLLOW_UP_WORDS = ['а ', 'и ', 'еще', 'ещё', 'завтра', 'сегодня', 'вечером', 'поближе', 'ближе', 'дешевле', 'дороже', 'работает', 'открыт', 'открой', 'запиши', 'маршрут'];

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function compactText(value, max = 220) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function entityKey(entity = {}) {
  return `${entity.type || 'entity'}:${entity.id || entity.title || ''}`;
}

export function normalizeConversationEntity(item = {}, index = 0, source = 'result') {
  const action = item.action || item.actions?.[0]?.action || null;
  const id = String(item.id || action?.payload?.partnerId || action?.payload?.expertId || action?.payload?.eventId || action?.payload?.newsId || action?.payload?.prizeId || item.title || `${source}-${index}`);
  const type = String(item.type || action?.type || 'entity').replace(/^OPEN_/, '').toLowerCase();
  return {
    id,
    type,
    title: compactText(titleOf(item, item.title || item.name || id), 160),
    text: compactText(item.text || item.description || item.summary || item.meta?.join?.(', '), 220),
    action,
    index,
    source,
    touchedAt: new Date().toISOString(),
  };
}

export function entitiesFromResult(result = {}) {
  const rows = [
    ...list(result.cards),
    result.card,
    ...list(result.ranked).map(row => ({ ...row, title: row.title, type: row.type })),
  ].filter(Boolean);
  const seen = new Set();
  return rows.map((row, index) => normalizeConversationEntity(row, index, 'result')).filter(entity => {
    const key = entityKey(entity);
    if (!key.trim() || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);
}

export function mergeConversationEntities(previous = [], additions = []) {
  const seen = new Set();
  return [...list(additions), ...list(previous)].filter(entity => {
    const key = entityKey(entity);
    if (!key.trim() || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 24);
}

export function detectConversationReference(question = '') {
  const query = normalizeText(question);
  const ordinal = ORDINALS.find(([stem]) => query.includes(stem));
  const pronoun = PRONOUNS.find(word => new RegExp(`(^|\\s)${word}(\\s|$|[?!.:,;])`).test(query));
  const shortFollowUp = query.length <= 48 && FOLLOW_UP_WORDS.some(word => {
    const normalized = word.trim();
    if (normalized.length <= 1) return query.startsWith(`${normalized} `);
    return query.startsWith(word) || query.includes(` ${normalized} `) || query.includes(normalized);
  });
  return {
    hasReference: Boolean(ordinal || pronoun || shortFollowUp),
    ordinalIndex: ordinal ? ordinal[1] : null,
    pronoun: pronoun || '',
    shortFollowUp,
    sourceText: query,
  };
}

export function resolveConversationReference({ reference = {}, entities = [] } = {}) {
  const rows = list(entities);
  if (!reference.hasReference || !rows.length) return { status: 'none', entity: null, reason: 'no_reference' };
  if (reference.ordinalIndex !== null) {
    const index = reference.ordinalIndex === -1 ? rows.length - 1 : reference.ordinalIndex;
    const entity = rows[index] || null;
    return entity
      ? { status: 'resolved', entity, reason: `ordinal:${reference.ordinalIndex}` }
      : { status: 'failed', entity: null, reason: 'ordinal_out_of_range' };
  }
  const typeSet = new Set(rows.slice(0, 5).map(entity => entity.type).filter(Boolean));
  if (reference.pronoun && rows.length > 1 && typeSet.size > 1) {
    return { status: 'ambiguous', entity: null, candidates: rows.slice(0, 5), reason: 'pronoun_multiple_entity_types' };
  }
  return { status: 'resolved', entity: rows[0], reason: reference.pronoun ? `pronoun:${reference.pronoun}` : 'follow_up_last_entity' };
}

export function buildResolvedQuestion(question = '', entity = null) {
  if (!entity?.title) return question;
  const query = String(question || '').trim();
  if (!query) return entity.title;
  if (normalizeText(query).includes(normalizeText(entity.title))) return query;
  return `${query} (${entity.title})`;
}
