import { APG_EVENT_TYPES, subscribeToEvents } from './EventBus.js';

const MAX_ITEMS = 60;
let unsubscribe = null;

const memory = {
  lastActions: [],
  lastRecommendations: [],
  lastLokiQuestions: [],
  lastScreenOpenings: [],
  lastViewedNews: [],
  lastViewedEvents: [],
  lastViewedPartners: [],
  lastViewedExperts: [],
  favoritePartners: [],
  favoriteExperts: [],
  frequentActions: {},
  latestAchievements: [],
};

function remember(listName, item, key = 'id') {
  const list = memory[listName];
  if (!Array.isArray(list) || !item) return;
  const value = item[key] ? String(item[key]) : '';
  memory[listName] = [
    item,
    ...list.filter(current => String(current?.[key] || '') !== value || !value),
  ].slice(0, MAX_ITEMS);
}

function compactEntity(event) {
  return {
    id: String(event.entityId || event.payload?.id || event.payload?.entityId || ''),
    type: event.entityType || event.payload?.entityType || '',
    title: event.payload?.title || event.payload?.name || event.payload?.partnerName || event.payload?.expertName || '',
    category: event.payload?.category || event.payload?.categoryLabel || '',
    time: event.timestamp,
    source: event.source,
    action: event.payload?.action || event.type,
  };
}

function addFavorite(listName, event) {
  const entity = compactEntity(event);
  if (!entity.id) return;
  remember(listName, entity);
}

function removeFavorite(listName, event) {
  const id = String(event.entityId || event.payload?.partnerId || event.payload?.expertId || '');
  if (!id || !Array.isArray(memory[listName])) return;
  memory[listName] = memory[listName].filter(item => String(item.id) !== id);
}

export function recordAIMemoryEvent(event) {
  if (!event?.id) return;
  const action = event.payload?.action || event.type;
  memory.frequentActions[action] = (memory.frequentActions[action] || 0) + 1;
  remember('lastActions', {
    id: event.id,
    type: event.type,
    action,
    entityType: event.entityType,
    entityId: event.entityId,
    time: event.timestamp,
  }, 'id');

  if (event.type === APG_EVENT_TYPES.SCREEN_OPENED || event.type === APG_EVENT_TYPES.LOKI_OPENED) {
    remember('lastScreenOpenings', compactEntity(event));
  }
  if (event.type === APG_EVENT_TYPES.NEWS_OPENED) remember('lastViewedNews', compactEntity(event));
  if (event.type === APG_EVENT_TYPES.EVENT_OPENED || event.type === APG_EVENT_TYPES.EVENT_REGISTERED) remember('lastViewedEvents', compactEntity(event));
  if (event.type === APG_EVENT_TYPES.PARTNER_OPENED) remember('lastViewedPartners', compactEntity(event));
  if (event.type === APG_EVENT_TYPES.EXPERT_OPENED) remember('lastViewedExperts', compactEntity(event));
  if (event.type === APG_EVENT_TYPES.RECOMMENDATION_VIEWED || event.type === APG_EVENT_TYPES.RECOMMENDATION_INTERACTED) remember('lastRecommendations', compactEntity(event));
  if (event.type === APG_EVENT_TYPES.LOKI_QUESTION_ASKED) remember('lastLokiQuestions', compactEntity(event));
  if (event.type === APG_EVENT_TYPES.TASK_CLAIMED || event.type === APG_EVENT_TYPES.TASK_COMPLETED || event.type === APG_EVENT_TYPES.KEYS_AWARDED) remember('latestAchievements', compactEntity(event));

  if (action === 'favorites:toggle' && event.payload?.partnerId) {
    if (event.payload?.isAdding === false) removeFavorite('favoritePartners', event);
    else addFavorite('favoritePartners', { ...event, entityId: event.payload.partnerId, entityType: 'partner' });
  }
}

export function wireAIMemory() {
  if (unsubscribe) return unsubscribe;
  unsubscribe = subscribeToEvents('*', recordAIMemoryEvent);
  return unsubscribe;
}

export function getAIMemorySnapshot() {
  return {
    ...memory,
    lastActions: [...memory.lastActions],
    lastRecommendations: [...memory.lastRecommendations],
    lastLokiQuestions: [...memory.lastLokiQuestions],
    lastScreenOpenings: [...memory.lastScreenOpenings],
    lastViewedNews: [...memory.lastViewedNews],
    lastViewedEvents: [...memory.lastViewedEvents],
    lastViewedPartners: [...memory.lastViewedPartners],
    lastViewedExperts: [...memory.lastViewedExperts],
    favoritePartners: [...memory.favoritePartners],
    favoriteExperts: [...memory.favoriteExperts],
    frequentActions: { ...memory.frequentActions },
    latestAchievements: [...memory.latestAchievements],
  };
}

export function clearAIMemory() {
  Object.keys(memory).forEach(key => {
    if (Array.isArray(memory[key])) memory[key] = [];
    else memory[key] = {};
  });
}

