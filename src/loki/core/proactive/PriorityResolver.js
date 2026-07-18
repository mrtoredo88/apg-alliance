import { LOKI_MESSAGE_PRIORITY } from '../../lokiActionTypes.js';

export const OPPORTUNITY_PRIORITY_ORDER = {
  CRITICAL: 700,
  BOOKING_SOON: 600,
  EVENT_SOON: 500,
  PROMOTION_NEW: 400,
  REWARD_AVAILABLE: 300,
  WORKSPACE_BOOKINGS: 220,
  WORKSPACE_DIALOGS: 220,
  ADMIN_ATTENTION: 650,
  JOURNEY_RESUME: 550,
  GENERAL: 100,
};

export function resolveOpportunityPriority(opportunity = {}) {
  const base = OPPORTUNITY_PRIORITY_ORDER[opportunity.type] ?? OPPORTUNITY_PRIORITY_ORDER.GENERAL;
  const urgency = Number(opportunity.urgency || 0);
  const confidence = Number(opportunity.confidence || 0.7);
  const score = base + urgency + Math.round(confidence * 40);
  const priority = score >= 650
    ? LOKI_MESSAGE_PRIORITY.CRITICAL
    : score >= 520
      ? LOKI_MESSAGE_PRIORITY.HIGH
      : score >= 260
        ? LOKI_MESSAGE_PRIORITY.NORMAL
        : LOKI_MESSAGE_PRIORITY.LOW;
  return { ...opportunity, score, priority };
}

export function pickTopOpportunity(opportunities = []) {
  return opportunities
    .filter(Boolean)
    .map(resolveOpportunityPriority)
    .sort((a, b) => b.score - a.score)[0] ?? null;
}
