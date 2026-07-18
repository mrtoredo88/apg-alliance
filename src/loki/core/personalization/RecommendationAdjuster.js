import { normalizeText } from '../lokiCoreUtils.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function itemText(item = {}) {
  return normalizeText([item.title, item.name, item.category, item.specialization, item.text, item.meta?.join?.(' ')].filter(Boolean).join(' '));
}

function scoreItem(item = {}, userContext = {}, preferences = {}) {
  const text = itemText(item);
  const favoriteIds = userContext.favoriteIds || new Set();
  const reasons = [];
  let score = 0;
  if (favoriteIds.has(String(item.id)) || favoriteIds.has(String(item.partnerId)) || favoriteIds.has(String(item.expertId))) {
    score += 12;
    reasons.push('есть в вашем избранном');
  }
  for (const pref of list(preferences.categories)) {
    if (pref.value && text.includes(pref.value)) {
      score += Math.min(8, pref.score);
      reasons.push(`совпадает с вашей частой категорией: ${pref.value}`);
      break;
    }
  }
  if (list(userContext.recentBookings).some(row => String(row.id) === String(item.id) || String(row.providerId) === String(item.id))) {
    score += 8;
    reasons.push('у вас уже была запись здесь');
  }
  if (list(userContext.recentVisits).some(row => String(row.id) === String(item.id) || String(row.partnerId) === String(item.id))) {
    score += 8;
    reasons.push('вы уже посещали это место');
  }
  if (item.type === 'gift' && Number(userContext.keys || 0) > 0) {
    score += 4;
    reasons.push(`у вас есть ${Number(userContext.keys)} ключей`);
  }
  if ((item.type === 'event' || item.action?.type === 'openEvent') && preferences.interests?.events) {
    score += 3;
    reasons.push('у вас есть активный интерес к мероприятиям');
  }
  return { score, reasons: Array.from(new Set(reasons)).slice(0, 4) };
}

export function adjustRecommendations({ result = {}, userContext = {}, preferences = {}, analysis = {} } = {}) {
  if (!preferences.hasEnoughData) return { result, applied: false, reasons: [], topPersonalReason: '' };
  const ranked = list(result.ranked);
  const cards = list(result.cards);
  const adjust = item => {
    const personal = scoreItem(item, userContext, preferences);
    return { ...item, personalScore: personal.score, personalReasons: personal.reasons };
  };
  const adjustedRanked = ranked.map(adjust).sort((a, b) => (b.personalScore || 0) - (a.personalScore || 0) || (b.score || 0) - (a.score || 0));
  const adjustedCards = cards.map(adjust).sort((a, b) => (b.personalScore || 0) - (a.personalScore || 0));
  const top = adjustedRanked[0] || adjustedCards[0] || result.card || null;
  const topPersonal = top ? scoreItem(top, userContext, preferences) : { score: 0, reasons: [] };
  if (!topPersonal.score && !analysis.shouldExplainMore && !analysis.shouldBeConcise) {
    return { result, applied: false, reasons: [], topPersonalReason: '' };
  }
  return {
    result: {
      ...result,
      ranked: adjustedRanked.length ? adjustedRanked : result.ranked,
      cards: adjustedCards.length ? adjustedCards : result.cards,
      card: adjustedCards[0] || result.card,
    },
    applied: topPersonal.score > 0,
    reasons: topPersonal.reasons,
    topPersonalReason: topPersonal.reasons[0] || '',
  };
}
