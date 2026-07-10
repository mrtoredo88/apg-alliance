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
};

export function getReputationStatus(reputation = 0) {
  const value = Math.max(0, Number(reputation || 0));
  return [...ECONOMY_CONFIG.reputationStatuses].reverse().find(status => value >= status.min) || ECONOMY_CONFIG.reputationStatuses[0];
}

export function calculateTicketExchange(ticketCount = 1) {
  const tickets = Math.max(1, Math.min(100, Number(ticketCount || 1)));
  return {
    tickets,
    keyCost: tickets * ECONOMY_CONFIG.tickets.exchangeRateKeys,
    exchangeRateKeys: ECONOMY_CONFIG.tickets.exchangeRateKeys,
  };
}

export function normalizeOpportunityType(prize = {}) {
  const type = String(prize.opportunityType || prize.type || 'purchase').trim();
  if (type === 'raffle') return 'raffle';
  if (type === 'closed_event') return 'closed_event';
  if (type === 'certificate') return 'certificate';
  if (type === 'discount') return 'discount';
  if (type === 'exclusive') return 'exclusive';
  return 'reward';
}
