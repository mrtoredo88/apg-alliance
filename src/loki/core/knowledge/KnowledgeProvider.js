import { LOKI_APP_ACTIONS, createLokiAction } from '../../lokiActionTypes.js';
import { imageOf, normalizeText, titleOf, toMillis } from '../lokiCoreUtils.js';
import { getProfileLocations, getMainLocation } from '../../../../server-shared/locations.js';

const MAX_TEXT = 420;

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function text(value, max = MAX_TEXT) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function uniqueById(items = []) {
  const seen = new Set();
  return items.filter(item => {
    const id = String(item?.id || item?.key || item?.title || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function isActive(item = {}) {
  const status = normalizeText(item.status || item.lifecycleStatus || item.contentStatus || '');
  return item.active !== false
    && item.catalogPublished !== false
    && item.archived !== true
    && item.hidden !== true
    && item.deleted !== true
    && !['archived', 'deleted', 'trash'].includes(status);
}

function hasOffer(item = {}) {
  return Boolean(item.offer || item.promo || item.discount || item.specialOffer || item.actionText || item.activeOffer);
}

function itemDate(item = {}) {
  return toMillis(item.publishedAt ?? item.createdAt ?? item.startAt ?? item.startsAt ?? item.date ?? item.updatedAt);
}

function searchText(parts = []) {
  return normalizeText(parts.filter(Boolean).join(' '));
}

function makeAction(type, item = {}, extra = {}) {
  if (type === 'partner') return createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: item.id, id: item.id, ...extra });
  if (type === 'expert') return createLokiAction(LOKI_APP_ACTIONS.OPEN_EXPERTS, { expertId: item.id, id: item.id, ...extra });
  if (type === 'event') return createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENT, { eventId: item.id, id: item.id, ...extra });
  if (type === 'news' || type === 'article') return createLokiAction(LOKI_APP_ACTIONS.OPEN_NEWS, { newsId: item.id, id: item.id, ...extra });
  if (type === 'gift') return createLokiAction(LOKI_APP_ACTIONS.OPEN_PRIZE, { prizeId: item.id, id: item.id, ...extra });
  if (type === 'location') return createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: item.partnerId, locationId: item.id, id: item.partnerId, ...extra });
  return createLokiAction(LOKI_APP_ACTIONS.OPEN_LOKI);
}

function resultCard(item = {}, type, extra = {}) {
  const action = makeAction(type, item, extra.actionPayload);
  const address = item.address || item.location?.address || item.place || '';
  const phone = item.phone || item.location?.phone || '';
  const offer = item.offer || item.promo || item.discount || item.specialOffer || item.actionText || '';
  return {
    id: String(item.id || `${type}-${titleOf(item, type)}`),
    type,
    title: titleOf(item, type === 'expert' ? 'Эксперт АПГ' : type === 'event' ? 'Мероприятие' : type === 'gift' ? 'Подарок' : 'Партнёр АПГ'),
    text: text(extra.text || item.summary || item.description || item.text || item.specialization || address || offer || 'Открою детали в АПГ.', 180),
    image: imageOf(item),
    meta: [item.categoryLabel || item.category || item.specialization, address, offer].filter(Boolean).slice(0, 3),
    action,
    label: type === 'news' || type === 'article' ? 'Читать' : type === 'gift' ? 'Посмотреть' : 'Открыть',
    actions: [
      { label: type === 'news' || type === 'article' ? 'Читать' : 'Открыть', action },
      address ? { label: 'Маршрут', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_MAP, { partnerId: item.partnerId || item.id, locationId: extra.locationId || item.locationId || '' }) } : null,
      phone ? { label: 'Позвонить', href: `tel:${String(phone).replace(/[^\d+]/g, '')}` } : null,
      item.bookingUrl ? { label: 'Записаться', href: item.bookingUrl } : null,
    ].filter(Boolean).slice(0, 4),
  };
}

function normalizePartner(partner = {}) {
  const locations = getProfileLocations(partner);
  const mainLocation = getMainLocation(partner) || locations[0] || null;
  return {
    ...partner,
    type: 'partner',
    title: titleOf(partner, 'Партнёр АПГ'),
    locations,
    mainLocation,
    searchText: searchText([
      partner.name,
      partner.title,
      partner.category,
      partner.description,
      partner.address,
      partner.offer,
      partner.promo,
      partner.tags?.join?.(' '),
      partner.keywords?.join?.(' '),
      locations.map(location => [location.title, location.address, location.phone, location.workingHours, location.hours].filter(Boolean).join(' ')).join(' '),
    ]),
  };
}

function normalizeExpert(expert = {}) {
  return {
    ...expert,
    type: 'expert',
    title: titleOf(expert, 'Эксперт АПГ'),
    searchText: searchText([
      expert.name,
      expert.title,
      expert.category,
      expert.specialization,
      expert.description,
      expert.services?.join?.(' '),
      expert.tags?.join?.(' '),
      expert.locationIds?.join?.(' '),
    ]),
  };
}

function normalizeEvent(event = {}) {
  return {
    ...event,
    type: 'event',
    title: titleOf(event, 'Мероприятие'),
    ts: toMillis(event.startAt ?? event.startsAt ?? event.eventDate ?? event.date ?? event.createdAt),
    searchText: searchText([event.title, event.name, event.category, event.description, event.text, event.address, event.place, event.partnerName]),
  };
}

function normalizeNews(item = {}) {
  return {
    ...item,
    type: 'news',
    title: titleOf(item, 'Новость АПГ'),
    ts: itemDate(item),
    searchText: searchText([item.title, item.subtitle, item.summary, item.text, item.description, item.category, item.author, item.sourceName]),
  };
}

function normalizeGift(item = {}) {
  return {
    ...item,
    type: 'gift',
    title: titleOf(item, 'Подарок'),
    searchText: searchText([item.title, item.name, item.description, item.category, item.partnerName, item.cost, item.keys]),
  };
}

function normalizeBooking(item = {}) {
  return {
    ...item,
    type: 'booking',
    title: text(item.serviceTitle || item.title || item.providerName || 'Запись', 160),
    ts: toMillis(item.startAt ?? item.date ?? item.createdAt),
    searchText: searchText([item.serviceTitle, item.providerName, item.locationTitle, item.specialistName, item.status]),
  };
}

function normalizeDialog(item = {}) {
  const context = item.context || {};
  return {
    ...item,
    type: 'dialog',
    title: text(item.title || context.title || item.lastMessage?.text || 'Диалог', 160),
    ts: toMillis(item.lastMessageAt ?? item.updatedAt ?? item.createdAt),
    searchText: searchText([item.title, context.title, context.type, item.lastMessage?.text, item.status]),
  };
}

function collectLocations(partners = []) {
  return uniqueById(partners.flatMap(partner => partner.locations.map(location => ({
    ...location,
    id: String(location.id || `${partner.id}-${location.address || location.title}`),
    type: 'location',
    partnerId: partner.id,
    partnerTitle: partner.title,
    title: text(location.title || location.address || partner.title, 180),
    address: location.address || partner.address || '',
    phone: location.phone || partner.phone || '',
    searchText: searchText([location.title, location.address, location.phone, location.workingHours, location.hours, partner.title, partner.category]),
  }))));
}

function collectPromotions(partners = [], appState = {}) {
  const fromPartners = partners.filter(hasOffer).map(partner => ({
    id: `${partner.id}:offer`,
    type: 'promotion',
    partnerId: partner.id,
    title: partner.offer || partner.promo || partner.specialOffer || partner.actionText || `Акция: ${partner.title}`,
    partnerTitle: partner.title,
    description: partner.description,
    category: partner.category,
    locationIds: partner.offerLocationIds || partner.promotionLocationIds || [],
    searchText: searchText([partner.offer, partner.promo, partner.discount, partner.specialOffer, partner.actionText, partner.title, partner.category]),
    source: partner,
  }));
  const explicit = list(appState.promotions || appState.offers).map(item => ({
    ...item,
    type: 'promotion',
    title: titleOf(item, 'Акция АПГ'),
    searchText: searchText([item.title, item.name, item.description, item.text, item.partnerName, item.category]),
  }));
  return uniqueById([...explicit, ...fromPartners]);
}

function collectReviews(appState = {}) {
  return [
    ...list(appState.reviews),
    ...list(appState.partnerReviews),
    ...list(appState.expertReviews),
  ].map(item => ({
    ...item,
    type: 'review',
    title: text(item.title || item.authorName || item.userName || 'Отзыв', 120),
    rating: Number(item.rating || item.score || 0),
    searchText: searchText([item.title, item.text, item.comment, item.authorName, item.partnerName, item.expertName, item.locationTitle]),
  }));
}

function buildSearchIndex(sources) {
  return [
    ...sources.partners,
    ...sources.experts,
    ...sources.locations,
    ...sources.promotions,
    ...sources.events,
    ...sources.gifts,
    ...sources.news,
  ].map(item => ({
    id: item.id,
    type: item.type,
    title: item.title,
    searchText: item.searchText,
    scoreBase: item.featured ? 2 : 0,
  }));
}

function detectScreenContext(appState = {}, sources) {
  const active = appState.activeContext || appState.aiContext?.activeContext || null;
  if (active?.type) return active;
  const panel = appState.activePanel || appState.currentPanel || '';
  if (panel === 'partner' && sources.partners[0]) return { type: 'partner', item: sources.partners[0] };
  if (panel === 'experts' && sources.experts[0]) return { type: 'experts', items: sources.experts.slice(0, 3) };
  if (panel === 'events' && sources.events[0]) return { type: 'events', items: sources.events.slice(0, 3) };
  if (panel === 'news' && sources.news[0]) return { type: 'news', items: sources.news.slice(0, 3) };
  if (panel === 'rewards' && sources.gifts[0]) return { type: 'gifts', items: sources.gifts.slice(0, 3) };
  if (panel === 'profile') return { type: 'profile', item: appState.user || appState.aiContext?.user || null };
  if (panel === 'dialogs') return { type: 'dialogs', items: sources.dialogs.slice(0, 3) };
  if (panel === 'workspace' || appState.workspace?.mode === 'desktop') return { type: 'workspace', analytics: sources.workspaceAnalytics };
  return { type: panel || 'home' };
}

export function buildLokiKnowledgeProvider(appState = {}) {
  const partners = list(appState.partners).filter(isActive).map(normalizePartner);
  const experts = list(appState.experts).filter(isActive).map(normalizeExpert);
  const events = list(appState.events).filter(isActive).map(normalizeEvent).sort((a, b) => (a.ts || Number.MAX_SAFE_INTEGER) - (b.ts || Number.MAX_SAFE_INTEGER));
  const news = list(appState.news).filter(isActive).map(normalizeNews).sort((a, b) => b.ts - a.ts);
  const gifts = list(appState.prizes || appState.rewards || appState.gifts).filter(isActive).map(normalizeGift);
  const bookings = list(appState.bookings || appState.meetings).map(normalizeBooking).sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const dialogs = list(appState.dialogs || appState.contextDialogs || appState.workspaceDialogs).map(normalizeDialog).sort((a, b) => b.ts - a.ts);
  const locations = collectLocations(partners);
  const promotions = collectPromotions(partners, appState);
  const reviews = collectReviews(appState);
  const workspaceAnalytics = appState.analytics || appState.workspaceAnalytics || appState.aiContext?.analytics || null;
  const sources = {
    partners,
    experts,
    locations,
    promotions,
    events,
    gifts,
    articles: news,
    news,
    reviews,
    bookings,
    meetings: bookings,
    dialogs,
    workspaceAnalytics,
    userProfile: appState.aiContext?.user || appState.user || null,
  };
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    sources,
    counts: Object.fromEntries(Object.entries(sources).map(([key, value]) => [key, Array.isArray(value) ? value.length : value ? 1 : 0])),
    searchIndex: buildSearchIndex(sources),
    screenContext: detectScreenContext(appState, sources),
    cards: { resultCard },
  };
}

export function searchKnowledge(knowledge, query, types = [], limit = 4) {
  const q = normalizeText(query);
  const words = q.split(/\s+/).filter(word => word.length > 2);
  const allowed = new Set(types.filter(Boolean));
  return list(knowledge?.searchIndex)
    .filter(row => !allowed.size || allowed.has(row.type))
    .map(row => {
      const direct = row.searchText.includes(q) || normalizeText(row.title).includes(q) ? 8 : 0;
      const wordScore = words.reduce((sum, word) => sum + (row.searchText.includes(word) ? 1.4 : 0), 0);
      return { ...row, score: direct + wordScore + Number(row.scoreBase || 0) };
    })
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export { resultCard as makeKnowledgeResultCard };
