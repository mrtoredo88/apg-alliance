import { FieldValue } from 'firebase-admin/firestore';

export const ECONOMY_VERSION = '1.0';

export const ECONOMY_CONFIG = {
  currency: { key: 'keys', label: 'Ключи', emoji: '🔑' },
  tickets: { key: 'tickets', label: 'Билеты', emoji: '🎟️', exchangeRateKeys: 5 },
  rewards: {
    daily_activity: { keys: 1, reputation: 1 },
    news_read: { keys: 1, reputation: 1 },
    comment: { keys: 2, reputation: 2 },
    review: { keys: 3, reputation: 4 },
    task_complete: { keys: null, reputation: 5 },
    referral: { keys: 2, reputation: 8 },
    news_proposal: { keys: 4, reputation: 6 },
    event_participation: { keys: 4, reputation: 7 },
    partner_visit: { keys: 2, reputation: 5 },
    expert_visit: { keys: 3, reputation: 6 },
    purchase: { keys: 3, reputation: 6 },
    qr_use: { keys: 1, reputation: 2 },
  },
  reputationStatuses: [
    { id: 'newbie', label: 'Новичок', min: 0 },
    { id: 'explorer', label: 'Исследователь', min: 25 },
    { id: 'active_member', label: 'Активный участник', min: 80 },
    { id: 'ambassador', label: 'Амбассадор', min: 180 },
    { id: 'legend', label: 'Легенда АПГ', min: 420 },
  ],
  seasons: [
    { id: 'sport_month', label: 'Месяц спорта', categories: ['sport', 'health'], multiplier: 1.25 },
    { id: 'family_month', label: 'Месяц семьи', categories: ['family', 'children'], multiplier: 1.25 },
    { id: 'business_month', label: 'Месяц бизнеса', categories: ['business', 'education'], multiplier: 1.25 },
    { id: 'health_month', label: 'Месяц здоровья', categories: ['health', 'beauty'], multiplier: 1.25 },
  ],
};

export function getEconomyReward(action, fallbackKeys = 0) {
  const reward = ECONOMY_CONFIG.rewards[action] || {};
  return {
    keys: reward.keys === null ? Math.max(0, Number(fallbackKeys || 0)) : Math.max(0, Number(reward.keys || 0)),
    reputation: Math.max(0, Number(reward.reputation || 0)),
  };
}

export function getReputationStatus(reputation = 0) {
  const value = Math.max(0, Number(reputation || 0));
  return [...ECONOMY_CONFIG.reputationStatuses].reverse().find(status => value >= status.min) || ECONOMY_CONFIG.reputationStatuses[0];
}

export function economyMigrationPatch(user = {}) {
  const reputation = Math.max(0, Number(user.reputation || user.keys || 0));
  const status = getReputationStatus(reputation);
  return {
    economyVersion: ECONOMY_VERSION,
    tickets: Math.max(0, Number(user.tickets || 0)),
    reputation,
    reputationStatus: status.id,
    reputationStatusLabel: status.label,
  };
}

export function applyEconomyAward(tx, userRef, { action, keys, reputation, meta = {}, text = '', icon = '🔑' }) {
  const keyDelta = Math.max(0, Number(keys || 0));
  const repDelta = Math.max(0, Number(reputation || 0));
  const patch = {
    economyVersion: ECONOMY_VERSION,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (keyDelta > 0) patch.keys = FieldValue.increment(keyDelta);
  if (repDelta > 0) patch.reputation = FieldValue.increment(repDelta);
  tx.set(userRef, patch, { merge: true });
  tx.set(userRef.collection('activity').doc(), {
    type: action,
    icon,
    text: text || `${icon} +${keyDelta} ключей`,
    keys: keyDelta,
    reputation: repDelta,
    economyVersion: ECONOMY_VERSION,
    meta,
    ts: FieldValue.serverTimestamp(),
  });
}

export function normalizeOpportunity(prize = {}) {
  const type = String(prize.opportunityType || prize.type || 'purchase').trim();
  return {
    ...prize,
    opportunityType: type === 'closed_event' ? 'closed_event' : type === 'raffle' ? 'raffle' : type === 'certificate' ? 'certificate' : type === 'discount' ? 'discount' : type === 'exclusive' ? 'exclusive' : 'reward',
    cost: Math.max(0, Number(prize.cost || 0)),
  };
}

export function calculateTicketExchange(ticketCount = 1) {
  const tickets = Math.max(1, Math.min(100, Number(ticketCount || 1)));
  return {
    tickets,
    keyCost: tickets * ECONOMY_CONFIG.tickets.exchangeRateKeys,
    exchangeRateKeys: ECONOMY_CONFIG.tickets.exchangeRateKeys,
  };
}
