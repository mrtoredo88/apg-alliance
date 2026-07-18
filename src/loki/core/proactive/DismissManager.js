import {
  LOKI_OPPORTUNITY_EVENTS,
  countConsecutiveDismisses,
  getRecentOpportunityEvents,
  recordOpportunityEvent,
} from './OpportunityHistory.js';

export const OPPORTUNITY_COOLDOWNS = {
  BOOKING_SOON: Infinity,
  EVENT_SOON: Infinity,
  PROMOTION_NEW: 1000 * 60 * 60 * 12,
  REWARD_AVAILABLE: 1000 * 60 * 60 * 24,
  JOURNEY_RESUME: 1000 * 60 * 30,
  WORKSPACE_BOOKINGS: 1000 * 60 * 20,
  WORKSPACE_DIALOGS: 1000 * 60 * 20,
  ADMIN_ATTENTION: 1000 * 60 * 30,
  GENERAL: 1000 * 60 * 60 * 6,
};

export function getCooldownForOpportunity(opportunity = {}) {
  return OPPORTUNITY_COOLDOWNS[opportunity.type] ?? OPPORTUNITY_COOLDOWNS.GENERAL;
}

export function isOpportunityDismissed(opportunity = {}, history) {
  const cooldown = getCooldownForOpportunity(opportunity);
  const recentDismisses = getRecentOpportunityEvents({
    opportunity,
    type: LOKI_OPPORTUNITY_EVENTS.DISMISSED,
    windowMs: cooldown,
    history,
  });
  return recentDismisses.length > 0;
}

export function isOpportunityAlreadyShown(opportunity = {}, history) {
  const cooldown = getCooldownForOpportunity(opportunity);
  const recentShown = getRecentOpportunityEvents({
    opportunity,
    type: LOKI_OPPORTUNITY_EVENTS.SHOWN,
    windowMs: cooldown,
    history,
  });
  return recentShown.length > 0;
}

export function getSilentModeMultiplier(history) {
  const dismisses = countConsecutiveDismisses(history);
  if (dismisses >= 8) return 6;
  if (dismisses >= 5) return 3;
  if (dismisses >= 3) return 1.7;
  return 1;
}

export function markOpportunityShown(opportunity) {
  return recordOpportunityEvent(LOKI_OPPORTUNITY_EVENTS.SHOWN, opportunity);
}

export function markOpportunityAccepted(opportunity) {
  return recordOpportunityEvent(LOKI_OPPORTUNITY_EVENTS.ACCEPTED, opportunity);
}

export function markOpportunityDismissed(opportunity) {
  return recordOpportunityEvent(LOKI_OPPORTUNITY_EVENTS.DISMISSED, opportunity);
}

export function markOpportunityExpired(opportunity, reason = 'expired') {
  return recordOpportunityEvent(LOKI_OPPORTUNITY_EVENTS.EXPIRED, opportunity, { reason });
}
