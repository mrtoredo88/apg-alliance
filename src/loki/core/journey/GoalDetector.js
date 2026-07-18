import { normalizeText } from '../lokiCoreUtils.js';

export const JOURNEY_GOALS = Object.freeze({
  BOOK_SERVICE: 'BOOK_SERVICE',
  FIND_PARTNER: 'FIND_PARTNER',
  FIND_EXPERT: 'FIND_EXPERT',
  JOIN_EVENT: 'JOIN_EVENT',
  GET_PROMOTION: 'GET_PROMOTION',
  CLAIM_GIFT: 'CLAIM_GIFT',
  CONTACT_PARTNER: 'CONTACT_PARTNER',
  NAVIGATE: 'NAVIGATE',
  LEARN: 'LEARN',
  GENERAL: 'GENERAL',
});

function includesAny(query, words) {
  return words.some(word => query.includes(normalizeText(word)));
}

export function detectJourneyGoal({ query = '', intent = {}, reasoningResult = null, context = {} } = {}) {
  const text = normalizeText(query);
  const activeGoal = context?.memory?.lastJourneyContext?.goal || context?.memory?.journeyContext?.goal || '';
  if (!text) return { id: JOURNEY_GOALS.GENERAL, confidence: 0.2, source: 'empty' };
  if (includesAny(text, ['что мы уже сделали', 'где мы остановились', 'какой следующий шаг', 'что дальше'])) {
    return { id: activeGoal || JOURNEY_GOALS.GENERAL, confidence: 0.9, source: 'summary', mode: 'summary' };
  }
  if (includesAny(text, ['продолжим', 'продолжить', 'давай дальше', 'вернемся', 'вернёмся'])) {
    return { id: activeGoal || JOURNEY_GOALS.GENERAL, confidence: 0.86, source: 'recovery', mode: 'recovery' };
  }
  if (includesAny(text, ['готово', 'получилось', 'записался', 'записалась', 'зарегистрировался', 'зарегистрировалась', 'открыл карточку'])) {
    return { id: activeGoal || JOURNEY_GOALS.GENERAL, confidence: 0.86, source: 'completion', mode: 'completion' };
  }
  if (includesAny(text, ['запиши', 'записаться', 'забронировать', 'свободное время', 'есть запись', 'хочу подстричься', 'хочу на массаж'])) {
    return { id: JOURNEY_GOALS.BOOK_SERVICE, confidence: 0.92, source: 'query' };
  }
  if (includesAny(text, ['стоматолог', 'психолог', 'специалист', 'эксперт', 'мастер', 'врач', 'консультац'])) {
    return { id: JOURNEY_GOALS.FIND_EXPERT, confidence: 0.82, source: 'query' };
  }
  if (includesAny(text, ['мероприят', 'событ', 'куда сходить', 'афиш', 'зарегистрироваться на'])) {
    return { id: JOURNEY_GOALS.JOIN_EVENT, confidence: 0.84, source: 'query' };
  }
  if (includesAny(text, ['акци', 'скидк', 'выгод', 'промо'])) {
    return { id: JOURNEY_GOALS.GET_PROMOTION, confidence: 0.8, source: 'query' };
  }
  if (includesAny(text, ['подар', 'приз', 'наград', 'получить за ключ', 'забрать подарок'])) {
    return { id: JOURNEY_GOALS.CLAIM_GIFT, confidence: 0.82, source: 'query' };
  }
  if (includesAny(text, ['позвонить', 'написать', 'связаться', 'контакт', 'телефон', 'whatsapp', 'telegram'])) {
    return { id: JOURNEY_GOALS.CONTACT_PARTNER, confidence: 0.8, source: 'query' };
  }
  if (includesAny(text, ['маршрут', 'как добраться', 'на карте', 'адрес', 'где находится'])) {
    return { id: JOURNEY_GOALS.NAVIGATE, confidence: 0.78, source: 'query' };
  }
  if (includesAny(text, ['расскажи', 'объясни', 'как работает', 'как пользоваться', 'что такое', 'зачем'])) {
    return { id: JOURNEY_GOALS.LEARN, confidence: 0.72, source: 'query' };
  }
  if (intent.id === 'search.specialists') return { id: JOURNEY_GOALS.FIND_EXPERT, confidence: 0.78, source: 'intent' };
  if (intent.id === 'search.events') return { id: JOURNEY_GOALS.JOIN_EVENT, confidence: 0.78, source: 'intent' };
  if (intent.id === 'search.promotions') return { id: JOURNEY_GOALS.GET_PROMOTION, confidence: 0.76, source: 'intent' };
  if (intent.id === 'search.gifts') return { id: JOURNEY_GOALS.CLAIM_GIFT, confidence: 0.76, source: 'intent' };
  if (intent.id === 'search.partners' || reasoningResult?.ranked?.some?.(item => item.type === 'partner')) {
    return { id: JOURNEY_GOALS.FIND_PARTNER, confidence: 0.7, source: 'intent' };
  }
  return { id: activeGoal || JOURNEY_GOALS.GENERAL, confidence: activeGoal ? 0.56 : 0.32, source: activeGoal ? 'memory' : 'fallback' };
}
