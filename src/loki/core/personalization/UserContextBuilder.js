import { normalizeText, toMillis } from '../lokiCoreUtils.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function idOf(value) {
  if (!value) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return String(value.id || value.partnerId || value.expertId || value.providerId || '');
}

function compactItem(item = {}) {
  return {
    id: String(item.id || ''),
    type: item.type || item.entityType || '',
    title: item.title || item.name || item.providerName || item.partnerName || item.expertName || '',
    category: item.category || item.categoryLabel || item.specialization || '',
    ts: toMillis(item.createdAt ?? item.updatedAt ?? item.startAt ?? item.date ?? item.completedAt),
  };
}

function activeOnly(item = {}) {
  const status = normalizeText(item.status || item.lifecycleStatus || '');
  return item.deleted !== true && item.archived !== true && !['deleted', 'archived', 'cancelled'].includes(status);
}

export function buildPersonalUserContext({ context = {}, appState = {} } = {}) {
  const sources = context.knowledgeEngine?.sources || {};
  const user = context.user || appState.user || {};
  const rawFavorites = list(user.favorites || appState.favorites || context.favorites?.ids);
  const favoriteIds = new Set(rawFavorites.map(idOf).filter(Boolean));
  const partners = list(sources.partners || context.apg?.partners || appState.partners).filter(activeOnly);
  const experts = list(sources.experts || context.apg?.experts || appState.experts).filter(activeOnly);
  const bookings = list(sources.bookings || appState.bookings || appState.meetings).filter(activeOnly);
  const visits = list(appState.visits || appState.scans || appState.completedBookings || context.visits).filter(activeOnly);
  const events = list(sources.events || context.apg?.events || appState.events).filter(activeOnly);
  const dialogs = list(sources.dialogs || appState.dialogs || appState.contextDialogs).filter(activeOnly);
  const reviews = list(sources.reviews || appState.reviews || appState.partnerReviews || appState.expertReviews).filter(activeOnly);
  const favoritePartners = partners.filter(item => favoriteIds.has(String(item.id)));
  const favoriteExperts = experts.filter(item => favoriteIds.has(String(item.id)));
  const recentBookings = bookings
    .map(compactItem)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 8);
  const recentVisits = visits
    .map(compactItem)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 8);
  const activeBookings = bookings.filter(item => !['done', 'completed', 'cancelled'].includes(normalizeText(item.status))).map(compactItem).slice(0, 6);
  const activeEvents = events.filter(item => {
    const ts = toMillis(item.startAt ?? item.startsAt ?? item.date);
    return !ts || ts >= Date.now() - 86400000;
  }).map(compactItem).slice(0, 6);
  const workspace = sources.workspaceAnalytics || appState.analytics || appState.workspaceAnalytics || null;
  return {
    role: context.actor?.role || user.role || user.userRole || 'user',
    city: user.city || context.user?.city || 'Зеленоград',
    district: user.district || appState.district || '',
    level: Number(user.level || appState.userLevel || appState.level || 0),
    keys: Number(user.keys ?? appState.userKeys ?? 0),
    reputation: Number(user.reputation || appState.reputation || 0),
    achievements: list(user.achievements || appState.achievements).slice(0, 12),
    favoriteIds,
    favoritePartners: favoritePartners.map(compactItem),
    favoriteExperts: favoriteExperts.map(compactItem),
    recentBookings,
    recentVisits,
    activeBookings,
    activeEvents,
    recentDialogs: dialogs.map(compactItem).slice(0, 6),
    reviews: reviews.map(compactItem).slice(0, 8),
    workspace,
    capabilities: {
      workspace: Boolean(workspace || ['partner', 'expert', 'admin', 'owner'].includes(normalizeText(context.actor?.role || user.role))),
      booking: true,
      gifts: Number(user.keys ?? appState.userKeys ?? 0) > 0,
      events: events.length > 0,
    },
    counts: {
      favorites: favoriteIds.size,
      bookings: bookings.length,
      visits: visits.length,
      dialogs: dialogs.length,
      reviews: reviews.length,
      activeBookings: activeBookings.length,
      activeEvents: activeEvents.length,
    },
  };
}
