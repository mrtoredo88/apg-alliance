const GRAPH_TYPES = ['news', 'event', 'partner', 'expert', 'task', 'reward', 'promotion'];

const TAXONOMY = {
  food: ['food', 'еда', 'кафе', 'кофе', 'ресторан', 'бар', 'завтрак', 'ужин', 'дегустац', 'кухн'],
  business: ['business', 'бизнес', 'предприним', 'делов', 'нетворкинг', 'маркетинг', 'финанс', 'консалт', 'продаж'],
  children: ['children', 'kids', 'дет', 'ребен', 'ребён', 'школ', 'сад', 'подрост'],
  family: ['family', 'семья', 'семей', 'родител', 'выходной'],
  beauty: ['beauty', 'красот', 'салон', 'маникюр', 'педикюр', 'спа', 'массаж', 'уход'],
  sport: ['sport', 'спорт', 'фитнес', 'йога', 'трен', 'актив', 'танц', 'зож'],
  health: ['health', 'здоров', 'медиц', 'врач', 'клиник', 'психолог', 'реабилит'],
  education: ['education', 'обуч', 'курс', 'лекц', 'мастер', 'класс', 'школа', 'знани'],
  shopping: ['shopping', 'магазин', 'товар', 'покуп', 'одежд', 'шоп', 'акци', 'скидк'],
  travel: ['travel', 'тур', 'поезд', 'путеше', 'маршрут', 'экскурс', 'отдых'],
  home: ['home', 'дом', 'ремонт', 'интерьер', 'мебел', 'быт', 'недвиж'],
  pets: ['pets', 'питом', 'живот', 'кот', 'собак', 'зо'],
  music: ['music', 'музык', 'концерт', 'песн', 'звук'],
  art: ['art', 'искус', 'творч', 'арт', 'рисован', 'выстав'],
  events: ['events', 'event', 'событ', 'мероприят', 'афиша', 'встреч', 'вебинар'],
};

const AUDIENCE_ALIASES = {
  residents: ['жител', 'город', 'зеленоград', 'участник'],
  partners: ['партнер', 'партнёр', 'бизнес'],
  experts: ['эксперт', 'консультац', 'специалист'],
  families: ['семья', 'семей', 'родител'],
  children: ['дет', 'ребен', 'ребён'],
  entrepreneurs: ['предприним', 'делов', 'бизнес'],
};

const SEASON_ALIASES = {
  winter: ['зима', 'зим', 'новогод', 'рождеств', 'декабр', 'январ', 'феврал'],
  spring: ['весна', 'весен', 'март', 'апрел', 'май'],
  summer: ['лето', 'летн', 'июн', 'июл', 'август', 'каникул'],
  autumn: ['осень', 'осенн', 'сентябр', 'октябр', 'ноябр'],
};

function safeText(value) {
  return String(value ?? '').toLowerCase().replace(/ё/g, 'е').trim();
}

function asList(value) {
  if (Array.isArray(value)) return value.map(item => String(item ?? '').trim()).filter(Boolean);
  if (value === null || value === undefined || value === '') return [];
  return [String(value).trim()].filter(Boolean);
}

function unique(values = []) {
  return [...new Set(values.map(value => safeText(value)).filter(Boolean))];
}

function collectText(item = {}, type = '') {
  return safeText([
    type,
    item.id,
    item.name,
    item.title,
    item.headline,
    item.category,
    item.categoryId,
    item.categoryName,
    item.categoryLabel,
    item.type,
    item.kind,
    item.specialization,
    item.description,
    item.text,
    item.body,
    item.offer,
    item.promo,
    item.discount,
    item.address,
    item.location,
    item.partner,
    item.expert,
    ...asList(item.tags),
    ...asList(item.topics),
    ...asList(item.audience),
  ].filter(Boolean).join(' '));
}

function detectByAliases(text, aliases) {
  return Object.entries(aliases)
    .filter(([, words]) => words.some(word => text.includes(safeText(word))))
    .map(([id]) => id);
}

function inferAge(item = {}, text = '') {
  const raw = unique([
    ...asList(item.age),
    ...asList(item.ageGroup),
    ...asList(item.ageGroups),
  ]);
  if (raw.length) return raw;
  if (text.includes('18+')) return ['adults'];
  if (text.includes('дет') || text.includes('ребен') || text.includes('ребён')) return ['children'];
  if (text.includes('сем')) return ['all'];
  return [];
}

export function normalizeGraphMetadata(item = {}, type = 'unknown') {
  const text = collectText(item, type);
  const explicitCategories = unique([
    ...asList(item.categories),
    item.category,
    item.categoryId,
    item.categoryName,
    item.categoryLabel,
  ]);
  const inferredCategories = unique([
    ...(type === 'event' ? ['events'] : []),
    ...(type === 'promotion' ? ['shopping'] : []),
    ...detectByAliases(text, TAXONOMY),
  ]);
  const categories = unique([...explicitCategories, ...inferredCategories]);
  const tags = unique([
    ...asList(item.tags),
    ...categories,
    ...asList(item.format),
    ...asList(item.formats),
    item.online ? 'online' : '',
    item.offline ? 'offline' : '',
    item.hybrid ? 'hybrid' : '',
  ]);
  const topics = unique([
    ...asList(item.topics),
    ...categories,
    ...detectByAliases(text, TAXONOMY),
  ]);
  const audience = unique([
    ...asList(item.audience),
    ...detectByAliases(text, AUDIENCE_ALIASES),
  ]);
  const season = unique([
    ...asList(item.season),
    ...detectByAliases(text, SEASON_ALIASES),
  ]);
  const age = inferAge(item, text);
  const flags = Object.fromEntries(
    Object.keys(TAXONOMY).map(id => [id, categories.includes(id) || topics.includes(id) || tags.includes(id)]),
  );
  return {
    categories,
    tags,
    topics,
    audience,
    season,
    age,
    ...flags,
  };
}

export function normalizeGraphNode(item = {}, type = 'unknown') {
  const id = String(item?.id ?? item?.canonicalId ?? item?.slug ?? `${type}:${safeText(item?.title || item?.name || '')}`).trim();
  const metadata = normalizeGraphMetadata(item, type);
  return {
    id: `${type}:${id}`,
    sourceId: id,
    type,
    title: String(item?.title || item?.name || item?.headline || item?.offer || type).trim(),
    metadata,
    item,
  };
}

function promotionNodesFromPartners(partners = []) {
  return partners
    .filter(item => item?.offer || item?.promo || item?.discount || item?.specialOffer || item?.actionText)
    .map(item => normalizeGraphNode({
      ...item,
      id: `${item.id || item.name}:promotion`,
      title: item.offer || item.promo || item.discount || item.specialOffer || item.actionText || item.name,
      partnerId: item.id,
      partnerName: item.name,
    }, 'promotion'));
}

function overlap(a = [], b = []) {
  const right = new Set(b);
  return a.reduce((sum, value) => sum + (right.has(value) ? 1 : 0), 0);
}

export function scoreGraphRelation(a, b) {
  if (!a || !b || a.id === b.id) return 0;
  const am = a.metadata ?? {};
  const bm = b.metadata ?? {};
  let score = 0;
  score += overlap(am.categories, bm.categories) * 3;
  score += overlap(am.topics, bm.topics) * 2;
  score += overlap(am.tags, bm.tags) * 1.2;
  score += overlap(am.audience, bm.audience) * 1.5;
  score += overlap(am.season, bm.season) * 0.8;
  score += overlap(am.age, bm.age) * 0.8;
  if (a.type !== b.type && score > 0) score += 0.6;
  return Math.round(score * 10) / 10;
}

export function buildGraphEdges(nodes = [], limitPerNode = 6) {
  return nodes.flatMap(node => nodes
    .map(target => ({ from: node.id, to: target.id, score: scoreGraphRelation(node, target), type: 'semantic' }))
    .filter(edge => edge.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limitPerNode));
}

export function findRelatedObjects(target, nodes = [], { limit = 8, type } = {}) {
  const node = target?.metadata ? target : normalizeGraphNode(target?.item ?? target ?? {}, target?.type ?? 'unknown');
  return nodes
    .filter(item => item.id !== node.id && (!type || item.type === type))
    .map(item => ({ node: item, score: scoreGraphRelation(node, item) }))
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function findSimilarObjects(target, nodes = [], options = {}) {
  const node = target?.metadata ? target : normalizeGraphNode(target?.item ?? target ?? {}, target?.type ?? 'unknown');
  return findRelatedObjects(node, nodes, { ...options, type: options.type ?? node.type });
}

export function buildGraphRecommendations({ nodes = [], interestProfile = null, limit = 12 } = {}) {
  const interests = interestProfile?.topCategories?.length
    ? interestProfile.topCategories
    : Object.entries(interestProfile?.weights ?? {})
      .map(([id, score]) => ({ id, score: Number(score ?? 0) }))
      .filter(row => row.score > 0)
      .sort((a, b) => b.score - a.score);
  return nodes
    .map(node => {
      const interestScore = interests.reduce((sum, row) => {
        const id = safeText(row.id);
        const match = node.metadata.categories.includes(id) || node.metadata.topics.includes(id) || node.metadata.tags.includes(id);
        return sum + (match ? Number(row.score ?? 1) : 0);
      }, 0);
      const richness = node.metadata.categories.length + node.metadata.topics.length * 0.6 + node.metadata.tags.length * 0.25;
      return { node, score: Math.round((interestScore + richness) * 10) / 10 };
    })
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function buildLifeGraph({
  news = [],
  events = [],
  partners = [],
  experts = [],
  tasks = [],
  rewards = [],
  promotions = [],
  interestProfile = null,
} = {}) {
  const nodes = [
    ...news.map(item => normalizeGraphNode(item, 'news')),
    ...events.map(item => normalizeGraphNode(item, 'event')),
    ...partners.map(item => normalizeGraphNode(item, 'partner')),
    ...experts.map(item => normalizeGraphNode(item, 'expert')),
    ...tasks.map(item => normalizeGraphNode(item, 'task')),
    ...rewards.map(item => normalizeGraphNode(item, 'reward')),
    ...promotions.map(item => normalizeGraphNode(item, 'promotion')),
    ...promotionNodesFromPartners(partners),
  ].filter(node => node.sourceId && node.title);
  const edges = buildGraphEdges(nodes);
  const recommendations = buildGraphRecommendations({ nodes, interestProfile, limit: 12 });
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    taxonomy: Object.keys(TAXONOMY),
    nodes,
    edges,
    recommendations,
    findRelated: (target, options) => findRelatedObjects(target, nodes, options),
    findSimilar: (target, options) => findSimilarObjects(target, nodes, options),
  };
}

export const APG_LIFE_GRAPH_TYPES = GRAPH_TYPES;
