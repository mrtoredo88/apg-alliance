const OPPORTUNITY_HISTORY_KEY = 'apg_loki_opportunity_history_v1';
const MAX_HISTORY_ITEMS = 80;

function hasStorage() {
  return typeof localStorage !== 'undefined';
}

export const LOKI_OPPORTUNITY_EVENTS = {
  FOUND: 'LOKI_OPPORTUNITY_FOUND',
  SHOWN: 'LOKI_OPPORTUNITY_SHOWN',
  ACCEPTED: 'LOKI_OPPORTUNITY_ACCEPTED',
  DISMISSED: 'LOKI_OPPORTUNITY_DISMISSED',
  EXPIRED: 'LOKI_OPPORTUNITY_EXPIRED',
};

export function loadOpportunityHistory() {
  if (!hasStorage()) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(OPPORTUNITY_HISTORY_KEY) || '[]');
    return Array.isArray(raw) ? raw.slice(0, MAX_HISTORY_ITEMS) : [];
  } catch {
    return [];
  }
}

export function saveOpportunityHistory(items = []) {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(OPPORTUNITY_HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)));
  } catch {}
}

export function getOpportunityKey(opportunity = {}) {
  return [
    opportunity.type,
    opportunity.entityType || 'none',
    opportunity.entityId || opportunity.id || 'none',
    opportunity.conditionKey || 'stable',
  ].filter(Boolean).join(':');
}

export function recordOpportunityEvent(type, opportunity = {}, patch = {}) {
  const event = {
    id: `${Date.now()}_${type}_${opportunity.id || opportunity.type || 'opportunity'}`,
    type,
    opportunityId: opportunity.id || '',
    opportunityType: opportunity.type || '',
    opportunityKey: getOpportunityKey(opportunity),
    entityType: opportunity.entityType || '',
    entityId: opportunity.entityId || '',
    ts: Date.now(),
    at: new Date().toISOString(),
    ...patch,
  };
  const next = [event, ...loadOpportunityHistory()].slice(0, MAX_HISTORY_ITEMS);
  saveOpportunityHistory(next);
  return event;
}

export function getRecentOpportunityEvents({ opportunity, type, windowMs = Infinity, history = loadOpportunityHistory() } = {}) {
  const key = getOpportunityKey(opportunity);
  const cutoff = Date.now() - windowMs;
  return history.filter(item => (
    item.opportunityKey === key
    && (!type || item.type === type)
    && Number(item.ts || 0) >= cutoff
  ));
}

export function countConsecutiveDismisses(history = loadOpportunityHistory()) {
  let count = 0;
  for (const item of history) {
    if (item.type === LOKI_OPPORTUNITY_EVENTS.DISMISSED) count += 1;
    else if (item.type === LOKI_OPPORTUNITY_EVENTS.ACCEPTED) break;
  }
  return count;
}
