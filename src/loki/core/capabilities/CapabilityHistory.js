const MAX_CAPABILITY_HISTORY = 100;

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function addCapabilityHistoryItem(history = [], capabilityContext = {}) {
  if (!capabilityContext?.capability) return list(history).slice(0, MAX_CAPABILITY_HISTORY);
  const item = {
    id: `capability-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    capability: capabilityContext.capability,
    title: capabilityContext.title || '',
    category: capabilityContext.category || '',
    confidence: Number(capabilityContext.confidence || 0),
    missing: list(capabilityContext.missing),
    alternatives: list(capabilityContext.alternatives).map(row => row.id).filter(Boolean).slice(0, 3),
    executionOrder: list(capabilityContext.executionOrder).map(row => row.capability).filter(Boolean),
    createdAt: capabilityContext.createdAt || new Date().toISOString(),
  };
  return [item, ...list(history)].slice(0, MAX_CAPABILITY_HISTORY);
}

export function buildCapabilityHistoryPatch(memory = {}, capabilityContext = {}) {
  return {
    capabilityHistory: addCapabilityHistoryItem(memory.capabilityHistory, capabilityContext),
  };
}

export class CapabilityHistory {
  constructor(history = []) {
    this.history = list(history).slice(0, MAX_CAPABILITY_HISTORY);
  }

  add(context = {}) {
    this.history = addCapabilityHistoryItem(this.history, context);
    return this.history;
  }
}
