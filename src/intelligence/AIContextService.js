import { buildInterestProfile } from '../interestEngine.js';

function safeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const ms = value?.toDate ? value.toDate().getTime() : new Date(value).getTime();
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function toStringValue(value) {
  if (value == null) return '';
  return String(value).trim();
}

function normalizeRecent(item, fallbackName = '') {
  if (!item || typeof item !== 'object') return null;
  const id = item.id || item.uid || item.userId || null;
  if (!id) return null;
  return {
    id: String(id),
    name: toStringValue(item.name || item.title || item.shortName || fallbackName),
    type: item.type || item.kind || '',
  };
}

export function buildAIContext({
  user = null,
  activePanel = 'home',
  partners = [],
  experts = [],
  events = [],
  news = [],
  favorites = [],
  notifications = [],
  rewards = [],
  customTasks = [],
  completedTasks = [],
  userKeys = 0,
  interestProfile = null,
  recentActions = [],
  registeredEventIds = [],
  savedNews = [],
  readLaterNews = [],
  joinedGroup = false,
  referralCount = 0,
  streak = 0,
  scanCount = 0,
  source = 'web-app',
  location = null,
} = {}) {
  const normalizedPartners = normalizeList(partners);
  const normalizedExperts = normalizeList(experts);
  const normalizedEvents = normalizeList(events);
  const normalizedNews = normalizeList(news);

  const computedInterestProfile = buildInterestProfile({
    profile: interestProfile,
    appState: {
      partners: normalizedPartners,
      experts: normalizedExperts,
      events: normalizedEvents,
      news: normalizedNews,
      favorites,
      notifications,
      rewards,
      tasks: normalized(customTasks),
      completedTasks,
      userKeys,
      referralCount,
    },
  }) ?? {};

  const ownedRoles = [];
  if (user?.role) ownedRoles.push(String(user.role));
  if (toStringValue(user?.roleGroup)) ownedRoles.push(String(user.roleGroup));

  const lastActions = Array.isArray(recentActions)
    ? recentActions.map(item => normalizeRecent(item, 'Действие')).filter(Boolean)
    : [];

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    user: {
      id: toStringValue(user?.id || user?.uid),
      name: toStringValue(user?.name || user?.first_name || user?.firstName || 'Гость'),
      roles: Array.from(new Set(ownedRoles)).filter(Boolean),
      city: toStringValue(user?.city || user?.address || location?.city),
      level: toStringValue(user?.level || user?.rank || ''),
      isGuest: toStringValue(user?.id || user?.uid).startsWith('guest_'),
      source,
      createdAt: safeDate(user?.createdAt || user?.created_at),
    },
    keys: Number(userKeys) || 0,
    activity: {
      streak: Number(streak) || 0,
      joinedGroup: Boolean(joinedGroup),
      referralCount: Number(referralCount) || 0,
      scanCount: Number(scanCount) || 0,
      eventsRegistered: Number(Array.isArray(registeredEventIds) ? registeredEventIds.length : 0),
      favoritesCount: Number(Array.isArray(favorites) ? favorites.length : 0),
      readLaterCount: Number(Array.isArray(readLaterNews) ? readLaterNews.length : 0),
      savedNewsCount: Number(Array.isArray(savedNews) ? savedNews.length : 0),
    },
    platform: {
      source,
      activePanel,
      hasLocation: Boolean(location),
      location: location || null,
    },
    interestProfile: computedInterestProfile,
    assets: {
      partnersCount: normalizedPartners.length,
      expertsCount: normalizedExperts.length,
      eventsCount: normalizedEvents.length,
      newsCount: normalizedNews.length,
      activeTasksCount: normalizeList(customTasks).length,
      completedTasksCount: normalizeList(completedTasks).length,
      notificationsCount: normalizeList(notifications).length,
      rewardsCount: normalizeList(rewards).length,
    },
    recentActivity: {
      actions: lastActions,
      lastNotification: normalizeRecent(notifications?.[0], 'Уведомление'),
      latestTask: normalizeRecent(completedTasks?.[0], 'Задача'),
      latestReward: normalizeRecent(rewards?.[0], 'Награда'),
    },
  };
}

function normalize(list) {
  return normalizeList(list);
}
