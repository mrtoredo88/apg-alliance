import { buildRecommendationFeed } from '../../LokiRecommendationCenter.js';
import { buildInterestProfile } from '../../../interestEngine.js';
import { buildLifeGraph } from '../../../lifeGraph.js';

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value.toDate) return value.toDate().getTime();
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function isToday(value, now = new Date()) {
  const ms = toMillis(value);
  if (!ms) return false;
  const date = new Date(ms);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function isActive(item) {
  return item?.archived !== true && item?.hidden !== true && item?.deleted !== true;
}

function hasPromotion(item = {}) {
  return Boolean(item.offer || item.promo || item.discount || item.specialOffer || item.actionText);
}

function cleanList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function sortFresh(items = []) {
  return [...items]
    .map(item => ({ item, ms: toMillis(item?.publishedAt ?? item?.createdAt ?? item?.date ?? item?.updatedAt) }))
    .sort((a, b) => b.ms - a.ms)
    .map(row => row.item);
}

function sortUpcoming(items = []) {
  const now = Date.now();
  return [...items]
    .map(item => ({ item, ms: toMillis(item?.startAt ?? item?.startsAt ?? item?.date ?? item?.eventDate) }))
    .filter(row => !row.ms || row.ms >= now - 86400000)
    .sort((a, b) => (a.ms || Number.MAX_SAFE_INTEGER) - (b.ms || Number.MAX_SAFE_INTEGER))
    .map(row => row.item);
}

function getUserName(user, appUser) {
  return String(user?.first_name || user?.name || appUser?.first_name || appUser?.name || '').trim();
}

export function buildLokiContext({ appState = {}, user = null, activePanel = 'home', memory = {}, userMemory = {} } = {}) {
  const now = new Date();
  const partners = cleanList(appState.partners).filter(isActive);
  const experts = cleanList(appState.experts).filter(isActive);
  const events = cleanList(appState.events).filter(isActive);
  const news = cleanList(appState.news).filter(isActive);
  const tasks = cleanList(appState.customTasks);
  const notifications = cleanList(appState.notifications);
  const favorites = cleanList(appState.favorites).map(String);
  const completedTasks = cleanList(appState.completedTasks).map(String);
  const interestProfile = buildInterestProfile({ profile: appState.interestProfile, appState: { ...appState, partners, experts, events, news, favorites, registeredEventIds: appState.registeredEventIds }, memory, userMemory });
  const recommendationFeed = buildRecommendationFeed({ appState: { ...appState, partners, experts, events, news, customTasks: tasks, notifications, user, activePanel, interestProfile }, memory, userMemory, limit: 12 });
  const recommendedEvents = recommendationFeed.filter(item => item.type === 'event');
  const partnerRecommendations = recommendationFeed.filter(item => item.type === 'partner');
  const expertRecommendations = recommendationFeed.filter(item => item.type === 'expert');
  const activePromotions = partners.filter(hasPromotion);
  const lifeGraph = buildLifeGraph({
    news,
    events,
    partners,
    experts,
    tasks,
    rewards: cleanList(appState.prizes ?? appState.rewards),
    promotions: cleanList(appState.promotions),
    interestProfile,
  });
  const topNews = sortFresh(news).slice(0, 5);
  const eventsToday = sortUpcoming(events).filter(item => isToday(item?.startAt ?? item?.startsAt ?? item?.date ?? item?.eventDate, now));
  const activeTasks = tasks.filter(item => !completedTasks.includes(String(item?.id ?? '')));

  return {
    __lokiContext: true,
    version: 1,
    generatedAt: now.toISOString(),
    user: user ?? appState.user ?? null,
    profile: {
      id: user?.id ?? appState.user?.id ?? null,
      name: getUserName(user, appState.user),
      platform: appState.platform ?? 'web-app',
      isGuest: String(user?.id ?? appState.user?.id ?? '').startsWith('guest_'),
    },
    location: {
      available: Boolean(appState.location),
      value: appState.location ?? null,
    },
    currentScreen: {
      id: activePanel,
      name: activePanel,
      openedAt: memory?.lastPanel === activePanel ? memory?.lastPanelAt ?? null : null,
    },
    favorites: {
      ids: favorites,
      partners: partners.filter(item => favorites.includes(String(item.id))),
      count: favorites.length,
    },
    tasks: {
      all: tasks,
      active: activeTasks,
      completedIds: completedTasks,
      activeCount: activeTasks.length,
      completedCount: completedTasks.length,
    },
    keys: {
      balance: Number(appState.userKeys ?? 0),
      lastScanDate: appState.lastScanDate ?? null,
      registeredEventIds: cleanList(appState.registeredEventIds).map(String),
    },
    eventsToday,
    recommendedEvents,
    partnerRecommendations,
    expertRecommendations,
    recommendations: {
      feed: recommendationFeed,
      graph: lifeGraph.recommendations,
    },
    lifeGraph,
    interestProfile,
    activePromotions,
    topNews,
    notifications,
    achievements: completedTasks,
    weather: null,
    memory: {
      activeContext: memory?.activeContext ?? null,
      lastContext: memory?.lastContext ?? null,
      lastConversation: memory?.lastConversation ?? null,
    },
    future: {
      weather: null,
      calendar: null,
      conversationHistory: null,
      geo: null,
      aiModules: null,
    },
    appState: {
      ...appState,
      user: user ?? appState.user ?? null,
      activePanel,
      partners,
      experts,
      events,
      news,
      customTasks: tasks,
      notifications,
      favorites,
      completedTasks,
      interestProfile,
      lifeGraph: {
        version: lifeGraph.version,
        nodeCount: lifeGraph.nodes.length,
        edgeCount: lifeGraph.edges.length,
        recommendations: lifeGraph.recommendations,
      },
    },
  };
}
