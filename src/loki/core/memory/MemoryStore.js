import { normalizeText } from '../lokiCoreUtils.js';
import { appendMemoryEvents, createMemoryEvent, LOKI_MEMORY_EVENTS } from './MemoryHistory.js';
import { sanitizeMemoryMetadata, validateMemorySignal } from './MemoryValidator.js';

export const MEMORY_BUCKETS = {
  PREFERENCES: 'preferences',
  ACTIVITY: 'activity',
  CONVERSATIONS: 'conversations',
  RECOMMENDATIONS: 'recommendations',
};

export const DEFAULT_LOKI_MEMORY_STORE = {
  version: 'v1',
  preferences: {},
  activity: {},
  conversations: {},
  recommendations: {},
  history: [],
  updatedAt: null,
};

function entryId(type, key) {
  return `${type}:${normalizeText(key)}`;
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function bucketForType(type = '') {
  if (type === 'activity') return MEMORY_BUCKETS.ACTIVITY;
  if (type === 'conversation') return MEMORY_BUCKETS.CONVERSATIONS;
  if (type === 'recommendation') return MEMORY_BUCKETS.RECOMMENDATIONS;
  return MEMORY_BUCKETS.PREFERENCES;
}

export function normalizeMemoryStore(memory = {}) {
  return {
    ...DEFAULT_LOKI_MEMORY_STORE,
    ...(memory && typeof memory === 'object' ? memory : {}),
    preferences: { ...(memory?.preferences || {}) },
    activity: { ...(memory?.activity || {}) },
    conversations: { ...(memory?.conversations || {}) },
    recommendations: { ...(memory?.recommendations || {}) },
    history: Array.isArray(memory?.history) ? memory.history.filter(Boolean).slice(0, 80) : [],
  };
}

export function upsertMemorySignal(memory = {}, rawSignal = {}, now = Date.now()) {
  const store = normalizeMemoryStore(memory);
  const validation = validateMemorySignal(rawSignal);
  if (!validation.ok) {
    return { memory: { ...store, history: appendMemoryEvents(store.history, [validation.event]), updatedAt: new Date(now).toISOString() }, events: [validation.event], entry: null };
  }
  const signal = validation.signal;
  const bucket = bucketForType(signal.type);
  const id = entryId(signal.type, signal.key);
  const previous = store[bucket][id] || null;
  const frequency = Number(previous?.frequency || 0) + Math.max(1, Number(signal.weight || 1));
  const confidence = clamp((Number(previous?.confidence || 0.4) + 0.12 + Math.min(0.18, frequency / 40)), 0.2, 0.98);
  const relevance = clamp((Number(previous?.relevance || 0.4) + Number(signal.relevance || 0.2) + Math.min(0.18, frequency / 60)), 0.1, 1);
  const entry = {
    id,
    type: signal.type,
    key: signal.key,
    label: signal.label,
    scope: signal.scope,
    frequency,
    confidence: Math.round(confidence * 100) / 100,
    relevance: Math.round(relevance * 100) / 100,
    decay: 1,
    lastUsed: new Date(now).toISOString(),
    createdAt: previous?.createdAt || new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    metadata: sanitizeMemoryMetadata({ ...(previous?.metadata || {}), ...(signal.metadata || {}) }),
  };
  const event = createMemoryEvent(previous ? LOKI_MEMORY_EVENTS.UPDATED : LOKI_MEMORY_EVENTS.CREATED, { memoryId: id, key: signal.key, score: entry.relevance });
  return {
    memory: {
      ...store,
      [bucket]: { ...store[bucket], [id]: entry },
      history: appendMemoryEvents(store.history, [event]),
      updatedAt: new Date(now).toISOString(),
    },
    events: [event],
    entry,
  };
}

export function applyMemoryDecay(memory = {}, now = Date.now()) {
  const store = normalizeMemoryStore(memory);
  const events = [];
  const next = { ...store };
  for (const bucket of Object.values(MEMORY_BUCKETS)) {
    next[bucket] = Object.fromEntries(Object.entries(store[bucket]).flatMap(([id, entry]) => {
      const last = new Date(entry.lastUsed || entry.updatedAt || now).getTime();
      const days = Math.max(0, Math.floor((now - last) / 86400000));
      const decay = Math.max(0, Math.round((1 - days * 0.015) * 100) / 100);
      if (decay <= 0.15) {
        events.push(createMemoryEvent(LOKI_MEMORY_EVENTS.EXPIRED, { memoryId: id, key: entry.key, reason: 'decay_expired' }));
        return [];
      }
      if (decay < Number(entry.decay || 1)) events.push(createMemoryEvent(LOKI_MEMORY_EVENTS.DECAYED, { memoryId: id, key: entry.key, score: decay }));
      return [[id, { ...entry, decay }]];
    }));
  }
  return {
    memory: { ...next, history: appendMemoryEvents(store.history, events), updatedAt: events.length ? new Date(now).toISOString() : store.updatedAt },
    events,
  };
}

export function rememberSignals(memory = {}, signals = [], now = Date.now()) {
  const decayed = applyMemoryDecay(memory, now);
  return signals.reduce((state, signal) => {
    const result = upsertMemorySignal(state.memory, signal, now);
    return { memory: result.memory, events: [...state.events, ...result.events] };
  }, decayed);
}
