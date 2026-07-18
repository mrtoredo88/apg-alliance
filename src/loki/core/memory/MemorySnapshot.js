import { normalizeMemoryStore } from './MemoryStore.js';
import { rankMemoryEntries } from './MemoryRanker.js';
import { createMemoryEvent, LOKI_MEMORY_EVENTS } from './MemoryHistory.js';

function values(object = {}) {
  return Object.values(object || {}).filter(Boolean);
}

function topLabels(entries = [], limit = 5) {
  return entries.slice(0, limit).map(entry => ({ key: entry.key, label: entry.label, score: entry.score, confidence: entry.confidence }));
}

export function buildMemorySnapshot({ memory = {}, query = '', intent = {}, limit = 12 } = {}) {
  const store = normalizeMemoryStore(memory);
  const all = [
    ...values(store.preferences),
    ...values(store.activity),
    ...values(store.conversations),
    ...values(store.recommendations),
  ];
  const ranked = rankMemoryEntries(all, { query, limit });
  const used = ranked.filter(entry => Number(entry.score || 0) >= 0.35).slice(0, limit);
  const skipped = all.filter(entry => !used.some(item => item.id === entry.id)).slice(0, 12);
  return {
    version: 'v1',
    source: 'local_user_memory',
    intent: intent.id || '',
    query,
    used,
    skipped: skipped.map(entry => ({ id: entry.id, key: entry.key, reason: 'low_relevance' })),
    preferences: topLabels(used.filter(entry => entry.type === 'preference')),
    activity: topLabels(used.filter(entry => entry.type === 'activity')),
    conversations: topLabels(used.filter(entry => entry.type === 'conversation'), 3),
    recommendations: topLabels(used.filter(entry => entry.type === 'recommendation'), 3),
    events: used.map(entry => createMemoryEvent(LOKI_MEMORY_EVENTS.USED, { memoryId: entry.id, key: entry.key, score: entry.score })),
    empty: used.length === 0,
  };
}
