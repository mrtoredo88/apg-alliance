import { buildInterestProfile } from '../interestEngine.js';
import { getAIMemorySnapshot } from './AIMemory.js';
import { getActivityTimeline } from './ActivityTimeline.js';

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
  aiMemory = null,
  activityTimeline = null,
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

  const memory = aiMemory || getAIMemorySnapshot();
  const timeline = Array.isArray(activityTimeline) ? activityTimeline : getActivityTimeline(40);
  const lastActions = Array.isArray(recentActions) && recentActions.length
    ? recentActions.map(item => normalizeRecent(item, 'Действие')).filter(Boolean)
    : memory.lastActions?.map(item => normalizeRecent({ id: item.id, name: item.action, type: item.entityType }, 'Действие')).filter(Boolean)
      || [];

  const favoritePartnerIds = Array.from(new Set([
    ...(Array.isArray(favorites) ? favorites.map(String) : []),
    ...(memory.favoritePartners || []).map(item => String(item.id || '')).filter(Boolean),
  ]));

  const frequentActions = Object.entries(memory.frequentActions || {})
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 8)
    .map(([action, count]) => ({ action, count }));

  const recentCategories = [
    ...(memory.lastViewedPartners || []),
    ...(memory.lastViewedExperts || []),
    ...(memory.lastViewedEvents || []),
    ...(memory.lastViewedNews || []),
  ].map(item => item.category).filter(Boolean);
  const categoryCounts = recentCategories.reduce((acc, category) => {
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});
  const favoriteCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([category]) => category)
    .slice(0, 8);

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
      frequentActions,
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
      timeline: timeline.slice(0, 20),
      lastViewedNews: memory.lastViewedNews || [],
      lastViewedEvents: memory.lastViewedEvents || [],
      lastViewedPartners: memory.lastViewedPartners || [],
      lastViewedExperts: memory.lastViewedExperts || [],
      latestAchievements: memory.latestAchievements || [],
      lastLokiQuestions: memory.lastLokiQuestions || [],
      lastRecommendations: memory.lastRecommendations || [],
    },
    preferenceSignals: {
      favoritePartnerIds,
      favoriteExpertIds: (memory.favoriteExperts || []).map(item => String(item.id || '')).filter(Boolean),
      favoriteCategories,
      repeatedOpenings: frequentActions.filter(item => /open|view/i.test(item.action)),
      timeOfDay: new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'day' : 'evening',
    },
  };
}

function normalize(list) {
  return normalizeList(list);
}
