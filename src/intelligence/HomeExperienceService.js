import { buildAIContext } from './AIContextService.js';
import {
  buildPersonalHomeSuggestions,
  recommendEvents,
  recommendExperts,
  recommendNews,
  recommendPartners,
  recommendTasks,
} from './recommendationEngine.js';
import { buildContinueExperience } from './ContinueExperience.js';

function text(value, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function entityTitle(row, fallback = 'Рекомендация АПГ') {
  const item = row?.item || row || {};
  return text(item.title || item.name || item.offer || item.specialization || row?.title, fallback);
}

function getEventMs(event) {
  const value = event?.startAt || event?.startsAt || event?.eventDate || event?.date || event?.deadline;
  const ms = value?.toDate ? value.toDate().getTime() : new Date(value || 0).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function keysToNextAchievement(userKeys = 0) {
  const current = Number(userKeys) || 0;
  if (current <= 0) return 1;
  const step = current < 10 ? 10 : current < 25 ? 25 : current < 50 ? 50 : Math.ceil((current + 1) / 25) * 25;
  return Math.max(0, step - current);
}

function explain(base, reasons = []) {
  return [base, ...reasons].filter(Boolean).slice(0, 4);
}

function buildDynamicSections({ aiContext, continueExperience, recommendations, appState }) {
  const sections = [
    { id: 'forYou', label: 'Для вас', priority: 80 + recommendations.feed.length },
    { id: 'today', label: 'Сегодня', priority: 70 + recommendations.events.length },
    { id: 'continue', label: 'Продолжить', priority: continueExperience.items.length ? 95 : 20 },
    { id: 'nearby', label: 'Рядом', priority: appState.location || aiContext.platform.hasLocation ? 72 : 42 },
    { id: 'popular', label: 'Популярное', priority: 50 + Number(aiContext.activity.frequentActions?.length || 0) },
    { id: 'new', label: 'Новое', priority: 45 + recommendations.news.length },
    { id: 'favorites', label: 'Избранное', priority: aiContext.activity.favoritesCount ? 76 : 24 },
  ];
  return sections.sort((a, b) => b.priority - a.priority);
}

export function buildHomeExperience({
  user = null,
  userState = {},
  appState = {},
  aiContext = null,
  aiMemory = {},
  activityTimeline = [],
  interestModel = null,
  now = new Date(),
} = {}) {
  const context = aiContext || buildAIContext({
    ...userState,
    ...appState,
    user,
    aiMemory,
    activityTimeline,
    activePanel: 'home',
    source: appState.source || 'web-app',
  });

  const recommendations = buildPersonalHomeSuggestions({
    news: appState.news || [],
    partners: appState.partners || [],
    experts: appState.experts || [],
    events: appState.events || [],
    newsRecommendations: recommendNews({ news: appState.news || [] }, context),
    partnerRecommendations: recommendPartners({ partners: appState.partners || [] }, context),
    expertRecommendations: recommendExperts({ experts: appState.experts || [] }, context),
    eventRecommendations: recommendEvents({ events: appState.events || [] }, context),
  });
  const taskRecommendations = recommendTasks({ tasks: appState.customTasks || [], completedTaskIds: userState.completedTaskIds || [] });
  const continueExperience = buildContinueExperience({
    aiMemory,
    activityTimeline,
    savedNews: userState.savedNews || [],
    readLaterNews: userState.readLaterNews || [],
    news: appState.news || [],
    events: appState.events || [],
    partners: appState.partners || [],
    experts: appState.experts || [],
  });

  const feed = [
    ...recommendations.events.map(row => ({ ...row, explain: explain('Это событие подходит по вашей активности.', ['Вы часто открываете афишу.', context.preferenceSignals.timeOfDay === 'evening' ? 'Вечером события получают больший приоритет.' : '']) })),
    ...recommendations.partners.map(row => ({ ...row, explain: explain('Партнёр похож на ваши интересы.', [context.preferenceSignals.favoritePartnerIds.includes(row.id) ? 'Он уже в избранном.' : '', row.item?.offer ? 'Есть актуальное предложение.' : '']) })),
    ...recommendations.news.map(row => ({ ...row, explain: explain('Новость попала в персональную ленту.', [row.item?.category ? `Категория: ${row.item.category}.` : '', 'Учитываются свежесть и активность.']) })),
    ...recommendations.experts.map(row => ({ ...row, explain: explain('Эксперт подходит по текущей модели интересов.', [row.item?.category || row.item?.specialization || '']) })),
  ].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

  const upcomingEvents = (appState.events || []).filter(event => {
    const ms = getEventMs(event);
    return ms && ms >= now.getTime() && ms <= now.getTime() + 24 * 3600000;
  });
  const favoritePartnerNews = (appState.news || []).filter(item => {
    const partnerId = String(item?.partnerId || '');
    return partnerId && context.preferenceSignals.favoritePartnerIds.includes(partnerId);
  });
  const favoritePartner = (appState.partners || []).find(partner => context.preferenceSignals.favoritePartnerIds.includes(String(partner.id)));
  const achievementGap = keysToNextAchievement(userState.userKeys);
  const top = feed[0] || null;
  const bestEvent = recommendations.events[0] || null;
  const mainNews = recommendations.news[0] || null;
  const bestPartner = recommendations.partners[0] || null;
  const nextTask = taskRecommendations[0] || null;
  const lokiAdvice = top ? `Локи советует: ${entityTitle(top)}` : null;

  const dynamicSections = buildDynamicSections({ aiContext: context, continueExperience, recommendations: { ...recommendations, feed }, appState });
  const insightCards = [
    upcomingEvents.length ? `Сегодня рядом проходит ${upcomingEvents.length} мероприятий` : '',
    favoritePartnerNews.length ? `У любимых партнёров есть ${favoritePartnerNews.length} новостей.` : '',
    favoritePartner?.offer ? `У ${favoritePartner.name || 'партнёра'}` : '',
    achievementGap ? `До следующего достижения осталось ${achievementGap} ключей` : '',
    lokiAdvice,
  ].map(item => {
    const value = String(item || '').trim();
    return value;
  }).filter(Boolean);

  return {
    version: 1,
    generatedAt: now.toISOString(),
    greeting: `Добро пожаловать${user?.first_name ? `, ${user.first_name}` : ''}`,
    headline: top ? entityTitle(top) : 'Сегодня в АПГ',
    insights: insightCards,
    dynamicSections,
    continueExperience,
    recommendations: {
      feed,
      news: recommendations.news,
      partners: recommendations.partners,
      experts: recommendations.experts,
      events: recommendations.events,
      tasks: taskRecommendations,
    },
    smartContext: {
      welcome: 'Добро пожаловать',
      mainRecommendation: top ? { ...top, title: entityTitle(top), explanation: top.explain || [] } : null,
      bestNearbyEvent: bestEvent ? { ...bestEvent, title: entityTitle(bestEvent), explanation: bestEvent.explain || [] } : null,
      mainNews: mainNews ? { ...mainNews, title: entityTitle(mainNews), explanation: mainNews.explain || [] } : null,
      bestPartner: bestPartner ? { ...bestPartner, title: entityTitle(bestPartner), explanation: bestPartner.explain || [] } : null,
      nextAchievement: { keysLeft: achievementGap, task: nextTask || null },
      lokiAdvice,
    },
    interestModel,
    summary: {
      eventsToday: upcomingEvents.length,
      favoritePartnerNews: favoritePartnerNews.length,
      continueItems: continueExperience.items.length,
      topCategory: interestModel?.topCategories?.[0]?.id || context.preferenceSignals.favoriteCategories?.[0] || '',
    },
  };
}
