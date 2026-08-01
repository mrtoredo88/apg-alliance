import { normalizeText } from '../lokiCoreUtils.js';

const list = value => Array.isArray(value) ? value.filter(Boolean) : [];

function cardText(card = {}) {
  return normalizeText([card.title, card.text, card.category, ...list(card.meta)].filter(Boolean).join(' '));
}

function rating(card = {}) {
  const direct = Number(card.rating ?? card.avgRating ?? 0);
  if (direct > 0) return direct;
  const match = `${list(card.meta).join(' ')}`.replace(',', '.').match(/(?:★|рейтинг\s*)\s*(\d(?:\.\d)?)/i);
  return match ? Number(match[1]) : 0;
}

function distanceKm(card = {}) {
  const source = `${card.distanceKm ?? card.distance ?? ''} ${list(card.meta).join(' ')}`.replace(',', '.');
  const km = source.match(/(\d+(?:\.\d+)?)\s*км/i);
  if (km) return Number(km[1]);
  const meters = source.match(/(\d+)\s*м(?:\s|$)/i);
  return meters ? Number(meters[1]) / 1000 : null;
}

function offer(card = {}) {
  return /скид|акци|бонус|подар|выгод|предложен/.test(cardText(card));
}

function closed(card = {}) {
  return /(?:сейчас\s+)?закрыт[оа]?|не работает|выходной/.test(cardText(card));
}

function priceLabel(card = {}) {
  const text = cardText(card);
  if (/₽₽₽|премиум|люкс|дорог/.test(text)) return 'дороже';
  if (/₽₽|средн/.test(text)) return 'средняя цена';
  if (/₽|бюджет|доступн|бесплат/.test(text)) return 'доступно';
  return 'не указана';
}

function distanceLabel(value) {
  if (value == null) return 'не указано';
  if (value < 1) return `${Math.round(value * 1000)} м`;
  return `${Math.round(value * 10) / 10} км`;
}

function scoreCard(card, index, preferences = {}) {
  const rate = rating(card);
  const distance = distanceKm(card);
  let score = 20 - index;
  if (rate) score += rate * 3;
  if (distance != null) score += Math.max(-10, 8 - distance * (preferences.preferNearby ? 4 : 2));
  if (offer(card)) score += preferences.preferAffordable ? 7 : 4;
  if (closed(card)) score -= 30;
  return { card, score, rate, distance, hasOffer: offer(card) };
}

export function compareLokiCards(cards = []) {
  return list(cards).slice(0, 3).map(card => {
    const rate = rating(card);
    const distance = distanceKm(card);
    return {
      id: card.id || card.title,
      title: card.title || 'Вариант',
      rating: rate ? `★ ${rate}` : 'нет данных',
      distance: distanceLabel(distance),
      price: priceLabel(card),
      benefit: offer(card) ? 'есть предложение' : 'без акции',
    };
  });
}

export function chooseLokiCard(cards = [], preferences = {}) {
  const ranked = list(cards).map((card, index) => scoreCard(card, index, preferences)).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best) return null;
  const reasons = [
    best.distance != null ? `расстояние ${distanceLabel(best.distance)}` : null,
    best.rate ? `рейтинг ${best.rate}` : null,
    best.hasOffer ? 'есть выгодное предложение' : null,
  ].filter(Boolean);
  return {
    card: best.card,
    score: Math.round(best.score * 10) / 10,
    reason: reasons.length ? reasons.slice(0, 2).join(' · ') : 'лучше всего соответствует текущему запросу',
  };
}
