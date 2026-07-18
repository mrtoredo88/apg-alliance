import { normalizeText, titleOf, toMillis } from '../lokiCoreUtils.js';

const ENTITY_TEXT_LIMIT = 1400;

export function toList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value == null || value === '') return [];
  return [value];
}

export function cleanText(value, limit = ENTITY_TEXT_LIMIT) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, limit);
}

export function uniqueStrings(values = []) {
  const seen = new Set();
  return toList(values)
    .flatMap(value => Array.isArray(value) ? value : String(value).split(/[;,|]/))
    .map(value => cleanText(value, 120))
    .filter(Boolean)
    .filter(value => {
      const key = normalizeText(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function entityKey(type, id) {
  return `${type}:${String(id || '').trim()}`;
}

function sourceUpdatedAt(item = {}) {
  return item.updatedAt || item.modifiedAt || item.publishedAt || item.createdAt || item.startAt || item.date || null;
}

export function createKnowledgeEntity({ type, source = {}, id, title, aliases = [], keywords = [], categories = [], relations = [], extraText = [] } = {}) {
  const safeType = cleanText(type || source.type || 'entity', 40);
  const safeId = cleanText(id || source.id || source.key || `${safeType}-${titleOf(source, title || safeType)}`, 160);
  const safeTitle = cleanText(title || source.title || source.name || source.displayName || source.label || titleOf(source, safeType), 220);
  const safeAliases = uniqueStrings([
    aliases,
    source.aliases,
    source.alias,
    source.name,
    source.title,
    source.displayName,
    source.shortName,
    source.slug,
  ]);
  const safeCategories = uniqueStrings([
    categories,
    source.categories,
    source.category,
    source.categoryLabel,
    source.typeLabel,
    source.specialization,
  ]);
  const safeKeywords = uniqueStrings([
    keywords,
    source.keywords,
    source.tags,
    source.services,
    source.directions,
    source.features,
    source.offer,
    source.promo,
    source.specialOffer,
  ]);
  const searchText = normalizeText([
    safeTitle,
    safeAliases.join(' '),
    safeKeywords.join(' '),
    safeCategories.join(' '),
    source.searchText,
    source.description,
    source.summary,
    source.text,
    source.address,
    source.place,
    source.partnerName,
    source.expertName,
    source.locationTitle,
    extraText.join(' '),
  ].filter(Boolean).join(' '));
  return {
    id: safeId,
    key: entityKey(safeType, safeId),
    type: safeType,
    title: safeTitle,
    aliases: safeAliases,
    keywords: safeKeywords,
    categories: safeCategories,
    relations: toList(relations),
    searchText,
    updatedAt: sourceUpdatedAt(source),
    updatedMs: toMillis(sourceUpdatedAt(source)),
    sourceRef: { type: safeType, id: safeId },
  };
}
