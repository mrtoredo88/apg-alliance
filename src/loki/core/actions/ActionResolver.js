import { LOKI_APP_ACTIONS, createLokiAction, normalizeLokiActionRequest } from '../../lokiActionTypes.js';
import { ACTION_IDS, getActionDefinition } from './ActionRegistry.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function text(value) {
  return String(value ?? '').trim();
}

function itemId(item = {}) {
  return text(item.partnerId || item.expertId || item.eventId || item.newsId || item.prizeId || item.id);
}

function actionForItem(item = {}) {
  const id = itemId(item);
  if (item.type === 'event') return createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENT, { eventId: item.eventId || id, id });
  if (item.type === 'news' || item.type === 'article') return createLokiAction(LOKI_APP_ACTIONS.OPEN_NEWS, { newsId: item.newsId || id, id });
  if (item.type === 'expert') return createLokiAction(LOKI_APP_ACTIONS.OPEN_EXPERTS, { expertId: item.expertId || id, id });
  if (item.type === 'gift' || item.type === 'prize') return createLokiAction(LOKI_APP_ACTIONS.OPEN_PRIZE, { prizeId: item.prizeId || id, id });
  if (item.type === 'location') return createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: item.partnerId || id, locationId: item.locationId || item.id, id: item.partnerId || id });
  return createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: item.partnerId || id, id: item.partnerId || id });
}

function routeForItem(item = {}) {
  return createLokiAction(LOKI_APP_ACTIONS.OPEN_MAP, {
    partnerId: item.partnerId || item.id || '',
    locationId: item.type === 'location' ? item.id : item.locationId || '',
  });
}

function actionForIntent(intent = {}, result = {}) {
  const id = text(intent.id || result.intent).toLowerCase();
  if (id.includes('booking')) return result.card?.action || createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNERS);
  if (id.includes('specialist') || id.includes('expert')) return createLokiAction(LOKI_APP_ACTIONS.OPEN_EXPERTS);
  if (id.includes('event')) return createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENTS);
  if (id.includes('gift') || id.includes('reward') || id.includes('prize')) return createLokiAction(LOKI_APP_ACTIONS.OPEN_PRIZE);
  if (id.includes('promotion') || id.includes('offer')) return createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNERS);
  if (id.includes('news')) return createLokiAction(LOKI_APP_ACTIONS.OPEN_NEWS_FEED);
  if (id.includes('profile')) return createLokiAction(LOKI_APP_ACTIONS.SHOW_PROFILE);
  if (id.includes('workspace')) return createLokiAction(LOKI_APP_ACTIONS.OPEN_LOKI);
  if (id.includes('hours') || id.includes('contacts') || id.includes('partner')) return createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNERS);
  return null;
}

function goalOf(result = {}) {
  return text(result.journeyContext?.goal || result.goal || '').toUpperCase();
}

function actionForGoal(goal, result = {}) {
  const item = result.journeyContext?.selected || result.reasoningContext?.ranked?.[0] || result.ranked?.[0] || null;
  if (goal === 'BOOK_SERVICE') return item ? actionForItem(item) : createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNERS);
  if (goal === 'FIND_PARTNER' || goal === 'CONTACT_PARTNER') return item ? actionForItem(item) : createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNERS);
  if (goal === 'FIND_EXPERT') return item ? actionForItem({ ...item, type: 'expert' }) : createLokiAction(LOKI_APP_ACTIONS.OPEN_EXPERTS);
  if (goal === 'JOIN_EVENT') return item ? createLokiAction(LOKI_APP_ACTIONS.START_EVENT_REGISTRATION, { eventId: item.eventId || item.id, id: item.eventId || item.id }) : createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENTS);
  if (goal === 'GET_PROMOTION') return item ? actionForItem(item) : createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNERS);
  if (goal === 'CLAIM_GIFT') return item ? actionForItem({ ...item, type: 'gift' }) : createLokiAction(LOKI_APP_ACTIONS.OPEN_PRIZE);
  if (goal === 'NAVIGATE') return item ? routeForItem(item) : createLokiAction(LOKI_APP_ACTIONS.OPEN_MAP);
  return null;
}

function normalizeAction(action, fallbackLabel = '') {
  const normalized = normalizeLokiActionRequest(action);
  if (!normalized?.type) return null;
  const definition = getActionDefinition(normalized) || {};
  return {
    label: fallbackLabel || definition.label || 'Открыть',
    action: normalized,
    actionId: definition.id || normalized.type,
  };
}

export function resolveLokiActions({ result = {}, intent = {}, context = {} } = {}) {
  const candidates = [];
  const goal = goalOf(result);
  const selectedCard = result.card || list(result.cards)[0] || null;
  const selectedItem = result.ranked?.[0] || result.journeyContext?.selected || null;

  list(result.suggestions).forEach(item => candidates.push(normalizeAction(item.action, item.label)));
  list(selectedCard?.actions).forEach(item => candidates.push(normalizeAction(item.action, item.label)));
  if (selectedCard?.action) candidates.push(normalizeAction(selectedCard.action, selectedCard.label));
  if (selectedItem) candidates.push(normalizeAction(actionForItem(selectedItem), selectedItem.type === 'news' ? 'Открыть статью' : 'Открыть карточку'));
  candidates.push(normalizeAction(actionForGoal(goal, result), goal === 'NAVIGATE' ? 'Показать маршрут' : 'Продолжить'));
  candidates.push(normalizeAction(actionForIntent(intent, result), 'Открыть раздел'));

  const active = context?.memory?.activeContext || context?.memory?.lastContext || context?.activeContext || null;
  if (active?.type === 'news') candidates.push(normalizeAction(createLokiAction(LOKI_APP_ACTIONS.OPEN_NEWS, { newsId: active.newsId || active.id }), 'Открыть статью'));
  if (active?.type === 'partner') candidates.push(normalizeAction(createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: active.partnerId || active.id }), 'Открыть карточку'));

  const seen = new Set();
  return candidates.filter(Boolean).filter(item => {
    const key = `${item.action.type}:${JSON.stringify(item.action.payload || {})}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
}

export function resolveActionIdForIntent(intent = {}, goal = '') {
  const id = text(intent.id || intent).toLowerCase();
  const normalizedGoal = text(goal).toUpperCase();
  if (normalizedGoal === 'BOOK_SERVICE' || id.includes('booking')) return ACTION_IDS.OPEN_BOOKING;
  if (normalizedGoal === 'FIND_EXPERT' || id.includes('specialist')) return ACTION_IDS.OPEN_EXPERT;
  if (normalizedGoal === 'JOIN_EVENT' || id.includes('event')) return ACTION_IDS.OPEN_EVENT;
  if (normalizedGoal === 'CLAIM_GIFT' || id.includes('gift')) return ACTION_IDS.OPEN_GIFT;
  if (normalizedGoal === 'GET_PROMOTION' || id.includes('promotion')) return ACTION_IDS.OPEN_PROMOTION;
  if (id.includes('news')) return ACTION_IDS.OPEN_NEWS;
  if (id.includes('profile')) return ACTION_IDS.OPEN_PROFILE;
  return ACTION_IDS.OPEN_PARTNER;
}
