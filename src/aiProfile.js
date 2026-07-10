const DEFAULT_PROFILE = {
  summary: '',
  specialization: '',
  strengths: [],
  categories: [],
  typicalClients: [],
  recommendedFor: [],
  typicalRequests: [],
  relatedCategories: [],
  relatedPartnerIds: [],
  relatedExpertIds: [],
  status: 'draft',
};

export function normalizeAiProfileList(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map(item => String(item ?? '').trim()).filter(Boolean))).slice(0, 12);
  }
  return Array.from(new Set(String(value ?? '')
    .split(/[\n,;]+/)
    .map(item => item.trim())
    .filter(Boolean))).slice(0, 12);
}

export function aiProfileListToText(value) {
  return normalizeAiProfileList(value).join('\n');
}

export function sanitizeAiProfile(profile = {}) {
  const source = profile && typeof profile === 'object' ? profile : {};
  return {
    ...DEFAULT_PROFILE,
    ...source,
    summary: String(source.summary ?? source.shortDescription ?? '').trim().slice(0, 1200),
    specialization: String(source.specialization ?? '').trim().slice(0, 500),
    strengths: normalizeAiProfileList(source.strengths),
    categories: normalizeAiProfileList(source.categories),
    typicalClients: normalizeAiProfileList(source.typicalClients),
    recommendedFor: normalizeAiProfileList(source.recommendedFor),
    typicalRequests: normalizeAiProfileList(source.typicalRequests),
    relatedCategories: normalizeAiProfileList(source.relatedCategories),
    relatedPartnerIds: normalizeAiProfileList(source.relatedPartnerIds),
    relatedExpertIds: normalizeAiProfileList(source.relatedExpertIds),
    status: String(source.status || 'draft').trim() || 'draft',
  };
}

function firstText(...values) {
  return values.map(value => String(value ?? '').trim()).find(Boolean) || '';
}

function categoryList(entity = {}) {
  return normalizeAiProfileList([
    entity.categoryLabel,
    entity.category,
    entity.type,
    ...(Array.isArray(entity.categories) ? entity.categories : []),
    ...(Array.isArray(entity.tags) ? entity.tags : []),
    ...(Array.isArray(entity.topics) ? entity.topics : []),
  ]);
}

function pickRelated(entity = {}, list = [], type = 'partner') {
  const categories = categoryList(entity).map(item => item.toLowerCase());
  if (!categories.length) return [];
  return list
    .filter(item => item?.id && item.id !== entity.id && item.archived !== true && item.hidden !== true)
    .map(item => {
      const itemCategories = categoryList(item).map(value => value.toLowerCase());
      const score = itemCategories.filter(value => categories.includes(value)).length;
      return { id: item.id, score };
    })
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(row => row.id);
}

export function buildAiProfileDraft(entity = {}, type = 'partner', relations = {}) {
  const categories = categoryList(entity);
  const isExpert = type === 'expert';
  const summary = firstText(entity.description, entity.summary, entity.about, entity.offer);
  const specialization = firstText(
    entity.specialization,
    entity.categoryLabel,
    entity.category,
    isExpert ? entity.offer : '',
  );
  const strengths = normalizeAiProfileList([
    entity.verified || entity.verifiedPartner ? 'Проверенный участник АПГ' : '',
    entity.featured ? 'Рекомендован АПГ' : '',
    entity.offer ? 'Есть специальное предложение для участников АПГ' : '',
    entity.avgRating ? `Рейтинг ${entity.avgRating}` : '',
    entity.address ? 'Есть офлайн-точка' : '',
    entity.bookingUrl ? 'Можно записаться онлайн' : '',
  ]);
  const typicalRequests = normalizeAiProfileList([
    entity.offer,
    isExpert ? entity.specialization : entity.categoryLabel,
    isExpert ? 'Консультация' : 'Акция или услуга',
    entity.address ? 'Найти рядом' : '',
  ]);
  const recommendedFor = normalizeAiProfileList([
    isExpert ? 'Пользователям, которым нужна консультация специалиста' : 'Пользователям, которые ищут проверенное место АПГ',
    entity.offer ? 'Тем, кто хочет воспользоваться специальным предложением' : '',
    categories[0] ? `Интерес: ${categories[0]}` : '',
  ]);
  const typicalClients = normalizeAiProfileList([
    isExpert ? 'Жители, которым нужен экспертный совет' : 'Жители Зеленограда',
    entity.categoryLabel || entity.category ? `Интересуются: ${entity.categoryLabel || entity.category}` : '',
  ]);
  const missing = [
    !summary ? 'summary' : '',
    !specialization ? 'specialization' : '',
    !categories.length ? 'categories' : '',
  ].filter(Boolean);
  return sanitizeAiProfile({
    summary,
    specialization,
    strengths,
    categories,
    typicalClients,
    recommendedFor,
    typicalRequests,
    relatedCategories: categories,
    relatedPartnerIds: isExpert ? pickRelated(entity, relations.partners, 'partner') : pickRelated(entity, relations.partners, 'partner'),
    relatedExpertIds: isExpert ? pickRelated(entity, relations.experts, 'expert') : pickRelated(entity, relations.experts, 'expert'),
    status: missing.length ? 'draft' : 'generated',
    needsReview: missing.length > 0,
    missingFields: missing,
    source: 'generated',
  });
}

export function getAiProfile(entity = {}, type = 'partner', relations = {}) {
  const existing = entity?.aiProfile && typeof entity.aiProfile === 'object' ? sanitizeAiProfile(entity.aiProfile) : null;
  if (existing && (existing.summary || existing.specialization || existing.categories.length)) return existing;
  return buildAiProfileDraft(entity, type, relations);
}

export function aiProfileSearchText(entity = {}, type = 'partner') {
  const profile = getAiProfile(entity, type);
  return [
    profile.summary,
    profile.specialization,
    ...profile.strengths,
    ...profile.categories,
    ...profile.typicalClients,
    ...profile.recommendedFor,
    ...profile.typicalRequests,
    ...profile.relatedCategories,
  ].filter(Boolean).join(' ');
}
