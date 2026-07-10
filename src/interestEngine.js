const INTEREST_CATEGORIES = [
  'food',
  'business',
  'children',
  'beauty',
  'sport',
  'health',
  'education',
  'events',
  'shopping',
  'travel',
  'home',
];

const MAX_WEIGHT = 100;
const MAX_SIGNALS = 80;
const DECAY = 0.992;
const SMOOTHING = 0.34;

const CATEGORY_ALIASES = {
  food: ['food', 'еда', 'кафе', 'кофе', 'ресторан', 'бар', 'завтрак', 'ужин', 'дегустац'],
  business: ['business', 'бизнес', 'предприним', 'услуг', 'делов', 'маркетинг', 'финанс', 'консалт'],
  children: ['children', 'kids', 'дет', 'ребен', 'ребён', 'семья', 'семей', 'школ', 'сад'],
  beauty: ['beauty', 'красот', 'салон', 'маникюр', 'педикюр', 'спа', 'массаж', 'уход'],
  sport: ['sport', 'спорт', 'фитнес', 'йога', 'трен', 'актив', 'танц'],
  health: ['health', 'здоров', 'медиц', 'врач', 'клиник', 'психолог', 'реабилит'],
  education: ['education', 'обуч', 'курс', 'лекц', 'мастер', 'класс', 'школа', 'знани'],
  events: ['events', 'event', 'событ', 'мероприят', 'афиша', 'встреч', 'концерт', 'вебинар'],
  shopping: ['shopping', 'магазин', 'товар', 'покуп', 'одежд', 'шоп', 'акци', 'скидк'],
  travel: ['travel', 'тур', 'поезд', 'путеше', 'маршрут', 'экскурс', 'отдых'],
  home: ['home', 'дом', 'ремонт', 'интерьер', 'мебел', 'быт', 'жкх', 'недвиж'],
};

const ACTION_WEIGHTS = {
  panel_open: 0.35,
  search: 0.8,
  news_open: 1.4,
  event_open: 1.6,
  event_registration: 4.2,
  partner_open: 1.8,
  expert_open: 1.8,
  favorite_add: 3.4,
  favorite_remove: -1.2,
  visit: 4.8,
  qr_scan: 4.8,
  saved_news: 2.2,
};

function safeText(value) {
  return String(value ?? '').toLowerCase().replace(/ё/g, 'е').trim();
}

function clamp(value, min = 0, max = MAX_WEIGHT) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function normalizeWeights(weights = {}) {
  const result = {};
  INTEREST_CATEGORIES.forEach(id => {
    result[id] = clamp(weights?.[id] ?? 0);
  });
  return result;
}

function detectCategoriesFromText(text) {
  const source = safeText(text);
  if (!source) return [];
  return INTEREST_CATEGORIES.filter(id => CATEGORY_ALIASES[id].some(alias => source.includes(alias)));
}

export function getInterestCategoriesFromItem(item = {}, type = '') {
  const explicit = [
    item.category,
    item.categoryId,
    item.categoryName,
    item.categoryLabel,
    item.type,
    item.kind,
    ...(Array.isArray(item.tags) ? item.tags : []),
  ].map(safeText).filter(Boolean);
  const direct = explicit
    .map(value => INTEREST_CATEGORIES.find(id => id === value || CATEGORY_ALIASES[id].some(alias => value.includes(alias))))
    .filter(Boolean);
  const text = [
    type,
    item.name,
    item.title,
    item.headline,
    item.specialization,
    item.description,
    item.text,
    item.offer,
    item.address,
  ].filter(Boolean).join(' ');
  const semantic = detectCategoriesFromText(text);
  const typed = type === 'event' ? ['events'] : [];
  return [...new Set([...typed, ...direct, ...semantic])].filter(Boolean);
}

export function normalizeInterestProfile(profile = {}) {
  const source = profile && typeof profile === 'object' ? profile : {};
  const weights = normalizeWeights(source.weights);
  const topCategories = Object.entries(weights)
    .sort((a, b) => b[1] - a[1])
    .filter(([, score]) => score > 0.2)
    .slice(0, 8)
    .map(([id, score]) => ({ id, score: Math.round(score * 10) / 10 }));
  return {
    version: 1,
    weights,
    topCategories,
    signals: Array.isArray(source.signals) ? source.signals.slice(0, MAX_SIGNALS) : [],
    lastEventAt: source.lastEventAt ?? null,
    updatedAt: source.updatedAt ?? null,
  };
}

function passiveWeightsFromAppState(appState = {}) {
  const weights = normalizeWeights();
  const add = (categories, delta) => {
    categories.forEach(id => {
      if (INTEREST_CATEGORIES.includes(id)) weights[id] = clamp(weights[id] + delta, 0, 24);
    });
  };
  const partners = Array.isArray(appState.partners) ? appState.partners : [];
  const events = Array.isArray(appState.events) ? appState.events : [];
  const news = Array.isArray(appState.news) ? appState.news : [];
  const experts = Array.isArray(appState.experts) ? appState.experts : [];
  const favorites = new Set((Array.isArray(appState.favorites) ? appState.favorites : []).map(String));
  const registered = new Set((Array.isArray(appState.registeredEventIds) ? appState.registeredEventIds : []).map(String));
  const savedNews = new Set((Array.isArray(appState.savedNews) ? appState.savedNews : []).map(String));
  const readLaterNews = new Set((Array.isArray(appState.readLaterNews) ? appState.readLaterNews : []).map(String));
  partners.forEach(item => {
    if (favorites.has(String(item?.id))) add(getInterestCategoriesFromItem(item, 'partner'), 1.8);
    if (Number(item?.visitCount ?? 0) > 0) add(getInterestCategoriesFromItem(item, 'partner'), Math.min(4, Number(item.visitCount) * 0.8));
  });
  events.forEach(item => {
    if (registered.has(String(item?.id))) add(getInterestCategoriesFromItem(item, 'event'), 2.4);
  });
  news.forEach(item => {
    const id = String(item?.id ?? item?.canonicalId ?? '');
    if (savedNews.has(id) || readLaterNews.has(id)) add(getInterestCategoriesFromItem(item, 'news'), 1.2);
  });
  experts.slice(0, 20).forEach(item => {
    if (Number(item?.visitCount ?? 0) > 0) add(getInterestCategoriesFromItem(item, 'expert'), 1.2);
  });
  return weights;
}

export function buildInterestProfile({ profile = null, appState = {}, memory = {}, userMemory = {} } = {}) {
  const stored = normalizeInterestProfile(profile ?? appState.interestProfile);
  const passive = passiveWeightsFromAppState(appState);
  const memoryCategories = {
    ...(memory?.learning?.categories ?? {}),
    ...(userMemory?.favoriteCategories ?? {}),
  };
  const weights = normalizeWeights(stored.weights);
  INTEREST_CATEGORIES.forEach(id => {
    weights[id] = clamp(weights[id] + passive[id] * 0.45 + Number(memoryCategories[id] ?? 0) * 0.22);
  });
  return normalizeInterestProfile({
    ...stored,
    weights,
    updatedAt: new Date().toISOString(),
  });
}

export function mergeInterestEvent(profile, event = {}) {
  const base = normalizeInterestProfile(profile);
  const type = safeText(event.type || event.eventType || 'panel_open');
  const categories = [
    ...getInterestCategoriesFromItem(event.item ?? {}, safeText(event.itemType || type.replace(/_.+$/, ''))),
    ...detectCategoriesFromText(event.query),
    ...(Array.isArray(event.categories) ? event.categories : []),
  ].filter(id => INTEREST_CATEGORIES.includes(id));
  if (!categories.length) return base;
  const baseDelta = Number(event.weight ?? ACTION_WEIGHTS[type] ?? 1);
  const nextWeights = normalizeWeights(base.weights);
  INTEREST_CATEGORIES.forEach(id => {
    nextWeights[id] = clamp(nextWeights[id] * DECAY);
  });
  categories.forEach(id => {
    const current = nextWeights[id] ?? 0;
    nextWeights[id] = clamp(current + baseDelta * SMOOTHING);
  });
  const signal = {
    type,
    itemType: safeText(event.itemType || ''),
    itemId: safeText(event.item?.id || event.itemId || ''),
    categories: [...new Set(categories)],
    ts: Date.now(),
  };
  return normalizeInterestProfile({
    version: 1,
    weights: nextWeights,
    signals: [signal, ...base.signals].slice(0, MAX_SIGNALS),
    lastEventAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function scoreItemForInterests(item = {}, profile = {}, type = '') {
  const normalized = normalizeInterestProfile(profile);
  const categories = getInterestCategoriesFromItem(item, type);
  const categoryScore = categories.reduce((sum, id) => sum + Number(normalized.weights[id] ?? 0), 0);
  const text = safeText([
    item.name,
    item.title,
    item.category,
    item.categoryLabel,
    item.specialization,
    item.description,
    item.offer,
  ].filter(Boolean).join(' '));
  const semanticScore = normalized.topCategories.reduce((sum, row) => {
    const aliases = CATEGORY_ALIASES[row.id] ?? [row.id];
    return aliases.some(alias => text.includes(alias)) ? sum + row.score * 0.35 : sum;
  }, 0);
  return categoryScore + semanticScore;
}

export function sortByInterests(items = [], profile = {}, type = '') {
  return [...items]
    .map((item, index) => ({ item, index, score: scoreItemForInterests(item, profile, type) }))
    .sort((a, b) => (b.score - a.score) || (a.index - b.index))
    .map(row => row.item);
}

export function buildAdaptiveHomeData({ partners = [], experts = [], events = [], news = [], interestProfile = null } = {}) {
  const profile = normalizeInterestProfile(interestProfile);
  return {
    interestProfile: profile,
    partners: sortByInterests(partners, profile, 'partner'),
    experts: sortByInterests(experts, profile, 'expert'),
    events: sortByInterests(events, profile, 'event'),
    news: sortByInterests(news, profile, 'news'),
  };
}
