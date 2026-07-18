import { normalizeText, toMillis } from '../lokiCoreUtils.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function num(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function text(value) {
  return String(value ?? '').trim();
}

function hasOffer(item = {}) {
  return Boolean(item.offer || item.promo || item.discount || item.specialOffer || item.actionText || item.activeOffer);
}

function reviewCount(item = {}) {
  return num(item.reviewsCount ?? item.reviewCount ?? item.stats?.reviews ?? item.stats?.reviewCount ?? item.ratingCount);
}

function rating(item = {}) {
  return num(item.avgRating ?? item.rating ?? item.stats?.rating);
}

function popularity(item = {}) {
  return num(item.views ?? item.viewCount ?? item.opens ?? item.stats?.views ?? item.stats?.profileViews ?? item.stats?.opens);
}

function hasBooking(item = {}) {
  return Boolean(item.bookingUrl || item.bookingEnabled || item.booking?.enabled || item.canBook || item.onlineBooking);
}

function updatedRecently(item = {}, now = Date.now()) {
  const ms = toMillis(item.updatedAt ?? item.publishedAt ?? item.createdAt ?? item.date);
  return ms && now - ms < 1000 * 60 * 60 * 24 * 30;
}

function worksToday(item = {}) {
  const haystack = normalizeText([
    item.workingHours,
    item.hours,
    item.mainLocation?.workingHours,
    item.mainLocation?.hours,
    item.locations?.map?.(location => `${location.workingHours || ''} ${location.hours || ''}`).join(' '),
  ].filter(Boolean).join(' '));
  if (!haystack) return false;
  return /ежеднев|пн|вт|ср|чт|пт|сб|вс|10|11|12|13|14|15|16|17|18|19|20|21|22/.test(haystack);
}

function hoursText(item = {}) {
  return normalizeText([
    item.workingHours,
    item.hours,
    item.mainLocation?.workingHours,
    item.mainLocation?.hours,
    item.locations?.map?.(location => `${location.workingHours || ''} ${location.hours || ''}`).join(' '),
  ].filter(Boolean).join(' '));
}

function queryFit(item = {}, query = '') {
  const q = normalizeText(query);
  const hours = hoursText(item);
  let score = 0;
  const reasons = [];
  if ((q.includes('до 22') || q.includes('22')) && hours.includes('22')) {
    score += 8;
    reasons.push('работает до 22');
  }
  if ((q.includes('парков')) && normalizeText([item.parking, item.description, item.mainLocation?.comment, item.mainLocation?.description].filter(Boolean).join(' ')).includes('парков')) {
    score += 7;
    reasons.push('есть данные о парковке');
  }
  if ((q.includes('акци') || q.includes('скид')) && hasOffer(item)) {
    score += 6;
    reasons.push('есть акция');
  }
  if ((q.includes('запис') || q.includes('брон')) && hasBooking(item)) {
    score += 6;
    reasons.push('есть онлайн-запись');
  }
  return { score, reasons };
}

function openNow(item = {}, now = new Date()) {
  const haystack = normalizeText([
    item.workingHours,
    item.hours,
    item.mainLocation?.workingHours,
    item.mainLocation?.hours,
  ].filter(Boolean).join(' '));
  if (!haystack) return false;
  const hour = now.getHours();
  const match = haystack.match(/(\d{1,2})[:.]?\d{0,2}\s*[-–—]\s*(\d{1,2})/);
  if (!match) return haystack.includes('ежеднев');
  const from = Number(match[1]);
  const to = Number(match[2]);
  return Number.isFinite(from) && Number.isFinite(to) && hour >= from && hour < to;
}

function distanceScore(item = {}, userLocation = null) {
  const distance = num(item.distanceKm ?? item.distance ?? item.geo?.distanceKm ?? item.mainLocation?.distanceKm);
  if (distance > 0) return Math.max(0, 12 - Math.min(12, distance * 2));
  if (userLocation && (item.coordinates || item.mainLocation?.coordinates)) return 1;
  return 0;
}

function userPreferenceScore(item = {}, context = {}) {
  const favorites = new Set(list(context?.favorites?.ids || context?.user?.favorites).map(String));
  const interests = [
    ...list(context?.userMemory?.favoriteCategories),
    ...list(context?.userMemory?.interests),
    ...list(context?.interestProfile?.topCategories),
  ].map(normalizeText);
  const itemText = normalizeText([item.category, item.categoryLabel, item.specialization, item.title, item.name].filter(Boolean).join(' '));
  return (favorites.has(String(item.id)) ? 5 : 0)
    + interests.reduce((sum, interest) => sum + (interest && itemText.includes(interest) ? 2 : 0), 0);
}

function reason(label, value, weight) {
  return value > 0 ? { label, value, weight } : null;
}

export function rankCandidates({ candidates = [], knowledge = {}, context = {}, query = '', now = new Date() } = {}) {
  const sourceByType = {
    partner: knowledge.sources?.partners,
    expert: knowledge.sources?.experts,
    event: knowledge.sources?.events,
    news: knowledge.sources?.news,
    location: knowledge.sources?.locations,
    promotion: knowledge.sources?.promotions,
    gift: knowledge.sources?.gifts,
  };
  const userLocation = context?.location?.value || context?.appState?.location || null;
  return candidates
    .map(row => {
      const source = list(sourceByType[row.type]).find(item => String(item.id) === String(row.id)) || row.item || row;
      const queryMatch = queryFit(source, query);
      const reasons = [
        reason('совпадает с запросом', num(row.score), 1),
        ...queryMatch.reasons.map(label => reason(label, queryMatch.score, 1.2)),
        reason('ближе по расстоянию', distanceScore(source, userLocation), 1.15),
        reason('выше рейтинг', rating(source), 1.4),
        reason('больше отзывов', Math.min(8, reviewCount(source) / 3), 1),
        reason('сейчас открыт', openNow(source, now) ? 7 : 0, 1.25),
        reason('работает сегодня', worksToday(source) ? 4 : 0, 0.8),
        reason('есть онлайн-запись', hasBooking(source) ? 6 : 0, 1.1),
        reason('есть акция', hasOffer(source) || row.type === 'promotion' ? 5 : 0, 1),
        reason('недавно обновлялся', updatedRecently(source, now.getTime()) ? 3 : 0, 0.6),
        reason('популярен у пользователей', Math.min(7, popularity(source) / 50), 0.8),
        reason('похож на ваши интересы', userPreferenceScore(source, context), 1),
      ].filter(Boolean);
      const score = reasons.reduce((sum, item) => sum + item.value * item.weight, 0);
      return {
        ...source,
        id: String(source.id || row.id),
        type: row.type || source.type,
        title: text(source.title || source.name || row.title),
        score: Math.round(score * 10) / 10,
        baseScore: num(row.score),
        reasons: reasons.sort((a, b) => b.value * b.weight - a.value * a.weight).slice(0, 5),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function explainRanking(ranked = []) {
  return ranked.slice(0, 3).map((item, index) => ({
    id: item.id,
    title: item.title,
    place: index + 1,
    reasons: list(item.reasons).slice(0, 3).map(row => row.label),
  }));
}
