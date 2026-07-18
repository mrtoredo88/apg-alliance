import { countBy, normalizeLokiAnalyticsRows, percent, text } from './ConversationAnalytics.js';

const EVENT_SUFFIX = {
  LOKI_OPPORTUNITY_FOUND: 'found',
  LOKI_OPPORTUNITY_SHOWN: 'shown',
  LOKI_OPPORTUNITY_ACCEPTED: 'accepted',
  LOKI_OPPORTUNITY_DISMISSED: 'dismissed',
  LOKI_OPPORTUNITY_EXPIRED: 'expired',
};

function proactiveEventType(row = {}) {
  return text(row.type || row.eventType || row.status || '').toUpperCase();
}

function opportunityType(row = {}) {
  return text(row.opportunityType || row.opportunity?.type || row.intent?.replace(/^proactive\./, '') || row.source || 'unknown', 120);
}

export function buildProactiveAnalytics(rows = [], opportunityEvents = []) {
  const normalized = normalizeLokiAnalyticsRows(rows);
  const adminRows = normalized.filter(row => row.source.includes('proactive') || row.intent.startsWith('proactive.'));
  const events = [...opportunityEvents, ...adminRows].map(row => ({
    ...row,
    eventKind: EVENT_SUFFIX[proactiveEventType(row)] || text(row.status || row.kind || 'shown').toLowerCase(),
    opportunityType: opportunityType(row),
  }));
  const byOpportunity = countBy(events, row => row.opportunityType, 40).map(item => {
    const found = item.rows.filter(row => row.eventKind === 'found').length;
    const shown = item.rows.filter(row => row.eventKind === 'shown').length;
    const accepted = item.rows.filter(row => row.eventKind === 'accepted').length;
    const dismissed = item.rows.filter(row => row.eventKind === 'dismissed').length;
    const expired = item.rows.filter(row => row.eventKind === 'expired').length;
    return { ...item, found, shown, accepted, dismissed, expired, acceptedRate: percent(accepted, shown || item.count) };
  });
  const shown = events.filter(row => row.eventKind === 'shown').length;
  const accepted = events.filter(row => row.eventKind === 'accepted').length;
  const dismissed = events.filter(row => row.eventKind === 'dismissed').length;
  const expired = events.filter(row => row.eventKind === 'expired').length;
  return {
    total: events.length,
    shown,
    accepted,
    dismissed,
    expired,
    acceptedRate: percent(accepted, shown),
    byOpportunity,
    hasEventData: events.length > 0,
  };
}
