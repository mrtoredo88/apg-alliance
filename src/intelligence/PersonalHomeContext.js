import { buildAIContext } from './AIContextService.js';
import {
  recommendNews,
  recommendPartners,
  recommendExperts,
  recommendEvents,
  recommendRewards,
  recommendTasks,
} from './recommendationEngine.js';

function timeWindowLabel() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function clampText(value, max) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trim()}…`;
}

export function buildPersonalHomeContext({
  user = null,
  userState = {},
  appState = {},
  now = new Date(),
}) {
  const aiContext = buildAIContext({
    ...userState,
    ...appState,
    user,
    activePanel: 'home',
    source: appState.source || 'web-app',
  });

  const newsRecommendations = recommendNews({ news: appState.news || [] }, aiContext);
  const partnerRecommendations = recommendPartners({ partners: appState.partners || [] }, aiContext);
  const expertRecommendations = recommendExperts({ experts: appState.experts || [] }, aiContext);
  const eventRecommendations = recommendEvents({ events: appState.events || [] }, aiContext);
  const rewardRecommendations = recommendRewards({ rewards: userState.rewards || appState.rewards || [] });
  const taskRecommendations = recommendTasks({ tasks: appState.customTasks || [], completedTaskIds: appState.completedTaskIds || [] });

  return {
    version: 1,
    generatedAt: now.toISOString(),
    greeting: `${timeWindowLabel()}, ${String(user?.name || user?.first_name || 'друг').trim()}!`,
    headline: 'Сегодня в АПГ',
    userId: String(user?.id || user?.uid || ''),
    activeToday: [
      `Сегодня в вашем городе ${newsRecommendations.length ? `${newsRecommendations.length} свежих новостей` : 'есть новости для проверки'}.`,
      `Ближайшие события: ${eventRecommendations.length} предложений с датами.`,
      `Активные пары: ${partnerRecommendations.length} новых карточек партнёров.`,
      `Эксперты: ${expertRecommendations.length} рекомендаций.`,
    ],
    focusCards: {
      news: newsRecommendations.slice(0, 4),
      partners: partnerRecommendations.slice(0, 2),
      experts: expertRecommendations.slice(0, 2),
      events: eventRecommendations.slice(0, 2),
      rewards: rewardRecommendations.slice(0, 2),
      tasks: taskRecommendations.slice(0, 2),
    },
    aiContext,
    quickActions: [
      { key: 'openOffers', label: 'Что есть по партнёрам?', route: 'offers' },
      { key: 'openEvents', label: 'Какие события сегодня?', route: 'events' },
      { key: 'openRewards', label: 'Посмотреть награды', route: 'rewards' },
      { key: 'openNews', label: 'Что нового в АПГ', route: 'news' },
      { key: 'openExperts', label: 'Найти эксперта', route: 'experts' },
    ].slice(0, 4),
    summary: {
      partnerCount: Number(Array.isArray(appState.partners) ? appState.partners.length : 0),
      expertCount: Number(Array.isArray(appState.experts) ? appState.experts.length : 0),
      eventCount: Number(Array.isArray(appState.events) ? appState.events.length : 0),
      newsCount: Number(Array.isArray(appState.news) ? appState.news.length : 0),
    },
    statusLine: clampText(`У вас ${aiContext.activity.favoritesCount} избранных, ${aiContext.activity.scanCount} сканов, ${aiContext.activity.referralCount} приглашений.`, 180),
  };
}
