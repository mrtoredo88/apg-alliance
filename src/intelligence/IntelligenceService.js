import { getAIMemorySnapshot } from './AIMemory.js';
import { getActivityTimeline } from './ActivityTimeline.js';
import { getAnalyticsSnapshot } from './AnalyticsCollector.js';
import { buildAIContext } from './AIContextService.js';
import { buildContinueExperience } from './ContinueExperience.js';
import { buildHomeExperience } from './HomeExperienceService.js';
import { getInterestModelSnapshot } from './InterestModel.js';
import { buildWorkspaceDayPlan } from './WorkspaceDayPlanner.js';
import {
  recommendEvents,
  recommendExperts,
  recommendNews,
  recommendPartners,
  recommendTasks,
} from './recommendationEngine.js';

function buildBase(input = {}) {
  const aiMemory = input.aiMemory || getAIMemorySnapshot();
  const activityTimeline = input.activityTimeline || getActivityTimeline(80);
  const analytics = input.analytics || getAnalyticsSnapshot();
  const interestModel = input.interestModel || getInterestModelSnapshot();
  const aiContext = input.aiContext || buildAIContext({
    ...(input.userState || {}),
    ...(input.appState || {}),
    user: input.user,
    activePanel: input.activePanel || 'home',
    aiMemory,
    activityTimeline,
    source: input.appState?.source || input.source || 'web-app',
  });
  return { aiMemory, activityTimeline, analytics, interestModel, aiContext };
}

function withBase(input = {}, fn) {
  const base = buildBase(input);
  return fn({ ...input, ...base });
}

export function getRecommendations(input = {}) {
  return withBase(input, ({ appState = {}, userState = {}, aiContext }) => {
    const news = recommendNews({ news: appState.news || [] }, aiContext);
    const partners = recommendPartners({ partners: appState.partners || [] }, aiContext);
    const experts = recommendExperts({ experts: appState.experts || [] }, aiContext);
    const events = recommendEvents({ events: appState.events || [] }, aiContext);
    const tasks = recommendTasks({ tasks: appState.customTasks || [], completedTaskIds: userState.completedTaskIds || [] });
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      feed: [...events, ...partners, ...news, ...experts, ...tasks].sort((a, b) => Number(b.score || 0) - Number(a.score || 0)),
      news,
      partners,
      experts,
      events,
      tasks,
    };
  });
}

export function getContinueExperience(input = {}) {
  return withBase(input, ({ appState = {}, userState = {}, aiMemory, activityTimeline }) => buildContinueExperience({
    aiMemory,
    activityTimeline,
    savedNews: userState.savedNews || [],
    readLaterNews: userState.readLaterNews || [],
    news: appState.news || [],
    events: appState.events || [],
    partners: appState.partners || [],
    experts: appState.experts || [],
  }));
}

export function getInterestModel(input = {}) {
  return input.interestModel || getInterestModelSnapshot();
}

export function getHomeExperience(input = {}) {
  return withBase(input, ({ user, userState = {}, appState = {}, aiContext, aiMemory, activityTimeline, interestModel }) => buildHomeExperience({
    user,
    userState,
    appState,
    aiContext,
    aiMemory,
    activityTimeline,
    interestModel,
  }));
}

export function getPersonalInsights(input = {}) {
  const home = getHomeExperience(input);
  return {
    version: 1,
    generatedAt: home.generatedAt,
    insights: home.insights,
    smartContext: home.smartContext,
    summary: home.summary,
  };
}

export function getDailySummary(input = {}) {
  return withBase(input, ({ appState = {}, userState = {}, aiContext, activityTimeline, analytics }) => {
    const recommendations = getRecommendations({ ...input, aiContext, activityTimeline });
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      userId: aiContext.user.id,
      topRecommendation: recommendations.feed[0] || null,
      eventsToday: recommendations.events.length,
      unreadNews: recommendations.news.length,
      keys: Number(userState.userKeys || aiContext.keys || 0),
      activeSections: Object.keys(analytics.screenOpenings || {}).length,
      recentActions: activityTimeline.slice(0, 8),
      assets: {
        partners: appState.partners?.length || 0,
        experts: appState.experts?.length || 0,
        events: appState.events?.length || 0,
        news: appState.news?.length || 0,
      },
    };
  });
}

export function getWorkspaceDayPlan(input = {}) {
  return withBase(input, ({ user, appState = {}, userState = {}, aiContext, aiMemory, activityTimeline, analytics }) => {
    const recommendations = input.recommendations || getRecommendations({ ...input, aiContext, aiMemory, activityTimeline, analytics });
    const dailySummary = input.dailySummary || getDailySummary({ ...input, aiContext, aiMemory, activityTimeline, analytics });
    return buildWorkspaceDayPlan({
      user,
      aiContext,
      aiMemory,
      activityTimeline,
      analytics,
      recommendations,
      dailySummary,
      appState: {
        ...appState,
        unreadCount: appState.unreadCount ?? userState.unreadCount ?? 0,
      },
      userState,
    });
  });
}

export function createIntelligenceService(input = {}) {
  return {
    getHomeExperience: (override = {}) => getHomeExperience({ ...input, ...override }),
    getRecommendations: (override = {}) => getRecommendations({ ...input, ...override }),
    getPersonalInsights: (override = {}) => getPersonalInsights({ ...input, ...override }),
    getContinueExperience: (override = {}) => getContinueExperience({ ...input, ...override }),
    getInterestModel: (override = {}) => getInterestModel({ ...input, ...override }),
    getDailySummary: (override = {}) => getDailySummary({ ...input, ...override }),
    getWorkspaceDayPlan: (override = {}) => getWorkspaceDayPlan({ ...input, ...override }),
  };
}
