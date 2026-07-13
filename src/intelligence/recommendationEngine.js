function scoreNews(item, weights = {}) {
  const age = item?.publishedAt || item?.createdAt || item?.date || 0;
  const publishedMs = age?.toDate ? age.toDate().getTime() : new Date(age || 0).getTime();
  const ageScore = Number.isFinite(publishedMs) ? Math.max(0, 30 - (Date.now() - publishedMs) / 86400000) / 10 : 0;
  const popularity = Number(item?.views ?? item?.readCount ?? item?.viewCount ?? 0) || 0;
  const keyword = Number(item?.priority ?? item?.score ?? 0);
  return (ageScore * 2) + (Math.log2(popularity + 1) / 3) + (keyword || 0);
}

function scorePartner(item, userContext = {}) {
  const favorites = new Set(Array.isArray(userContext.favorites) ? userContext.favorites : []);
  const isFavorite = favorites.has(String(item?.id));
  const withPromo = Boolean(item?.offer || item?.promo || item?.discount || item?.specialOffer || item?.actionText);
  const views = Number(item?.views || item?.viewCount || 0);
  return Number(item?.rating || 0) * 0.4 + (withPromo ? 2 : 0) + (isFavorite ? 1.3 : 0) + Math.log2(views + 1);
}

function scoreExpert(item) {
  const rating = Number(item?.avgRating || 0);
  const reviews = Number(item?.reviewsCount || item?.reviewCount || 0);
  return rating * 0.8 + Math.log2(reviews + 1);
}

function scoreEvent(item, now = Date.now()) {
  const when = item?.startAt || item?.startsAt || item?.date || item?.eventDate || 0;
  const whenMs = when?.toDate ? when.toDate().getTime() : new Date(when || 0).getTime();
  const diff = Number.isFinite(whenMs) ? Math.max(0, whenMs - now) : Infinity;
  const days = diff / 86400000;
  const timeScore = days <= 1 ? 3 : days <= 4 ? 2 : days <= 7 ? 1 : 0;
  const registrations = Number(item?.registeredCount || 0);
  const limit = Number(item?.maxParticipants || 0);
  const capacityScore = limit > 0 ? Math.max(0, 1 - registrations / limit) * 2 : 1;
  return timeScore + capacityScore + Number(item?.popularity || 0) * 0.2;
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
    (a, b) => scoreExpert(b) - scoreExpert(a),
    6,
  ).map(item => ({
    id: String(item.id),
    type: 'expert',
    item,
    score: Number(scoreExpert(item).toFixed(3)),
  }));
}

export function recommendEvents({ events = [] }, userContext = {}) {
  return pickTop(
    Array.isArray(events) ? events.filter(Boolean) : [],
    (a, b) => scoreEvent(b) - scoreEvent(a),
    6,
  ).map(item => ({
    id: String(item.id),
    type: 'event',
    item,
    score: Number(scoreEvent(item).toFixed(3)),
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
