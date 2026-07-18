import { LOKI_APP_ACTIONS, createLokiAction } from '../../lokiActionTypes.js';
import { JOURNEY_GOALS } from './GoalDetector.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function openAction(item = {}) {
  if (item.type === 'event') return createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENT, { eventId: item.id, id: item.id });
  if (item.type === 'news') return createLokiAction(LOKI_APP_ACTIONS.OPEN_NEWS, { newsId: item.id, id: item.id });
  if (item.type === 'expert') return createLokiAction(LOKI_APP_ACTIONS.OPEN_EXPERTS, { expertId: item.id, id: item.id });
  if (item.type === 'gift') return createLokiAction(LOKI_APP_ACTIONS.OPEN_PRIZE, { prizeId: item.id, id: item.id });
  if (item.type === 'location') return createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: item.partnerId, locationId: item.id, id: item.partnerId });
  return createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: item.partnerId || item.id, id: item.partnerId || item.id });
}

function routeAction(item = {}) {
  return createLokiAction(LOKI_APP_ACTIONS.OPEN_MAP, { partnerId: item.partnerId || item.id, locationId: item.type === 'location' ? item.id : '' });
}

export function resolveJourneyActions({ goal = JOURNEY_GOALS.GENERAL, selected = null, reasoningResult = null, progress = null } = {}) {
  const existing = list(reasoningResult?.suggestions);
  const item = selected || reasoningResult?.ranked?.[0] || null;
  const suggestions = [];
  if (item) suggestions.push({ label: item.type === 'event' ? 'Открыть событие' : item.type === 'gift' ? 'Открыть подарок' : 'Открыть карточку', action: openAction(item) });
  if (goal === JOURNEY_GOALS.BOOK_SERVICE && item) suggestions.push({ label: 'Записаться', action: openAction(item) });
  if (goal === JOURNEY_GOALS.JOIN_EVENT && item) suggestions.push({ label: 'К регистрации', action: createLokiAction(LOKI_APP_ACTIONS.START_EVENT_REGISTRATION, { eventId: item.id, id: item.id }) });
  if ((goal === JOURNEY_GOALS.NAVIGATE || progress?.currentStep?.id === 'open_map') && item) suggestions.push({ label: 'Показать маршрут', action: routeAction(item) });
  if (goal === JOURNEY_GOALS.CONTACT_PARTNER && item) suggestions.push({ label: 'Связаться', action: openAction(item) });
  suggestions.push(...existing);
  if (!suggestions.length) {
    if (goal === JOURNEY_GOALS.FIND_EXPERT) suggestions.push({ label: 'Открыть экспертов', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_EXPERTS) });
    else if (goal === JOURNEY_GOALS.JOIN_EVENT) suggestions.push({ label: 'Открыть события', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENTS) });
    else if (goal === JOURNEY_GOALS.CLAIM_GIFT) suggestions.push({ label: 'Открыть подарки', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_PRIZE) });
    else suggestions.push({ label: 'Открыть партнёров', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNERS) });
  }
  const seen = new Set();
  return suggestions.filter(item => {
    const key = `${item.label}:${item.action?.type || item.href || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
}
