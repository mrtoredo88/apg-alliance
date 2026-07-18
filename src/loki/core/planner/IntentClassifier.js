import { normalizeText } from '../lokiCoreUtils.js';

export const PLANNER_INTENTS = {
  EVENING_DISCOUNTS: 'planner.evening_discounts',
  BOOK_NEARBY_SERVICE: 'planner.book_nearby_service',
  KEY_OPPORTUNITY: 'planner.key_opportunity',
  DAY_PLAN: 'planner.day_plan',
  WORKSPACE_OVERVIEW: 'planner.workspace_overview',
  GENERAL: 'planner.general',
};

function includesAny(query, values = []) {
  return values.some(value => query.includes(value));
}

function hasAllSignals(query, groups = []) {
  return groups.every(group => includesAny(query, group));
}

export function classifyPlannerIntent({ question = '', intent = {} } = {}) {
  const query = normalizeText(question);
  if (!query) return { id: PLANNER_INTENTS.GENERAL, confidence: 0, query };
  if (hasAllSignals(query, [
    ['завтра', 'сегодня', 'вечером', 'вечер'],
    ['сходить', 'куда', 'пойти', 'посетить'],
    ['скидк', 'акци', 'выгод'],
  ])) {
    return { id: PLANNER_INTENTS.EVENING_DISCOUNTS, confidence: 0.92, query };
  }
  if (hasAllSignals(query, [
    ['запис', 'запиши', 'бронь'],
    ['массаж', 'стриж', 'маникюр', 'услуг', 'стоматолог'],
    ['рядом', 'дом', 'близко', 'маршрут'],
  ])) {
    return { id: PLANNER_INTENTS.BOOK_NEARBY_SERVICE, confidence: 0.9, query };
  }
  if (hasAllSignals(query, [
    ['ключ', 'балл', 'награ'],
    ['выгод', 'получить', 'заработать', 'лучше'],
    ['сейчас', 'сегодня', 'куда'],
  ])) {
    return { id: PLANNER_INTENTS.KEY_OPPORTUNITY, confidence: 0.88, query };
  }
  if (includesAny(query, ['собери план', 'составь план', 'спланируй', 'повестк'])
    && includesAny(query, ['записи', 'мероприятия', 'встречи', 'события', 'день'])) {
    return { id: PLANNER_INTENTS.DAY_PLAN, confidence: 0.82, query };
  }
  if (includesAny(query, ['workspace']) && includesAny(query, ['что важно', 'приоритет', 'разбери']) && includesAny(query, ['задач', 'диалог', 'запис'])) {
    return { id: PLANNER_INTENTS.WORKSPACE_OVERVIEW, confidence: 0.84, query };
  }
  if (intent.id?.startsWith?.('planner.')) return { id: intent.id, confidence: 0.7, query };
  return { id: PLANNER_INTENTS.GENERAL, confidence: 0.2, query };
}
