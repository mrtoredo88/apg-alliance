import { APG_EVENT_TYPES, subscribeToEvents } from './EventBus.js';

const DEFAULT_WEIGHTS = {
  view: 1,
  like: 3,
  comment: 4,
  visit: 5,
  registration: 6,
  search: 2,
  loki: 3,
  favorite: 5,
};

let unsubscribe = null;

const interestModel = {
  updatedAt: null,
  categories: {},
  entities: {
    news: {},
    event: {},
    partner: {},
    expert: {},
    loki: {},
  },
  actions: {},
  signals: [],
};

function addScore(bucket, key, value) {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) return;
  bucket[normalizedKey] = Number((Number(bucket[normalizedKey] || 0) + value).toFixed(3));
}

function pushSignal(signal) {
  interestModel.signals.unshift(signal);
  if (interestModel.signals.length > 120) interestModel.signals.length = 120;
  interestModel.updatedAt = signal.time;
}

function resolveWeight(event) {
  const action = String(event.payload?.action || event.type || '').toLowerCase();
  if (event.type === APG_EVENT_TYPES.NEWS_LIKED || action.includes('like') || action.includes('reaction')) return DEFAULT_WEIGHTS.like;
  if (event.type === APG_EVENT_TYPES.NEWS_COMMENTED || action.includes('comment')) return DEFAULT_WEIGHTS.comment;
  if (event.type === APG_EVENT_TYPES.QR_SCANNED || action.includes('scan_success')) return DEFAULT_WEIGHTS.visit;
  if (event.type === APG_EVENT_TYPES.EVENT_REGISTERED || action.includes('register')) return DEFAULT_WEIGHTS.registration;
  if (event.type === APG_EVENT_TYPES.LOKI_QUESTION_ASKED || action.includes('loki')) return DEFAULT_WEIGHTS.loki;
  if (action.includes('search')) return DEFAULT_WEIGHTS.search;
  if (action.includes('favorite')) return DEFAULT_WEIGHTS.favorite;
  return DEFAULT_WEIGHTS.view;
}

export function recordInterestSignal(event) {
  if (!event?.id) return;
  const entityType = event.entityType || event.payload?.entityType || 'app';
  const entityId = String(event.entityId || event.payload?.id || event.payload?.entityId || '');
  const action = event.payload?.action || event.type;
  const category = event.payload?.category || event.payload?.categoryLabel || '';
  const weight = resolveWeight(event);

  addScore(interestModel.actions, action, weight);
  if (category) addScore(interestModel.categories, category, weight);
  if (interestModel.entities[entityType] && entityId) addScore(interestModel.entities[entityType], entityId, weight);
  if (event.type === APG_EVENT_TYPES.QR_SCANNED && event.payload?.subjectType && event.payload?.subjectId) {
    const subjectType = event.payload.subjectType;
    if (interestModel.entities[subjectType]) addScore(interestModel.entities[subjectType], event.payload.subjectId, weight);
  }

  pushSignal({
    id: event.id,
    time: event.timestamp,
    action,
    entityType,
    entityId,
    category,
    weight,
  });
}

export function wireInterestModel() {
  if (unsubscribe) return unsubscribe;
  unsubscribe = subscribeToEvents('*', recordInterestSignal);
  return unsubscribe;
}

export function getInterestModelSnapshot() {
  const top = (bucket, limit = 8) => Object.entries(bucket || {})
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, limit)
    .map(([id, score]) => ({ id, score }));

  return {
    version: 1,
    updatedAt: interestModel.updatedAt,
    topCategories: top(interestModel.categories),
    topActions: top(interestModel.actions),
    topEntities: {
      news: top(interestModel.entities.news),
      event: top(interestModel.entities.event),
      partner: top(interestModel.entities.partner),
      expert: top(interestModel.entities.expert),
    },
    signals: interestModel.signals.slice(0, 40),
    raw: {
      categories: { ...interestModel.categories },
      actions: { ...interestModel.actions },
      entities: {
        news: { ...interestModel.entities.news },
        event: { ...interestModel.entities.event },
        partner: { ...interestModel.entities.partner },
        expert: { ...interestModel.entities.expert },
        loki: { ...interestModel.entities.loki },
      },
    },
  };
}

export function clearInterestModel() {
  interestModel.updatedAt = null;
  interestModel.categories = {};
  interestModel.actions = {};
  interestModel.signals = [];
  interestModel.entities = { news: {}, event: {}, partner: {}, expert: {}, loki: {} };
}

