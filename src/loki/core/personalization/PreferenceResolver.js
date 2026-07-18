import { normalizeText } from '../lokiCoreUtils.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function addCounter(map, key, weight = 1) {
  const normalized = normalizeText(key);
  if (!normalized) return;
  map.set(normalized, (map.get(normalized) || 0) + weight);
}

function top(map, limit = 5) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, score]) => ({ value, score }));
}

export function resolvePreferences(userContext = {}) {
  const categories = new Map();
  const districts = new Map();
  const partners = new Map();
  const experts = new Map();
  const times = new Map();
  for (const item of [...list(userContext.favoritePartners), ...list(userContext.favoriteExperts)]) {
    addCounter(categories, item.category, 4);
    if (item.type === 'expert') addCounter(experts, item.id, 4);
    else addCounter(partners, item.id, 4);
  }
  for (const item of list(userContext.recentBookings)) {
    addCounter(categories, item.category, 3);
    addCounter(partners, item.providerId || item.partnerId || item.id, 2);
    const hour = new Date(item.ts || 0).getHours();
    if (item.ts && Number.isFinite(hour)) addCounter(times, `${hour}:00`, 1);
  }
  for (const item of list(userContext.recentVisits)) {
    addCounter(categories, item.category, 2);
    addCounter(partners, item.partnerId || item.id, 2);
  }
  if (userContext.district) addCounter(districts, userContext.district, 3);
  return {
    categories: top(categories),
    districts: top(districts),
    partners: top(partners),
    experts: top(experts),
    bookingTimes: top(times, 3),
    interests: {
      events: Number(userContext.counts?.activeEvents || 0) > 0,
      promotions: top(categories).length > 0,
      gifts: Number(userContext.keys || 0) > 0,
      workspace: Boolean(userContext.capabilities?.workspace),
    },
    hasEnoughData: categories.size > 0 || partners.size > 0 || experts.size > 0 || Number(userContext.counts?.favorites || 0) > 0 || Number(userContext.counts?.bookings || 0) > 0,
  };
}
