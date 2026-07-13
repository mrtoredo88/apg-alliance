function scoreNews(item, weights = {}) {
  const age = item?.publishedAt || item?.createdAt || item?.date || 0;
  const publishedMs = age?.toDate ? age.toDate().getTime() : new Date(age || 0).getTime();
  const ageScore = Number.isFinite(publishedMs) ? Math.max(0, 30 - (Date.now() - publishedMs) / 86400000) / 10 : 0;
  const popularity = Number(item?.views ?? item?.readCount ?? item?.viewCount ?? 0) || 0;
  const keyword = Number(item?.priority ?? item?.score ?? 0);
  const signals = getSignals(weights, 'news', item);
  return (ageScore * 2) + (Math.log2(popularity + 1) / 3) + (keyword || 0) + signals;
}

function scorePartner(item, userContext = {}) {
  const favorites = new Set([
    ...(Array.isArray(userContext.favorites) ? userContext.favorites : []),
    ...(userContext.preferenceSignals?.favoritePartnerIds || []),
  ].map(String));
  const isFavorite = favorites.has(String(item?.id));
  const withPromo = Boolean(item?.offer || item?.promo || item?.discount || item?.specialOffer || item?.actionText);
  const views = Number(item?.views || item?.viewCount || 0);
  return Number(item?.rating || 0) * 0.4 + (withPromo ? 2 : 0) + (isFavorite ? 1.8 : 0) + Math.log2(views + 1) + getSignals(userContext, 'partner', item);
}

function scoreExpert(item, userContext = {}) {
  const rating = Number(item?.avgRating || 0);
  const reviews = Number(item?.reviewsCount || item?.reviewCount || 0);
  return rating * 0.8 + Math.log2(reviews + 1) + getSignals(userContext, 'expert', item);
}

function scoreEvent(item, userContext = {}, now = Date.now()) {
  const when = item?.startAt || item?.startsAt || item?.date || item?.eventDate || 0;
  const whenMs = when?.toDate ? when.toDate().getTime() : new Date(when || 0).getTime();
  const diff = Number.isFinite(whenMs) ? Math.max(0, whenMs - now) : Infinity;
  const days = diff / 86400000;
  const timeScore = days <= 1 ? 3 : days <= 4 ? 2 : days <= 7 ? 1 : 0;
  const registrations = Number(item?.registeredCount || 0);
  const limit = Number(item?.maxParticipants || 0);
  const capacityScore = limit > 0 ? Math.max(0, 1 - registrations / limit) * 2 : 1;
  const eveningBoost = userContext.preferenceSignals?.timeOfDay === 'evening' && days <= 2 ? 0.4 : 0;
  return timeScore + capacityScore + Number(item?.popularity || 0) * 0.2 + eveningBoost + getSignals(userContext, 'event', item);
}

function getSignals(userContext = {}, type, item = {}) {
  const id = String(item?.id || '');
  const recent = userContext.recentActivity || {};
  const recentByType = {
    news: recent.lastViewedNews,
    event: recent.lastViewedEvents,
    partner: recent.lastViewedPartners,
    expert: recent.lastViewedExperts,
  };
  const recentList = Array.isArray(recentByType[type]) ? recentByType[type] : [];
  const index = recentList.findIndex(row => String(row?.id || '') === id);
  const recentVisit = index >= 0 ? Math.max(0, 1.2 - index * 0.18) : 0;
  const repeatCount = recentList.filter(row => String(row?.id || '') === id).length;
  const repeated = repeatCount > 1 ? Math.min(1.2, repeatCount * 0.22) : 0;
  const category = String(item?.category || item?.categoryLabel || item?.type || '').trim();
  const favoriteCategory = category && userContext.preferenceSignals?.favoriteCategories?.includes(category) ? 0.75 : 0;
  const activityMatch = (recent.actions || []).some(row => String(row?.type || '').includes(type)) ? 0.25 : 0;
  return recentVisit + repeated + favoriteCategory + activityMatch;
}

function pickTop(list, comparator, limit) {
  return [...list].sort(comparator).slice(0, limit);
}

export function recommendNews({ news = [] }, userContext = {}) {
  return pickTop(
    Array.isArray(news) ? news.filter(Boolean) : [],
    (a, b) => scoreNews(b, userContext) - scoreNews(a, userContext),
    6,
  ).map(item => ({
    id: String(item.id),
    type: 'news',
    item,
    score: Number(scoreNews(item, userContext).toFixed(3)),
  }));
}

export function recommendPartners({ partners = [] }, userContext = {}) {
  return pickTop(
    Array.isArray(partners) ? partners.filter(Boolean) : [],
    (a, b) => scorePartner(b, userContext) - scorePartner(a, userContext),
    6,
  ).map(item => ({
    id: String(item.id),
    type: 'partner',
    item,
    score: Number(scorePartner(item, userContext).toFixed(3)),
  }));
}

export function recommendExperts({ experts = [] }, userContext = {}) {
  return pickTop(
    Array.isArray(experts) ? experts.filter(Boolean) : [],
    (a, b) => scoreExpert(b, userContext) - scoreExpert(a, userContext),
    6,
  ).map(item => ({
    id: String(item.id),
    type: 'expert',
    item,
    score: Number(scoreExpert(item, userContext).toFixed(3)),
  }));
}

export function recommendEvents({ events = [] }, userContext = {}) {
  return pickTop(
    Array.isArray(events) ? events.filter(Boolean) : [],
    (a, b) => scoreEvent(b, userContext) - scoreEvent(a, userContext),
    6,
  ).map(item => ({
    id: String(item.id),
    type: 'event',
    item,
    score: Number(scoreEvent(item, userContext).toFixed(3)),
  }));
}

export function recommendRewards({ rewards = [] }) {
  return pickTop(
    Array.isArray(rewards) ? rewards.filter(Boolean) : [],
    (a, b) => Number(b?.keys || 0) - Number(a?.keys || 0),
    6,
  ).map(item => ({
    id: String(item.id),
    type: 'reward',
    item,
    score: Number((item?.keys || 0) || 0),
  }));
}

export function recommendTasks({ tasks = [], completedTaskIds = [] }) {
  const completed = new Set(Array.isArray(completedTaskIds) ? completedTaskIds.map(String) : []);
  return pickTop(
    Array.isArray(tasks) ? tasks.filter(item => item && !completed.has(String(item.id))) : [],
    (a, b) => Number(b?.reward || 0) - Number(a?.reward || 0),
    6,
  ).map(item => ({
    id: String(item.id),
    type: 'task',
    item,
    score: Number(item?.reward || 0),
  }));
}

export function buildPersonalHomeSuggestions({
  news = [],
  partners = [],
  experts = [],
  events = [],
  newsRecommendations = [],
  partnerRecommendations = [],
  expertRecommendations = [],
  eventRecommendations = [],
} = {}) {
  return {
    news: newsRecommendations.length ? newsRecommendations : recommendNews({ news }).slice(0, 3),
    partners: partnerRecommendations.length ? partnerRecommendations : recommendPartners({ partners }).slice(0, 3),
    experts: expertRecommendations.length ? expertRecommendations : recommendExperts({ experts }).slice(0, 3),
    events: eventRecommendations.length ? eventRecommendations : recommendEvents({ events }).slice(0, 3),
  };
}
