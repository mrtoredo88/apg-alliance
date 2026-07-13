import { APG_EVENT_TYPES, subscribeToEvents } from './EventBus.js';

const MAX_ITEMS = 30;
let unsubscribe = null;

const continueState = {
  updatedAt: null,
  unreadNews: [],
  viewedEvents: [],
  unfinishedActions: [],
  recentPartners: [],
  recentExperts: [],
};

function remember(listName, item) {
  const list = continueState[listName];
  if (!Array.isArray(list) || !item) return;
  const id = String(item.id || '');
  continueState[listName] = [
    item,
    ...list.filter(row => String(row?.id || '') !== id || !id),
  ].slice(0, MAX_ITEMS);
  continueState.updatedAt = item.time;
}

function itemFromEvent(event) {
  return {
    id: String(event.entityId || event.payload?.id || event.payload?.entityId || ''),
    type: event.entityType || event.payload?.entityType || '',
    title: event.payload?.title || event.payload?.name || event.payload?.partnerName || event.payload?.expertName || '',
    action: event.payload?.action || event.type,
    time: event.timestamp,
    progress: Number(event.payload?.progress || 0),
  };
}

export function recordContinueEvent(event) {
  if (!event?.id) return;
  const action = String(event.payload?.action || event.type || '');
  const item = itemFromEvent(event);

  if (event.type === APG_EVENT_TYPES.NEWS_OPENED && item.id) remember('unreadNews', item);
  if (event.type === APG_EVENT_TYPES.NEWS_SAVED && item.id) remember('unfinishedActions', { ...item, type: 'news', title: item.title || 'Сохранённая новость' });
  if (event.type === APG_EVENT_TYPES.EVENT_OPENED && item.id) remember('viewedEvents', item);
  if (event.type === APG_EVENT_TYPES.PARTNER_OPENED && item.id) remember('recentPartners', item);
  if (event.type === APG_EVENT_TYPES.EXPERT_OPENED && item.id) remember('recentExperts', item);
  if (action.includes('register') || action.includes('book') || action.includes('scanner_open')) remember('unfinishedActions', item);
}

export function wireContinueExperience() {
  if (unsubscribe) return unsubscribe;
  unsubscribe = subscribeToEvents('*', recordContinueEvent);
  return unsubscribe;
}

export function buildContinueExperience({
  aiMemory = {},
  activityTimeline = [],
  savedNews = [],
  readLaterNews = [],
  news = [],
  events = [],
  partners = [],
  experts = [],
} = {}) {
  const findById = (list, id) => (Array.isArray(list) ? list : []).find(item => String(item?.id || '') === String(id || ''));
  const memoryNews = (aiMemory.lastViewedNews || []).slice(0, 4).map(row => ({
    ...row,
    type: 'news',
    item: findById(news, row.id),
    reason: 'Вы начали читать эту новость.',
  }));
  const saved = [...new Set([...(savedNews || []), ...(readLaterNews || [])].map(String))]
    .slice(0, 4)
    .map(id => {
      const item = findById(news, id);
      return item ? { id, type: 'news', title: item.title || item.text || 'Новость', item, reason: 'Вы сохранили это на потом.' } : null;
    })
    .filter(Boolean);

  const recentEvents = (aiMemory.lastViewedEvents || continueState.viewedEvents || []).slice(0, 4).map(row => ({
    ...row,
    type: 'event',
    item: findById(events, row.id),
    reason: 'Вы уже смотрели это мероприятие.',
  }));
  const recentPartners = (aiMemory.lastViewedPartners || continueState.recentPartners || []).slice(0, 4).map(row => ({
    ...row,
    type: 'partner',
    item: findById(partners, row.id),
    reason: 'Недавно открытый партнёр.',
  }));
  const recentExperts = (aiMemory.lastViewedExperts || continueState.recentExperts || []).slice(0, 4).map(row => ({
    ...row,
    type: 'expert',
    item: findById(experts, row.id),
    reason: 'Недавно открытый эксперт.',
  }));

  return {
    version: 1,
    updatedAt: continueState.updatedAt || activityTimeline?.[0]?.time || null,
    items: [...saved, ...memoryNews, ...recentEvents, ...recentPartners, ...recentExperts].filter(row => row.item || row.title).slice(0, 8),
    groups: {
      unreadNews: [...saved, ...memoryNews].slice(0, 5),
      viewedEvents: recentEvents,
      unfinishedActions: continueState.unfinishedActions.slice(0, 5),
      recentPartners,
      recentExperts,
    },
  };
}

export function getContinueExperienceSnapshot() {
  return {
    ...continueState,
    unreadNews: [...continueState.unreadNews],
    viewedEvents: [...continueState.viewedEvents],
    unfinishedActions: [...continueState.unfinishedActions],
    recentPartners: [...continueState.recentPartners],
    recentExperts: [...continueState.recentExperts],
  };
}

export function clearContinueExperience() {
  continueState.updatedAt = null;
  continueState.unreadNews = [];
  continueState.viewedEvents = [];
  continueState.unfinishedActions = [];
  continueState.recentPartners = [];
  continueState.recentExperts = [];
}

