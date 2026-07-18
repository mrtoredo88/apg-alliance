export const LOKI_MEMORY_EVENTS = {
  CREATED: 'MEMORY_CREATED',
  UPDATED: 'MEMORY_UPDATED',
  USED: 'MEMORY_USED',
  DECAYED: 'MEMORY_DECAYED',
  EXPIRED: 'MEMORY_EXPIRED',
  SKIPPED: 'MEMORY_SKIPPED',
};

const MAX_MEMORY_HISTORY = 80;

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function createMemoryEvent(type, payload = {}) {
  return {
    type,
    status: payload.status || 'completed',
    memoryId: payload.memoryId || '',
    key: payload.key || '',
    reason: payload.reason || '',
    score: Number(payload.score || 0),
    at: new Date().toISOString(),
  };
}

export function addMemoryHistoryItem(history = [], event = {}) {
  if (!event?.type) return list(history).slice(0, MAX_MEMORY_HISTORY);
  return [{ ...event, at: event.at || new Date().toISOString() }, ...list(history)].slice(0, MAX_MEMORY_HISTORY);
}

export function appendMemoryEvents(history = [], events = []) {
  return list(events).reduce((acc, event) => addMemoryHistoryItem(acc, event), history);
}
