import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { logError } from '../errorLogger.js';
import { userAction } from '../userApi.js';
import { LOKI_EVENTS } from './lokiEvents.js';
import { getLokiPhrase } from './lokiPhrases.js';
import { subscribeLoki } from './lokiBus.js';
import { LOKI_ACTIONS, TAP_ACTIONS, getBehaviorForEvent, getNextMicroDelay, getRandomLokiAction, shouldUseNightAction } from './lokiBehavior.js';
import { DEFAULT_LOKI_MEMORY, loadLokiMemory, saveLokiMemory } from './lokiMemory.js';
import { getLokiSuggestion } from './lokiSuggestions.js';
import { LOKI_APP_ACTIONS, LOKI_MESSAGE_PRIORITY, createLokiAction, normalizeLokiActionRequest } from './lokiActionTypes.js';
import { addLokiHistoryItem, loadLokiHistory, markLokiHistoryItem, saveLokiHistory } from './lokiHistory.js';
import { askLokiBrain } from './LokiBrain.js';
import {
  evolveLokiEmotion,
  getEmotionalMicroAction,
  getLokiEmotionalPayload,
  getLokiEmotionalPresentation,
  normalizeLokiEmotionState,
  shouldLokiStayQuiet,
} from './LokiEmotionEngine.js';
import { clearLokiUserMemory, learnFromLokiQuery, loadLokiUserMemory } from './core/lokiUserMemory.js';
import { learnFromPanelVisit, learnFromRecommendationResult } from './LokiLearning.js';
import { buildInterestProfile, buildRecommendationFeed, buildScenarioCollections } from './LokiRecommendationCenter.js';
import { buildLokiContext } from './core/context/ContextEngine.js';
import { rememberPersonalityPhrase } from './personality/PersonalityMemory.js';
import { selectPersonalityPhrase } from './core/modules/PersonalityEngine.js';
import { markOpportunityAccepted, markOpportunityDismissed, markOpportunityShown } from './core/proactive/DismissManager.js';
import { runProactiveEngine } from './core/proactive/ProactiveEngine.js';
import { LOKI_ACTION_CENTER_EVENTS } from './core/actions/ActionRegistry.js';
import { executeLokiAction } from './core/actions/ActionExecutor.js';
import { buildActionHistoryPatch } from './core/actions/ActionHistory.js';
import { buildPlanHistoryPatch } from './core/planner/PlanHistory.js';
import { buildToolHistoryPatch } from './core/tools/ToolHistory.js';
import { buildWorkflowHistoryPatch } from './core/workflows/WorkflowHistory.js';
import { buildAgentHistoryPatch } from './core/agent/AgentHistory.js';
import { buildConversationHistoryPatch } from './core/conversation/ConversationHistory.js';
import { buildDecisionHistoryPatch } from './core/decision/index.js';
import { buildEvaluationHistoryPatch } from './core/evaluation/index.js';
import { buildCapabilityHistoryPatch } from './core/capabilities/index.js';
import { buildSkillHistoryPatch } from './core/skills/index.js';
import { buildExecutionHistoryPatch } from './core/execution/index.js';
import { buildControlledExecutionHistoryPatch, completeControlledExecutionResult } from './core/controlledExecution/index.js';
import {
  DEFAULT_LOKI_SETTINGS,
  hasLokiDailyVisit,
  hasSeenLokiGreeting,
  loadLokiSettings,
  markLokiDailyVisit,
  markLokiGreetingSeen,
  normalizeLokiSettings,
  saveLokiSettings,
} from './lokiState.js';

const LokiContext = createContext(null);

function getUserId(user) {
  return user?.id ? String(user.id) : 'guest';
}

function isLokiDebugEnabled() {
  try {
    return localStorage.getItem('apg_loki_debug') === '1';
  } catch {
    return false;
  }
}

function safeString(value) {
  return String(value ?? '').trim();
}

function stripText(value) {
  return safeString(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncateText(value, limit = 1200) {
  const text = stripText(value);
  return text.length > limit ? `${text.slice(0, limit).trim()}...` : text;
}

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(item => String(item));
  if (value) return [String(value)];
  return [];
}

function splitSentences(value) {
  return stripText(value)
    .split(/(?<=[.!?])\s+|\n+/)
    .map(item => item.trim())
    .filter(item => item.length > 24);
}

function normalizeLokiContext(context) {
  if (!context || typeof context !== 'object') return null;
  const type = safeString(context.type);
  if (type !== 'news') return { ...context, type };
  const article = context.article && typeof context.article === 'object' ? context.article : {};
  const newsId = safeString(context.newsId || article.id || context.id);
  const title = safeString(context.title || article.title || 'Эта новость');
  const text = truncateText(article.text || context.text || article.description || context.description, 4200);
  const summary = truncateText(article.summary || context.summary, 900);
  const next = {
    type: 'news',
    newsId,
    title,
    article: {
      id: newsId,
      title,
      text,
      summary,
      category: safeString(article.category || context.category),
      categoryLabel: safeString(article.categoryLabel || context.categoryLabel),
      source: safeString(article.source || context.source || 'apg'),
      sourceName: safeString(article.sourceName || context.sourceName),
      url: safeString(article.url || context.url),
      date: article.date || context.date || null,
      readingMinutes: Number(article.readingMinutes || context.readingMinutes || 0),
    },
    partnerIds: toArray(context.partnerIds || article.partnerIds || article.partnerId || context.partnerId),
    expertIds: toArray(context.expertIds || article.expertIds || article.expertId || context.expertId),
    eventIds: toArray(context.eventIds || article.eventIds || article.eventId || context.eventId),
    openedAt: new Date().toISOString(),
  };
  return { ...next, initialAnswer: buildNewsContextAnswer(next, 'кратко перескажи новость')?.text || '' };
}

function findItemsByIds(items = [], ids = []) {
  const lookup = new Set(ids.map(String));
  return (Array.isArray(items) ? items : []).filter(item => lookup.has(String(item?.id ?? '')));
}

function titleOf(item, fallback) {
  return safeString(item?.title || item?.name || item?.displayName || fallback);
}

function buildNewsSummaryBullets(context) {
  const article = context?.article ?? {};
  const basis = article.summary || article.text || context?.title || '';
  const sentences = splitSentences(basis);
  if (!sentences.length) return ['В новости пока мало текста, но я могу помочь разобрать её по заголовку и связанным данным.'];
  return sentences.slice(0, 3).map(sentence => sentence.length > 170 ? `${sentence.slice(0, 167).trim()}...` : sentence);
}

function buildNewsContextAnswer(context, text, appState = {}) {
  if (!context || context.type !== 'news') return null;
  const query = safeString(text).toLowerCase();
  const article = context.article ?? {};
  const bullets = buildNewsSummaryBullets(context);
  const title = safeString(context.title || article.title || 'эта новость');
  const partnerRows = findItemsByIds(appState?.partners, context.partnerIds);
  const expertRows = findItemsByIds(appState?.experts, context.expertIds);
  const eventRows = findItemsByIds(appState?.events, context.eventIds);
  const similarNews = (Array.isArray(appState?.news) ? appState.news : [])
    .filter(item => String(item?.id ?? '') !== String(context.newsId ?? '') && safeString(item?.category || item?.type) === safeString(article.category))
    .slice(0, 3);

  if (query.includes('событ')) {
    return {
      intent: 'context.news.events',
      text: eventRows.length
        ? `К этой новости я вижу связанные события:\n${eventRows.map(item => `• ${titleOf(item, 'Мероприятие')}`).join('\n')}`
        : 'Я не вижу привязанных событий у этой новости. Если событие есть в тексте, можно открыть афишу и проверить его вручную.',
      cards: eventRows.map(item => ({ id: item.id, title: titleOf(item, 'Мероприятие'), text: safeString(item?.date || item?.address || 'Связанное событие'), label: 'Открыть', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENT, { eventId: item.id }) })),
    };
  }

  if (query.includes('партн')) {
    return {
      intent: 'context.news.partners',
      text: partnerRows.length
        ? `В новости участвуют партнёры:\n${partnerRows.map(item => `• ${titleOf(item, 'Партнёр АПГ')}`).join('\n')}`
        : 'У этой новости пока нет явно привязанных партнёров.',
      cards: partnerRows.map(item => ({ id: item.id, title: titleOf(item, 'Партнёр АПГ'), text: safeString(item?.category || item?.address || 'Партнёр АПГ'), label: 'Открыть', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: item.id }) })),
    };
  }

  if (query.includes('эксперт')) {
    return {
      intent: 'context.news.experts',
      text: expertRows.length
        ? `По теме новости могут быть полезны эксперты:\n${expertRows.map(item => `• ${titleOf(item, 'Эксперт')}`).join('\n')}`
        : 'У этой новости пока нет явно привязанных экспертов.',
      cards: expertRows.map(item => ({ id: item.id, title: titleOf(item, 'Эксперт'), text: safeString(item?.specialization || item?.category || 'Эксперт АПГ'), label: 'Открыть экспертов', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_EXPERTS, { expertId: item.id }) })),
    };
  }

  if (query.includes('похож') || query.includes('ещё') || query.includes('друг')) {
    return {
      intent: 'context.news.similar',
      text: similarNews.length
        ? `Нашёл похожие материалы по теме «${article.categoryLabel || article.category || 'новости'}».`
        : 'Похожих материалов по этой теме пока не нашёл.',
      cards: similarNews.map(item => ({ id: item.id, title: titleOf(item, 'Новость'), text: truncateText(item?.summary || item?.text || item?.description, 120), label: 'Читать', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_NEWS, { newsId: item.id }) })),
    };
  }

  if (query.includes('бизнес')) {
    return {
      intent: 'context.news.business',
      text: `Если смотреть на новость «${title}» с точки зрения бизнеса:\n• это повод оценить спрос и интерес жителей;\n• можно подумать о партнёрстве, акции или событии вокруг темы;\n• если тема близка вашей сфере, стоит использовать её в коммуникации с клиентами.`,
      cards: [],
    };
  }

  if (query.includes('жител') || query.includes('прост') || query.includes('реб')) {
    return {
      intent: 'context.news.residents',
      text: `Простыми словами: ${bullets[0]}\n\nДля жителей это означает: стоит обратить внимание на тему новости, потому что она может дать полезное место, событие, услугу или городскую возможность внутри АПГ.`,
      cards: [],
    };
  }

  return {
    intent: 'context.news.summary',
    text: `Я прочитал эту новость.\n\nЕсли кратко:\n${bullets.map(item => `• ${item}`).join('\n')}\n\nГлавная мысль: ${bullets[0]}\n\nДля жителей это означает: можно быстро понять суть и, если нужно, перейти к связанным партнёрам, экспертам или событиям.\n\nХотите рассказать подробнее или ответить на вопросы?`,
    cards: [],
  };
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value.toDate) return value.toDate().getTime();
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function hasOffer(item = {}) {
  return Boolean(item.offer || item.promo || item.discount || item.specialOffer || item.actionText);
}

function isToday(value) {
  const ms = toMillis(value);
  if (!ms) return false;
  const date = new Date(ms);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function freshRows(items = []) {
  return (Array.isArray(items) ? items : [])
    .map(item => ({ item, ms: toMillis(item?.publishedAt ?? item?.createdAt ?? item?.date ?? item?.updatedAt) }))
    .sort((a, b) => b.ms - a.ms);
}

function recommendationAction(type, item = {}) {
  if (type === 'event') return createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENT, { eventId: item.id });
  if (type === 'partner') return createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: item.id });
  if (type === 'news') return createLokiAction(LOKI_APP_ACTIONS.OPEN_NEWS, { newsId: item.id });
  if (type === 'expert') return createLokiAction(LOKI_APP_ACTIONS.OPEN_EXPERTS, { expertId: item.id });
  if (type === 'task') return createLokiAction(LOKI_APP_ACTIONS.OPEN_TASKS, { taskId: item.id });
  return createLokiAction(LOKI_APP_ACTIONS.OPEN_LOKI);
}

function normalizeDashboardCard(row = {}, fallbackType = 'recommendation') {
  const item = row.item || row;
  const type = row.type || fallbackType;
  const action = row.action || recommendationAction(type, item);
  const explanation = row.explanation || row.explain || row.reasons || [row.reason].filter(Boolean);
  return {
    id: String(row.id || item?.id || `${type}-${titleOf(item, 'item')}`),
    type,
    title: titleOf(row, '') || titleOf(item, 'Рекомендация АПГ'),
    text: truncateText(row.text || row.reason || item?.summary || item?.description || item?.address || item?.specialization || item?.offer || 'Открою детали и помогу выбрать действие.', 180),
    reason: truncateText(row.reason || explanation?.[0] || 'Рекомендация собрана из вашего контекста АПГ.', 180),
    explanation: Array.isArray(explanation) ? explanation.filter(Boolean).slice(0, 3) : [String(explanation || '').trim()].filter(Boolean),
    image: row.image || item?.coverPhoto || item?.imageUrl || item?.photo || item?.logoUrl || '',
    label: row.label || (type === 'news' ? 'Читать' : type === 'event' ? 'Записаться' : 'Открыть'),
    action,
    actions: [
      { label: type === 'news' ? 'Читать' : type === 'event' ? 'Записаться' : 'Открыть', action },
      item?.address ? { label: 'Маршрут', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_MAP) } : null,
      { label: 'Подробнее', action },
      { label: 'Скрыть', localAction: 'hideRecommendation' },
    ].filter(Boolean).slice(0, 4),
  };
}

function continueActionFor(row = {}) {
  if (row.action) return row.action;
  if (row.type === 'news') return createLokiAction(LOKI_APP_ACTIONS.OPEN_NEWS, { newsId: row.id || row.item?.id });
  if (row.type === 'event') return createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENT, { eventId: row.id || row.item?.id });
  if (row.type === 'partner') return createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: row.id || row.item?.id });
  if (row.type === 'expert') return createLokiAction(LOKI_APP_ACTIONS.OPEN_EXPERTS, { expertId: row.id || row.item?.id });
  return createLokiAction(LOKI_APP_ACTIONS.OPEN_LOKI);
}

function buildLokiHomeDashboard({ appState = {}, user, recommendationFeed = [] } = {}) {
  const hour = new Date().getHours();
  const greeting = hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  const events = Array.isArray(appState.events) ? appState.events : [];
  const news = Array.isArray(appState.news) ? appState.news : [];
  const tasks = Array.isArray(appState.customTasks) ? appState.customTasks : [];
  const partners = Array.isArray(appState.partners) ? appState.partners : [];
  const experts = Array.isArray(appState.experts) ? appState.experts : [];
  const homeExperience = appState.homeExperience || {};
  const continueExperience = appState.continueExperience || {};
  const dailySummary = appState.dailySummary || {};
  const aiMemory = appState.aiMemory || {};
  const activityTimeline = Array.isArray(appState.activityTimeline) ? appState.activityTimeline : [];
  const todayEvents = events.filter(item => isToday(item?.date ?? item?.startAt ?? item?.startsAt ?? item?.eventDate));
  const freshNews = freshRows(news).filter(row => row.ms && Date.now() - row.ms < 1000 * 60 * 60 * 24 * 3).map(row => row.item);
  const freshEvents = freshRows(events).filter(row => row.ms && Date.now() - row.ms < 1000 * 60 * 60 * 24 * 7).map(row => row.item);
  const freshPartners = freshRows(partners).filter(row => row.ms && Date.now() - row.ms < 1000 * 60 * 60 * 24 * 10).map(row => row.item);
  const offerPartners = partners.filter(hasOffer);
  const activeTasks = tasks.filter(item => !appState.completedTasks?.includes?.(item.id));
  const keyOpportunity = Math.min(5, Math.max(1, activeTasks.length || offerPartners.length || todayEvents.length));
  const priority = { event: 5, partner: 4, news: 3, task: 2, prize: 1, expert: 1 };
  const todayRecommendations = [...recommendationFeed]
    .sort((a, b) => (priority[b.type] ?? 0) - (priority[a.type] ?? 0) || Number(b.score ?? 0) - Number(a.score ?? 0))
    .slice(0, 3);
  const mainNews = freshNews[0] ? {
    id: freshNews[0].id,
    title: titleOf(freshNews[0], 'Новость АПГ'),
    text: truncateText(freshNews[0].summary || freshNews[0].text || freshNews[0].description, 220),
    action: createLokiAction(LOKI_APP_ACTIONS.OPEN_NEWS, { newsId: freshNews[0].id }),
  } : null;
  const dayPlan = [
    todayEvents[0] ? { title: titleOf(todayEvents[0], 'Мероприятие дня'), text: 'Начать с события, которое подходит по времени и контексту.' } : null,
    offerPartners[0] ? { title: titleOf(offerPartners[0], 'Партнёр с предложением'), text: 'Проверить актуальную акцию или пользу у партнёра.' } : null,
    mainNews ? { title: mainNews.title, text: 'Прочитать главную новость дня и понять, что это значит.' } : null,
    activeTasks[0] ? { title: titleOf(activeTasks[0], 'Задание АПГ'), text: 'Закрыть простое действие и продвинуться по ключам.' } : null,
  ].filter(Boolean);
  while (dayPlan.length < 3) {
    const fallback = [
      { title: 'Открыть рекомендации Локи', text: 'Выбрать один полезный сценарий вместо долгого поиска.' },
      { title: 'Проверить партнёров рядом', text: 'Найти место, куда можно зайти сегодня.' },
      { title: 'Задать Локи задачу', text: 'Написать, что нужно сейчас, и получить лучшее решение.' },
    ][dayPlan.length];
    if (fallback) dayPlan.push(fallback);
    else break;
  }
  const smartContext = homeExperience.smartContext || {};
  const personalSummary = [
    todayEvents.length ? `Сегодня рядом проходят ${todayEvents.length} мероприятия.` : 'Сегодня рядом нет срочных мероприятий.',
    offerPartners[0] ? `У ${titleOf(offerPartners[0], 'партнёра')} есть актуальная акция.` : null,
    smartContext.nextAchievement ? `До следующего достижения осталось ${smartContext.nextAchievement.missingKeys ?? smartContext.nextAchievement.keysLeft ?? keyOpportunity} ключей.` : `Можно заработать ещё ${keyOpportunity} ключей.`,
    freshNews[0] ? `Главная новость: ${titleOf(freshNews[0], 'новость АПГ')}.` : null,
    experts[0] ? `Есть эксперт по теме: ${titleOf(experts[0], 'эксперт АПГ')}.` : null,
  ].filter(Boolean).slice(0, 5);
  const continueItems = [
    ...(Array.isArray(continueExperience.items) ? continueExperience.items : []),
    ...(Array.isArray(aiMemory.lastViewedNews) ? aiMemory.lastViewedNews.map(item => ({ ...item, type: 'news', label: 'Дочитать статью' })) : []),
    ...(Array.isArray(aiMemory.lastViewedEvents) ? aiMemory.lastViewedEvents.map(item => ({ ...item, type: 'event', label: 'Вернуться к мероприятию' })) : []),
    ...(Array.isArray(aiMemory.lastViewedPartners) ? aiMemory.lastViewedPartners.map(item => ({ ...item, type: 'partner', label: 'Вернуться к партнёру' })) : []),
    ...(Array.isArray(aiMemory.lastViewedExperts) ? aiMemory.lastViewedExperts.map(item => ({ ...item, type: 'expert', label: 'Посмотреть эксперта' })) : []),
  ].filter(Boolean).slice(0, 4).map((row, index) => ({
    id: String(row.id || row.item?.id || `${row.type || 'continue'}-${index}`),
    type: row.type || row.entityType || 'continue',
    label: row.label || row.title || 'Продолжить',
    title: titleOf(row, '') || titleOf(row.item, 'Продолжить'),
    text: truncateText(row.text || row.reason || row.subtitle || row.item?.summary || row.item?.description || 'Можно вернуться к этому месту.', 120),
    action: continueActionFor(row),
  }));
  const recommendationSections = {
    partners: (appState.recommendations?.partners || homeExperience.recommendations?.partners || []).slice(0, 2).map(row => normalizeDashboardCard(row, 'partner')),
    events: (appState.recommendations?.events || homeExperience.recommendations?.events || []).slice(0, 2).map(row => normalizeDashboardCard(row, 'event')),
    news: (appState.recommendations?.news || homeExperience.recommendations?.news || []).slice(0, 2).map(row => normalizeDashboardCard(row, 'news')),
    experts: (appState.recommendations?.experts || homeExperience.recommendations?.experts || []).slice(0, 2).map(row => normalizeDashboardCard(row, 'expert')),
  };
  const changedRecentActions = activityTimeline.filter(item => toMillis(item.timestamp || item.createdAt || item.time) > Date.now() - 1000 * 60 * 60 * 24);
  const changes = [
    freshNews.length ? `Опубликовано ${freshNews.length} новости.` : null,
    freshEvents[0] ? `Появилось новое мероприятие: ${titleOf(freshEvents[0], 'мероприятие')}.` : null,
    freshPartners[0] ? `Добавился партнёр: ${titleOf(freshPartners[0], 'партнёр')}.` : null,
    Number(dailySummary.keys || appState.userKeys || 0) ? `На балансе ${Number(dailySummary.keys || appState.userKeys || 0)} ключей.` : null,
    changedRecentActions.length ? `Зафиксировано ${changedRecentActions.length} действий в вашей активности.` : null,
  ].filter(Boolean).slice(0, 5);
  const todayBlocks = [
    todayEvents[0] ? normalizeDashboardCard({ item: todayEvents[0], type: 'event', reason: 'Ближайшее мероприятие сегодня.' }, 'event') : null,
    offerPartners[0] ? normalizeDashboardCard({ item: offerPartners[0], type: 'partner', reason: 'У партнёра есть актуальное предложение.' }, 'partner') : null,
    freshNews[0] ? normalizeDashboardCard({ item: freshNews[0], type: 'news', reason: 'Свежая новость в АПГ.' }, 'news') : null,
  ].filter(Boolean);
  return {
    greeting,
    userName: safeString(user?.first_name || user?.name || appState.user?.first_name || appState.user?.name),
    summary: `Сегодня для тебя есть ${todayEvents.length} ${todayEvents.length === 1 ? 'мероприятие' : 'мероприятия'}, ${freshNews.length} ${freshNews.length === 1 ? 'новость' : 'новости'} и возможность заработать ещё ${keyOpportunity} ключей.`,
    personalSummary,
    continueItems,
    recommendationSections,
    changes,
    todayBlocks,
    todayRecommendations,
    dayPlan,
    mainNews,
    progress: {
      keys: Number(appState.userKeys ?? 0),
      activeTasks: activeTasks.length,
      completedTasks: Array.isArray(appState.completedTasks) ? appState.completedTasks.length : 0,
      achievements: Array.isArray(appState.completedTasks) ? appState.completedTasks.length : 0,
    },
  };
}

export function LokiProvider({ children, user, activePanel, appActions, appState }) {
  const [settings, setSettings] = useState(() => loadLokiSettings());
  const [memory, setMemory] = useState(() => loadLokiMemory());
  const [emotionalState, setEmotionalState] = useState(() => normalizeLokiEmotionState(loadLokiMemory().emotionalState));
  const [userMemory, setUserMemory] = useState(() => loadLokiUserMemory());
  const [history, setHistory] = useState(() => loadLokiHistory());
  const [visible, setVisible] = useState(false);
  const [emotion, setEmotion] = useState('idle');
  const [message, setMessage] = useState('');
  const [card, setCard] = useState(null);
  const [brainThinking, setBrainThinking] = useState(false);
  const [experienceOpen, setExperienceOpen] = useState(false);
  const [activeContext, setActiveContext] = useState(() => loadLokiMemory().activeContext ?? loadLokiMemory().lastContext ?? null);
  const [anchor, setAnchor] = useState('home');
  const [action, setAction] = useState(LOKI_ACTIONS.IDLE);
  const [dismissed, setDismissed] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const queueRef = useRef([]);
  const activeHistoryIdRef = useRef(null);
  const currentPriorityRef = useRef(LOKI_MESSAGE_PRIORITY.LOW);
  const lastUserActionAtRef = useRef(Date.now());
  const lastPanelChangeAtRef = useRef(Date.now());
  const observerTimerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const idleTimerRef = useRef(null);
  const microTimerRef = useRef(null);
  const actionTimerRef = useRef(null);
  const presenceTimerRef = useRef(null);
  const farewellTimerRef = useRef(null);
  const homePresenceTimerRef = useRef(null);
  const settingsHydratedRef = useRef(false);
  const settingsDirtyRef = useRef(false);
  const userId = getUserId(user);
  const isHiddenOnPanel = settings.hiddenPanels.includes(activePanel);
  const canTalk = settings.enabled && settings.bubbleEnabled && !isHiddenOnPanel;

  const persistSettings = useCallback((next, options = {}) => {
    const normalized = normalizeLokiSettings(next);
    if (options.sync !== false) settingsDirtyRef.current = true;
    saveLokiSettings(normalized);
    setSettings(normalized);
  }, []);

  const updateMemory = useCallback((patch) => {
    setMemory(prev => {
      const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
      saveLokiMemory(next);
      return next;
    });
  }, []);

  const recordActionEvent = useCallback((event) => {
    setMemory(prev => {
      const next = { ...prev, ...buildActionHistoryPatch(prev, event), updatedAt: new Date().toISOString() };
      saveLokiMemory(next);
      return next;
    });
  }, []);

  const recordToolEvents = useCallback((events = []) => {
    if (!events.length) return;
    setMemory(prev => {
      const next = { ...prev, ...buildToolHistoryPatch(prev, events), updatedAt: new Date().toISOString() };
      saveLokiMemory(next);
      return next;
    });
  }, []);

  const recordPlanContext = useCallback((planContext) => {
    if (!planContext?.id) return;
    setMemory(prev => {
      const next = { ...prev, ...buildPlanHistoryPatch(prev, planContext), lastPlanContext: planContext, updatedAt: new Date().toISOString() };
      saveLokiMemory(next);
      return next;
    });
  }, []);

  const recordWorkflowContext = useCallback((workflowContext) => {
    if (!workflowContext?.id) return;
    setMemory(prev => {
      const next = { ...prev, ...buildWorkflowHistoryPatch(prev, workflowContext), lastWorkflowContext: workflowContext, updatedAt: new Date().toISOString() };
      saveLokiMemory(next);
      return next;
    });
  }, []);

  const recordAgentContext = useCallback((agentContext) => {
    if (!agentContext?.decision) return;
    setMemory(prev => {
      const next = {
        ...prev,
        ...buildAgentHistoryPatch(prev, agentContext),
        lastAgentContext: agentContext,
        lastAgentSession: agentContext.session || prev.lastAgentSession || null,
        updatedAt: new Date().toISOString(),
      };
      saveLokiMemory(next);
      return next;
    });
  }, []);

  const recordConversationContext = useCallback((conversationContext) => {
    if (!conversationContext?.session) return;
    setMemory(prev => {
      const next = {
        ...prev,
        ...buildConversationHistoryPatch(prev, conversationContext),
        lastConversationContext: conversationContext,
        lastConversationSession: conversationContext.session,
        updatedAt: new Date().toISOString(),
      };
      saveLokiMemory(next);
      return next;
    });
  }, []);

  const recordDecisionContext = useCallback((decisionContext) => {
    if (!decisionContext?.decisionId) return;
    setMemory(prev => {
      const next = {
        ...prev,
        ...buildDecisionHistoryPatch(prev, decisionContext),
        lastDecisionContext: decisionContext,
        decisionSnapshot: decisionContext,
        updatedAt: new Date().toISOString(),
      };
      saveLokiMemory(next);
      return next;
    });
  }, []);

  const recordCapabilityContext = useCallback((capabilityContext, capabilitySnapshot) => {
    if (!capabilityContext?.capability) return;
    setMemory(prev => {
      const historyPatch = buildCapabilityHistoryPatch(prev, capabilityContext);
      const next = {
        ...prev,
        ...historyPatch,
        lastCapabilityContext: capabilityContext,
        lastCapabilitySnapshot: capabilitySnapshot || null,
        lastCapabilityHistory: historyPatch.capabilityHistory || prev.lastCapabilityHistory || [],
        updatedAt: new Date().toISOString(),
      };
      saveLokiMemory(next);
      return next;
    });
  }, []);

  const recordSkillContext = useCallback((skillContext, skillSnapshot) => {
    if (!skillContext?.skill) return;
    setMemory(prev => {
      const historyPatch = buildSkillHistoryPatch(prev, skillContext);
      const next = {
        ...prev,
        ...historyPatch,
        lastSkillContext: skillContext,
        lastSkillSnapshot: skillSnapshot || null,
        lastSkillHistory: historyPatch.skillHistory || prev.lastSkillHistory || [],
        updatedAt: new Date().toISOString(),
      };
      saveLokiMemory(next);
      return next;
    });
  }, []);

  const recordExecutionContext = useCallback((executionContext, executionSnapshot) => {
    if (!executionContext?.capability) return;
    setMemory(prev => {
      const historyPatch = buildExecutionHistoryPatch(prev, executionContext);
      const next = {
        ...prev,
        ...historyPatch,
        lastExecutionContext: executionContext,
        lastExecutionSnapshot: executionSnapshot || null,
        lastExecutionHistory: historyPatch.executionHistory || prev.lastExecutionHistory || [],
        updatedAt: new Date().toISOString(),
      };
      saveLokiMemory(next);
      return next;
    });
  }, []);

  const recordControlledExecutionContext = useCallback((controlledExecutionContext, controlledExecutionSnapshot) => {
    if (!controlledExecutionContext?.capability) return;
    setMemory(prev => {
      const historyPatch = buildControlledExecutionHistoryPatch(prev, controlledExecutionContext);
      const next = {
        ...prev,
        ...historyPatch,
        lastControlledExecutionContext: controlledExecutionContext,
        lastControlledExecutionSnapshot: controlledExecutionSnapshot || null,
        lastControlledExecutionHistory: historyPatch.controlledExecutionHistory || prev.lastControlledExecutionHistory || [],
        updatedAt: new Date().toISOString(),
      };
      saveLokiMemory(next);
      return next;
    });
  }, []);

  const recordEvaluationSnapshot = useCallback((evaluationContext, evaluationSnapshot) => {
    if (!evaluationSnapshot?.evaluationId && !evaluationContext?.evaluationId) return;
    const snapshot = {
      ...evaluationSnapshot,
      evaluationId: evaluationSnapshot?.evaluationId || evaluationContext?.evaluationId || '',
    };
    setMemory(prev => {
      const historyPatch = buildEvaluationHistoryPatch(prev, snapshot);
      const next = {
        ...prev,
        ...historyPatch,
        lastEvaluationContext: evaluationContext || null,
        lastEvaluationSnapshot: snapshot,
        lastEvaluationHistory: historyPatch.evaluationHistory || prev.lastEvaluationHistory || [],
        updatedAt: new Date().toISOString(),
      };
      saveLokiMemory(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!memory.sessionStartedAt) updateMemory({ sessionStartedAt: new Date().toISOString() });
  }, [memory.sessionStartedAt, updateMemory]);

  const updateHistory = useCallback((updater) => {
    setHistory(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveLokiHistory(next);
      return next;
    });
  }, []);

  const resetUserMemory = useCallback(() => {
    clearLokiUserMemory();
    const fresh = loadLokiUserMemory();
    setUserMemory(fresh);
  }, []);

  const displayMessage = useCallback((eventType, payload = {}) => {
    const config = getBehaviorForEvent(eventType);
    const priority = payload.priority ?? config.priority ?? LOKI_MESSAGE_PRIORITY.NORMAL;
    const nextEmotionalState = evolveLokiEmotion({ previous: emotionalState, eventType });
    const emotionalPresentation = getLokiEmotionalPresentation({ config, eventType, payload, emotionalState: nextEmotionalState });
    currentPriorityRef.current = priority;
    setLastEvent({ eventType, payload, ts: Date.now() });
    setAnchor(config.anchor ?? 'home');
    setAction(emotionalPresentation.action);
    setEmotion(emotionalPresentation.emotion);
    setEmotionalState(nextEmotionalState);
    setDismissed(false);
    setVisible(true);
    const nextCard = payload.card ?? getLokiSuggestion({ eventType, activePanel, payload });
    setCard(nextCard);
    activeHistoryIdRef.current = null;
    if (settings.enabled && settings.bubbleEnabled) {
      const emotionalPayload = { ...payload, ...getLokiEmotionalPayload(nextEmotionalState) };
      const nextMessage = getLokiPhrase(eventType, emotionalPayload);
      setMessage(nextMessage);
      const memoryPatch = {
        lastMessage: { eventType, text: nextMessage, payload: emotionalPayload },
        lastPanel: activePanel,
        inDialog: true,
        emotionalState: nextEmotionalState,
      };
      if (eventType === LOKI_EVENTS.PROACTIVE_SUGGESTION) {
        if (payload.opportunity) markOpportunityShown(payload.opportunity);
        memoryPatch.lastRecommendation = {
          adviceId: payload.adviceId ?? null,
          reason: payload.reason ?? null,
          card: nextCard,
          opportunity: payload.opportunity ?? null,
          opportunityType: payload.opportunityType ?? null,
          panel: activePanel,
          shownAt: new Date().toISOString(),
        };
      }
      updateMemory(memoryPatch);
      updateHistory(prev => {
        const item = {
          kind: payload.kind ?? 'message',
          adviceId: payload.adviceId ?? null,
          eventType,
          text: nextMessage,
          card: nextCard,
          priority,
          panel: activePanel,
          emotion: nextEmotionalState.mood,
        };
        const next = addLokiHistoryItem(prev, item);
        activeHistoryIdRef.current = next[0]?.id ?? null;
        return next;
      });
    }
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    if (presenceTimerRef.current) clearTimeout(presenceTimerRef.current);
    if (farewellTimerRef.current) clearTimeout(farewellTimerRef.current);
    actionTimerRef.current = setTimeout(() => {
      setAction(LOKI_ACTIONS.IDLE);
      setEmotion(eventType === LOKI_EVENTS.USER_IDLE ? 'sleep' : 'idle');
    }, Math.min(3600, Math.max(1600, emotionalPresentation.duration - 2200)));
    hideTimerRef.current = setTimeout(() => {
      setMessage('');
      setCard(null);
      setEmotion(eventType === LOKI_EVENTS.USER_IDLE ? 'sleep' : 'idle');
    }, emotionalPresentation.duration);
    if (eventType === LOKI_EVENTS.PROACTIVE_SUGGESTION || activePanel !== 'home') {
      farewellTimerRef.current = setTimeout(() => {
        setAction(LOKI_ACTIONS.WAVE);
        setEmotion('happy');
      }, emotionalPresentation.duration + 520);
    }
    presenceTimerRef.current = setTimeout(() => {
      const shouldStayHome = activePanel === 'home' && settings.enabled && !isHiddenOnPanel;
      setVisible(shouldStayHome);
      setAnchor('home');
      setAction(LOKI_ACTIONS.IDLE);
      setEmotion('idle');
      currentPriorityRef.current = LOKI_MESSAGE_PRIORITY.LOW;
      updateMemory({ inDialog: false, lastPanel: activePanel, emotionalState: nextEmotionalState });
      const next = queueRef.current.shift();
      if (next) setTimeout(() => displayMessage(next.eventType, next.payload), 420);
    }, emotionalPresentation.duration + 1900);
  }, [activePanel, emotionalState, isHiddenOnPanel, settings.bubbleEnabled, settings.enabled, updateHistory, updateMemory]);

  const showMessage = useCallback((eventType, payload = {}) => {
    if (!settings.enabled) return;
    if (settings.mode === 'on_demand') {
      const ALWAYS_ALLOWED = [
        LOKI_EVENTS.CHARACTER_TAP,
        LOKI_EVENTS.BRAIN_RESPONSE,
        LOKI_EVENTS.APP_ERROR,
        LOKI_EVENTS.USER_LOGIN,
        LOKI_EVENTS.KEY_RECEIVED,
        LOKI_EVENTS.ACHIEVEMENT_UNLOCKED,
      ];
      if (!ALWAYS_ALLOWED.includes(eventType)) return;
    }
    const config = getBehaviorForEvent(eventType);
    const priority = payload.priority ?? config.priority ?? LOKI_MESSAGE_PRIORITY.NORMAL;
    if (shouldLokiStayQuiet({ eventType, priority, emotionalState })) return;
    const item = { eventType, payload: { ...payload, priority } };
    const hasActiveMessage = visible && (message || card);
    if (hasActiveMessage && priority <= currentPriorityRef.current) {
      queueRef.current = [...queueRef.current, item]
        .sort((a, b) => (b.payload.priority ?? LOKI_MESSAGE_PRIORITY.NORMAL) - (a.payload.priority ?? LOKI_MESSAGE_PRIORITY.NORMAL))
        .slice(0, 8);
      return;
    }
    displayMessage(eventType, item.payload);
  }, [card, displayMessage, emotionalState, message, settings, visible]);

  useEffect(() => subscribeLoki(showMessage), [showMessage]);

  useEffect(() => {
    if (!user?.lokiSettings || settingsHydratedRef.current) return;
    settingsHydratedRef.current = true;
    persistSettings({ ...DEFAULT_LOKI_SETTINGS, ...loadLokiSettings(), ...user.lokiSettings }, { sync: false });
  }, [persistSettings, user?.lokiSettings]);

  useEffect(() => {
    if (!user?.id || user.isGuest || String(user.id).startsWith('guest_')) return;
    if (!settingsDirtyRef.current) return;
    userAction('loki:settings', { userId: String(user.id), settings })
      .then(() => { settingsDirtyRef.current = false; })
      .catch(e => logError(e, 'LokiProvider.persistSettings'));
  }, [settings, user?.id, user?.isGuest]);

  useEffect(() => {
    if (!settings.enabled || !user) return;
    if (!hasSeenLokiGreeting(userId)) {
      const t = setTimeout(() => {
        showMessage(LOKI_EVENTS.USER_LOGIN, { userId });
        markLokiGreetingSeen(userId);
      }, 1100);
      return () => clearTimeout(t);
    }
  }, [settings.enabled, showMessage, user, userId]);

  useEffect(() => {
    if (!settings.enabled || !user || activePanel !== 'home' || isHiddenOnPanel || dismissed || experienceOpen) return undefined;
    if (homePresenceTimerRef.current) clearTimeout(homePresenceTimerRef.current);
    homePresenceTimerRef.current = setTimeout(() => {
      setAnchor('home');
      setVisible(true);
      setEmotion(prev => (prev === 'sleep' ? 'sleep' : 'idle'));
      setAction(LOKI_ACTIONS.PEEK);
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
      actionTimerRef.current = setTimeout(() => {
        setAction(LOKI_ACTIONS.IDLE);
        setEmotion('idle');
      }, 1800);
    }, message || card ? 2600 : 760);
    return () => {
      if (homePresenceTimerRef.current) clearTimeout(homePresenceTimerRef.current);
    };
  }, [activePanel, card, dismissed, experienceOpen, isHiddenOnPanel, message, settings.enabled, user]);

  useEffect(() => {
    if (!settings.enabled || !user) return;
    if (settings.mode !== 'standard' && settings.mode !== 'active') return;
    const dayKey = new Date().toLocaleDateString('sv');
    if (hasLokiDailyVisit(userId, dayKey)) return;
    if (!hasSeenLokiGreeting(userId)) return;
    markLokiDailyVisit(userId, dayKey);
    const t = setTimeout(() => showMessage(LOKI_EVENTS.RETURN_VISIT, { dayKey }), 4200);
    return () => clearTimeout(t);
  }, [settings.enabled, settings.mode, showMessage, user, userId]);

  useEffect(() => {
    if (!settings.enabled || settings.mode === 'on_demand') return;
    const delay = settings.mode === 'minimal' ? 90000 : 52000;
    const resetIdle = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        if (document.visibilityState === 'visible') showMessage(LOKI_EVENTS.USER_IDLE);
      }, delay);
    };
    resetIdle();
    window.addEventListener('pointerdown', resetIdle, { passive: true });
    window.addEventListener('keydown', resetIdle);
    window.addEventListener('scroll', resetIdle, { passive: true });
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      window.removeEventListener('pointerdown', resetIdle);
      window.removeEventListener('keydown', resetIdle);
      window.removeEventListener('scroll', resetIdle);
    };
  }, [settings.enabled, settings.mode, showMessage]);

  useEffect(() => {
    const markUserAction = () => { lastUserActionAtRef.current = Date.now(); };
    window.addEventListener('pointerdown', markUserAction, { passive: true });
    window.addEventListener('keydown', markUserAction);
    window.addEventListener('scroll', markUserAction, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', markUserAction);
      window.removeEventListener('keydown', markUserAction);
      window.removeEventListener('scroll', markUserAction);
    };
  }, []);

  useEffect(() => {
    if (!settings.enabled) return;
    const scheduleMicroAction = () => {
      if (microTimerRef.current) clearTimeout(microTimerRef.current);
      microTimerRef.current = setTimeout(() => {
        if (document.visibilityState === 'visible' && visible && !message) {
          const nextAction = getEmotionalMicroAction(emotionalState) ?? (shouldUseNightAction() ? LOKI_ACTIONS.YAWN : getRandomLokiAction());
          setAction(nextAction);
          setEmotion(nextAction === LOKI_ACTIONS.YAWN ? 'sleep' : 'idle');
          if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
          actionTimerRef.current = setTimeout(() => {
            setAction(LOKI_ACTIONS.IDLE);
            setEmotion('idle');
            scheduleMicroAction();
          }, 2400);
        } else {
          scheduleMicroAction();
        }
      }, getNextMicroDelay());
    };
    scheduleMicroAction();
    return () => {
      if (microTimerRef.current) clearTimeout(microTimerRef.current);
    };
  }, [emotionalState, message, settings.enabled, visible]);

  useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (microTimerRef.current) clearTimeout(microTimerRef.current);
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    if (presenceTimerRef.current) clearTimeout(presenceTimerRef.current);
    if (farewellTimerRef.current) clearTimeout(farewellTimerRef.current);
    if (homePresenceTimerRef.current) clearTimeout(homePresenceTimerRef.current);
    if (observerTimerRef.current) clearTimeout(observerTimerRef.current);
  }, []);

  useEffect(() => {
    lastPanelChangeAtRef.current = Date.now();
    setMemory(prev => {
      const panelVisits = { ...(prev.panelVisits ?? {}), [activePanel]: ((prev.panelVisits ?? {})[activePanel] ?? 0) + 1 };
      const next = { ...prev, lastPanel: activePanel, panelVisits, learning: learnFromPanelVisit(prev.learning, activePanel), updatedAt: new Date().toISOString() };
      saveLokiMemory(next);
      return next;
    });
  }, [activePanel]);

  useEffect(() => {
    if (!settings.enabled || !user || !appState || settings.mode === 'on_demand') return;
    if (observerTimerRef.current) clearTimeout(observerTimerRef.current);
    observerTimerRef.current = setTimeout(() => {
      const recommendation = runProactiveEngine({
        appState: { ...appState, activePanel },
        memory,
        history,
        userMemory,
        lastUserActionAt: lastUserActionAtRef.current,
        lastPanelChangeAt: lastPanelChangeAtRef.current,
      });
      if (!recommendation) return;
      if (settings.mode === 'minimal' && recommendation.payload?.priority < LOKI_MESSAGE_PRIORITY.HIGH) return;
      showMessage(recommendation.eventType, recommendation.payload);
    }, 9000);
    return () => {
      if (observerTimerRef.current) clearTimeout(observerTimerRef.current);
    };
  }, [activePanel, appState, history, memory, settings.enabled, settings.mode, showMessage, user, userMemory]);

  const handleCharacterTap = useCallback(() => {
    const tapAction = getRandomLokiAction(TAP_ACTIONS);
    setAnchor('home');
    setAction(tapAction);
    showMessage(LOKI_EVENTS.CHARACTER_TAP, { source: 'tap', action: tapAction, priority: LOKI_MESSAGE_PRIORITY.NORMAL });
  }, [showMessage]);

  const executeAction = useCallback(async (request) => {
    const normalized = normalizeLokiActionRequest(request);
    if (!normalized?.type) return false;
    const activeAdvice = memory?.lastRecommendation;
    if (activeAdvice?.opportunity) markOpportunityAccepted(activeAdvice.opportunity);
    const actionEvents = [];
    updateMemory({
      lastAction: { ...normalized, ts: new Date().toISOString() },
      lastActionType: normalized.type,
      sameActionCount: memory.lastActionType === normalized.type ? Number(memory.sameActionCount || 0) + 1 : 1,
      inDialog: false,
      ...(activeAdvice ? { learning: learnFromRecommendationResult(memory.learning, activeAdvice, 'opened') } : {}),
    });
    recordActionEvent({
      type: LOKI_ACTION_CENTER_EVENTS.STARTED,
      action: normalized,
      actionType: normalized.type,
      status: 'started',
    });
    if (activeHistoryIdRef.current) {
      const id = activeHistoryIdRef.current;
      updateHistory(prev => markLokiHistoryItem(prev, id, 'opened'));
    }
    const execution = await executeLokiAction(normalized, {
      appActions,
      appState,
      actor: { role: user?.role || user?.userRole || 'user', permissions: user?.adminPermissions || [] },
      onEvent: event => actionEvents.push(event),
    });
    if (execution.ok) {
      if (actionEvents.length) {
        recordActionEvent(actionEvents[actionEvents.length - 1]);
      }
      setCard(null);
      const personalityEvent = normalized.type === LOKI_APP_ACTIONS.START_EVENT_REGISTRATION ? 'registration_complete' : 'success';
      const personalityPhrase = selectPersonalityPhrase({
        event: personalityEvent,
        mode: settings.personalityMode,
        context: { user: { currentPanel: activePanel }, memory },
        history: memory.personalityHistory,
      });
      setMessage(personalityPhrase?.text || '');
      if (personalityPhrase) updateMemory({ personalityHistory: rememberPersonalityPhrase(memory.personalityHistory, personalityPhrase), lastSeenAt: new Date().toISOString() });
      setAction(LOKI_ACTIONS.WAVE);
      setEmotion('happy');
      setTimeout(() => {
        if (activePanel !== 'home') setVisible(false);
      }, 520);
      return true;
    }
    if (execution.error) logError(execution.error, 'LokiProvider.executeAction');
    recordActionEvent(actionEvents[actionEvents.length - 1] || {
        type: LOKI_ACTION_CENTER_EVENTS.FAILED,
        action: normalized,
        actionType: normalized.type,
        status: 'failed',
        reason: execution.reason,
    });
    showMessage(LOKI_EVENTS.APP_ERROR, { source: 'loki_action_failed', actionType: normalized.type, message: execution.reason, priority: LOKI_MESSAGE_PRIORITY.HIGH });
    return false;
  }, [activePanel, appActions, appState, memory, recordActionEvent, settings.personalityMode, showMessage, updateHistory, updateMemory, user]);

  const dispatchControlledExecution = useCallback(async (controlledExecutionContext) => {
    const actionToRun = controlledExecutionContext?.result?.dispatch || controlledExecutionContext?.dispatcher?.action || null;
    if (!controlledExecutionContext?.executionReady || !actionToRun) return null;
    const actionEvents = [];
    const execution = await executeLokiAction(actionToRun, {
      appActions,
      appState,
      actor: { role: user?.role || user?.userRole || 'user', permissions: user?.adminPermissions || [] },
      onEvent: event => actionEvents.push(event),
    });
    actionEvents.forEach(event => recordActionEvent(event));
    const nextContext = {
      ...controlledExecutionContext,
      result: completeControlledExecutionResult(controlledExecutionContext.result, {
        ok: execution.ok,
        reason: execution.reason || controlledExecutionContext.result?.reason || '',
        action: execution.action || actionToRun,
      }),
    };
    recordControlledExecutionContext(nextContext, {
      ...(memory?.lastControlledExecutionSnapshot || {}),
      Result: nextContext.result.status,
      Reason: nextContext.result.reason,
      Capability: nextContext.capability,
      Ready: nextContext.executionReady,
      Policy: nextContext.policy?.policy || '',
      Confirmation: nextContext.confirmationRequired,
      ConfirmationStatus: nextContext.confirmation?.status || '',
      Dispatcher: nextContext.dispatcher?.dispatcher || '',
      ActionType: nextContext.dispatcher?.action?.type || '',
      createdAt: nextContext.createdAt,
    });
    return nextContext;
  }, [appActions, appState, memory?.lastControlledExecutionSnapshot, recordActionEvent, recordControlledExecutionContext, user]);

  const askBrain = useCallback(async (text) => {
    if (!settings.enabled) return false;
    const thinkingTimer = setTimeout(() => {
      setVisible(true);
      setDismissed(false);
      setEmotion('thinking');
      setAction(LOKI_ACTIONS.LOOK_AROUND);
      setMessage('Думаю...');
      setCard(null);
      setBrainThinking(true);
    }, 1000);
    try {
      const lokiContext = buildLokiContext({ appState, user, activePanel, memory, userMemory });
      const result = await askLokiBrain({ text, appState: { ...lokiContext, personality: { mode: settings.personalityMode } }, memory, userMemory, history, debug: isLokiDebugEnabled() });
      clearTimeout(thinkingTimer);
      setBrainThinking(false);
      setUserMemory(prev => learnFromLokiQuery(prev, text, result));
      if (result.toolContext?.events?.length) recordToolEvents(result.toolContext.events);
      if (result.conversationContext) recordConversationContext(result.conversationContext);
      if (result.capabilityContext) recordCapabilityContext(result.capabilityContext, result.capabilitySnapshot);
      if (result.skillContext) recordSkillContext(result.skillContext, result.skillSnapshot);
      if (result.executionContext) recordExecutionContext(result.executionContext, result.executionSnapshot);
      if (result.controlledExecutionContext) recordControlledExecutionContext(result.controlledExecutionContext, result.controlledExecutionSnapshot);
      if (result.planContext) recordPlanContext(result.planContext);
      if (result.workflowContext) recordWorkflowContext(result.workflowContext);
      if (result.agentContext) recordAgentContext(result.agentContext);
      if (result.decisionContext) recordDecisionContext(result.decisionContext);
      if (result.evaluationSnapshot) recordEvaluationSnapshot(result.evaluationContext, result.evaluationSnapshot);
      if (result.reasoningContext || result.conversationContext || result.capabilityContext || result.skillContext || result.executionContext || result.controlledExecutionContext || result.journeyContext || result.memoryContext || result.planContext || result.workflowContext || result.agentContext || result.personalityPhraseId || result.toolContext) updateMemory({
        ...(result.reasoningContext ? { lastReasoningContext: result.reasoningContext } : {}),
        ...(result.conversationContext ? { lastConversationContext: result.conversationContext, lastConversationSession: result.conversationContext.session } : {}),
        ...(result.capabilityContext ? { lastCapabilityContext: result.capabilityContext, lastCapabilitySnapshot: result.capabilitySnapshot } : {}),
        ...(result.skillContext ? { lastSkillContext: result.skillContext, lastSkillSnapshot: result.skillSnapshot } : {}),
        ...(result.executionContext ? { lastExecutionContext: result.executionContext, lastExecutionSnapshot: result.executionSnapshot } : {}),
        ...(result.controlledExecutionContext ? { lastControlledExecutionContext: result.controlledExecutionContext, lastControlledExecutionSnapshot: result.controlledExecutionSnapshot } : {}),
        ...(result.journeyContext ? { lastJourneyContext: result.journeyContext } : {}),
        ...(result.memoryContext ? { lastMemoryContext: result.memoryContext } : {}),
        ...(result.planContext ? { lastPlanContext: result.planContext } : {}),
        ...(result.workflowContext ? { lastWorkflowContext: result.workflowContext } : {}),
        ...(result.agentContext ? { lastAgentContext: result.agentContext, lastAgentSession: result.agentContext.session } : {}),
        ...(result.toolContext ? { lastToolContext: result.toolContext } : {}),
        ...(result.decisionContext ? { lastDecisionContext: result.decisionContext, decisionSnapshot: result.decisionContext } : {}),
        ...(result.personalityPhraseId ? { personalityHistory: rememberPersonalityPhrase(memory.personalityHistory, { id: result.personalityPhraseId }) } : {}),
        conversationCount: Number(memory.conversationCount || 0) + 1,
        lastSeenAt: new Date().toISOString(),
      });
      if (result.executeAction) {
        setMessage('Показываю.');
        await executeAction(result.executeAction);
        return true;
      }
      showMessage(LOKI_EVENTS.BRAIN_RESPONSE, {
        source: 'loki_brain',
        message: result.text,
        card: result.card,
        priority: LOKI_MESSAGE_PRIORITY.HIGH,
      });
      if (result.controlledExecutionContext?.executionReady) {
        setTimeout(() => dispatchControlledExecution(result.controlledExecutionContext), 120);
      }
      return true;
    } catch (e) {
      clearTimeout(thinkingTimer);
      setBrainThinking(false);
      logError(e, 'LokiProvider.askBrain');
      showMessage(LOKI_EVENTS.APP_ERROR, { source: 'loki_brain', priority: LOKI_MESSAGE_PRIORITY.HIGH });
      return false;
    }
  }, [activePanel, appState, dispatchControlledExecution, executeAction, history, memory, recordAgentContext, recordCapabilityContext, recordControlledExecutionContext, recordConversationContext, recordDecisionContext, recordEvaluationSnapshot, recordExecutionContext, recordPlanContext, recordSkillContext, recordToolEvents, recordWorkflowContext, settings.enabled, settings.personalityMode, showMessage, updateMemory, user, userMemory]);

  const askExperience = useCallback(async (text, options = {}) => {
    if (!settings.enabled) return null;
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    setBrainThinking(true);
    setEmotion('thinking');
    setAction(LOKI_ACTIONS.LOOK_AROUND);
    updateMemory({ inDialog: true, lastPanel: activePanel, lastUserText: text, activeContext });
    try {
      const contextResult = buildNewsContextAnswer(activeContext, text, appState);
      if (contextResult) {
        setBrainThinking(false);
        setEmotion('helper');
        setAction(LOKI_ACTIONS.LISTEN);
        updateMemory({
          lastMessage: { eventType: LOKI_EVENTS.BRAIN_RESPONSE, text: contextResult.text, payload: { cards: contextResult.cards } },
          lastConversation: { userText: text, answer: contextResult.text, action: null },
          lastPanel: activePanel,
          activeContext,
          lastContext: activeContext,
          inDialog: true,
        });
        updateHistory(prev => addLokiHistoryItem(prev, {
          kind: 'brain',
          eventType: LOKI_EVENTS.BRAIN_RESPONSE,
          text: contextResult.text,
          card: contextResult.card,
          priority: LOKI_MESSAGE_PRIORITY.HIGH,
          panel: activePanel,
        }));
        return { card: null, ...contextResult };
      }
      const lokiContext = buildLokiContext({ appState: { ...appState, activeContext }, user, activePanel, memory: { ...memory, activeContext }, userMemory });
      const result = await askLokiBrain({ text, appState: { ...lokiContext, personality: { mode: settings.personalityMode } }, memory: { ...memory, activeContext }, userMemory, history, debug: isLokiDebugEnabled() });
      setBrainThinking(false);
      setEmotion(result.executeAction || result.autoAction ? 'excited' : 'helper');
      setAction(result.executeAction || result.autoAction ? LOKI_ACTIONS.POINT : LOKI_ACTIONS.LISTEN);
      updateMemory({
        lastMessage: { eventType: LOKI_EVENTS.BRAIN_RESPONSE, text: result.text, payload: { card: result.card, cards: result.cards } },
        lastConversation: { userText: text, answer: result.text, action: result.executeAction ?? result.autoAction ?? result.card?.action ?? null },
        lastPanel: activePanel,
        inDialog: true,
        ...(result.reasoningContext ? { lastReasoningContext: result.reasoningContext } : {}),
        ...(result.conversationContext ? { lastConversationContext: result.conversationContext, lastConversationSession: result.conversationContext.session } : {}),
        ...(result.capabilityContext ? { lastCapabilityContext: result.capabilityContext, lastCapabilitySnapshot: result.capabilitySnapshot } : {}),
        ...(result.skillContext ? { lastSkillContext: result.skillContext, lastSkillSnapshot: result.skillSnapshot } : {}),
        ...(result.executionContext ? { lastExecutionContext: result.executionContext, lastExecutionSnapshot: result.executionSnapshot } : {}),
        ...(result.controlledExecutionContext ? { lastControlledExecutionContext: result.controlledExecutionContext, lastControlledExecutionSnapshot: result.controlledExecutionSnapshot } : {}),
        ...(result.journeyContext ? { lastJourneyContext: result.journeyContext } : {}),
        ...(result.memoryContext ? { lastMemoryContext: result.memoryContext } : {}),
        ...(result.planContext ? { lastPlanContext: result.planContext } : {}),
        ...(result.workflowContext ? { lastWorkflowContext: result.workflowContext } : {}),
        ...(result.agentContext ? { lastAgentContext: result.agentContext, lastAgentSession: result.agentContext.session } : {}),
        ...(result.toolContext ? { lastToolContext: result.toolContext } : {}),
        ...(result.decisionContext ? { lastDecisionContext: result.decisionContext, decisionSnapshot: result.decisionContext } : {}),
        personalityHistory: result.personalityPhraseId ? rememberPersonalityPhrase(memory.personalityHistory, { id: result.personalityPhraseId }) : memory.personalityHistory,
        conversationCount: Number(memory.conversationCount || 0) + 1,
        lastSeenAt: new Date().toISOString(),
      });
      if (result.planContext) recordPlanContext(result.planContext);
      if (result.workflowContext) recordWorkflowContext(result.workflowContext);
      if (result.agentContext) recordAgentContext(result.agentContext);
      if (result.conversationContext) recordConversationContext(result.conversationContext);
      if (result.capabilityContext) recordCapabilityContext(result.capabilityContext, result.capabilitySnapshot);
      if (result.skillContext) recordSkillContext(result.skillContext, result.skillSnapshot);
      if (result.executionContext) recordExecutionContext(result.executionContext, result.executionSnapshot);
      if (result.controlledExecutionContext) recordControlledExecutionContext(result.controlledExecutionContext, result.controlledExecutionSnapshot);
      if (result.decisionContext) recordDecisionContext(result.decisionContext);
      if (result.evaluationSnapshot) recordEvaluationSnapshot(result.evaluationContext, result.evaluationSnapshot);
      if (result.toolContext?.events?.length) recordToolEvents(result.toolContext.events);
      setUserMemory(prev => learnFromLokiQuery(prev, text, result));
      userAction('loki:analytics', {
        payload: {
          query: text,
          intent: result.intent,
          resultCount: result.cards?.length || (result.card ? 1 : 0),
          actionType: result.executeAction?.type || result.autoAction?.type || result.card?.action?.type || '',
          panel: activePanel,
          ms: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt),
          success: true,
          source: 'loki_experience',
        },
      }).catch(e => logError(e, 'LokiProvider.analytics'));
      updateHistory(prev => addLokiHistoryItem(prev, {
        kind: 'brain',
        eventType: LOKI_EVENTS.BRAIN_RESPONSE,
        text: result.text,
        card: result.card,
        priority: LOKI_MESSAGE_PRIORITY.HIGH,
        panel: activePanel,
      }));
      const actionToRun = result.executeAction ?? (options.autoExecute ? result.autoAction : null);
      if (actionToRun) setTimeout(() => executeAction(actionToRun), 420);
      else if (result.controlledExecutionContext?.executionReady) setTimeout(() => dispatchControlledExecution(result.controlledExecutionContext), 120);
      return result;
    } catch (e) {
      setBrainThinking(false);
      logError(e, 'LokiProvider.askExperience');
      showMessage(LOKI_EVENTS.APP_ERROR, { source: 'loki_experience', priority: LOKI_MESSAGE_PRIORITY.HIGH });
      return {
        text: 'Что-то пошло не так. Сейчас попробуем разобраться.',
        card: null,
        cards: [],
      };
    }
  }, [activeContext, activePanel, appState, dispatchControlledExecution, executeAction, history, memory, recordAgentContext, recordCapabilityContext, recordControlledExecutionContext, recordConversationContext, recordDecisionContext, recordEvaluationSnapshot, recordExecutionContext, recordPlanContext, recordSkillContext, recordToolEvents, recordWorkflowContext, settings.enabled, settings.personalityMode, showMessage, updateHistory, updateMemory, user, userMemory]);

  const openContextExperience = useCallback((context) => {
    const normalized = normalizeLokiContext(context);
    if (!normalized) {
      setExperienceOpen(true);
      setVisible(false);
      setDismissed(false);
      updateMemory({ inDialog: true, lastPanel: activePanel });
      return;
    }
    setActiveContext(normalized);
    setExperienceOpen(true);
    setVisible(false);
    setDismissed(false);
    setAction(LOKI_ACTIONS.LISTEN);
    setEmotion('helper');
    updateMemory({
      activeContext: normalized,
      lastContext: normalized,
      inDialog: true,
      lastPanel: activePanel,
      lastConversation: normalized.type === 'news' ? { userText: 'Пересказать новость', answer: normalized.initialAnswer, action: null } : undefined,
    });
  }, [activePanel, updateMemory]);

  const value = useMemo(() => {
    const lokiContext = buildLokiContext({ appState, user, activePanel, memory, userMemory });
    const state = lokiContext.appState;
    const interestProfile = buildInterestProfile({ appState: state, memory, userMemory });
    const recommendationFeed = lokiContext.recommendations?.feed?.slice(0, 8) ?? buildRecommendationFeed({ appState: state, memory, userMemory, limit: 8 });
    const scenarioCollections = buildScenarioCollections({ appState: state, memory, userMemory }).filter(item => item.cards.length);
    const dashboard = buildLokiHomeDashboard({ appState: state, user, recommendationFeed });
    return {
    action,
    activeContext,
    activePanel,
    anchor,
    askBrain,
    askExperience,
    brainThinking,
    canTalk,
    card,
    dashboard,
    dismissed,
    emotion,
    emotionalState,
    executeAction,
    experienceOpen,
    isHiddenOnPanel,
    lastEvent,
    history,
    interestProfile,
    lokiContext,
    recommendationFeed,
    scenarioCollections,
    memory: memory ?? DEFAULT_LOKI_MEMORY,
    lastCapabilityContext: memory?.lastCapabilityContext || null,
    lastCapabilitySnapshot: memory?.lastCapabilitySnapshot || null,
    lastCapabilityHistory: memory?.lastCapabilityHistory || memory?.capabilityHistory || [],
    lastSkillContext: memory?.lastSkillContext || null,
    lastSkillSnapshot: memory?.lastSkillSnapshot || null,
    lastSkillHistory: memory?.lastSkillHistory || memory?.skillHistory || [],
    lastExecutionContext: memory?.lastExecutionContext || null,
    lastExecutionSnapshot: memory?.lastExecutionSnapshot || null,
    lastExecutionHistory: memory?.lastExecutionHistory || memory?.executionHistory || [],
    lastControlledExecutionContext: memory?.lastControlledExecutionContext || null,
    lastControlledExecutionSnapshot: memory?.lastControlledExecutionSnapshot || null,
    lastControlledExecutionHistory: memory?.lastControlledExecutionHistory || memory?.controlledExecutionHistory || [],
    lastEvaluationContext: memory?.lastEvaluationContext || null,
    lastEvaluationSnapshot: memory?.lastEvaluationSnapshot || null,
    lastEvaluationHistory: memory?.lastEvaluationHistory || memory?.evaluationHistory || [],
    userMemory,
    message,
    settings,
    handleCharacterTap,
    showMessage,
    resetUserMemory,
    visible,
    openExperience: () => {
      setExperienceOpen(true);
      setVisible(false);
      setDismissed(false);
      if (!activeContext && memory?.lastContext) setActiveContext(memory.lastContext);
      updateMemory({ inDialog: true, lastPanel: activePanel, activeContext: activeContext ?? memory?.lastContext ?? null });
    },
    openContextExperience,
    closeExperience: () => {
      setExperienceOpen(false);
      setAction(LOKI_ACTIONS.WAVE);
      setEmotion('happy');
      updateMemory({ inDialog: false, lastPanel: activePanel, activeContext, lastContext: activeContext ?? memory?.lastContext ?? null });
    },
    hide: () => {
      if (activeHistoryIdRef.current) {
        const id = activeHistoryIdRef.current;
        updateHistory(prev => markLokiHistoryItem(prev, id, 'ignored'));
      }
      if (memory?.lastRecommendation) {
        if (memory.lastRecommendation.opportunity) markOpportunityDismissed(memory.lastRecommendation.opportunity);
        updateMemory({ learning: learnFromRecommendationResult(memory.learning, memory.lastRecommendation, 'ignored') });
      }
      setAction(LOKI_ACTIONS.WAVE);
      setEmotion('happy');
      setMessage('');
      setCard(null);
      setDismissed(true);
      setTimeout(() => setVisible(false), 360);
    },
    show: () => { setDismissed(false); setVisible(true); },
    hideCurrentPanel: () => persistSettings({ ...settings, hiddenPanels: [...new Set([...settings.hiddenPanels, activePanel])] }),
    showCurrentPanel: () => persistSettings({ ...settings, hiddenPanels: settings.hiddenPanels.filter(panel => panel !== activePanel) }),
    setHintsEnabled: (enabled) => persistSettings({ ...settings, enabled }),
    setBubbleEnabled: (bubbleEnabled) => persistSettings({ ...settings, bubbleEnabled }),
    setMode: (mode) => persistSettings({ ...settings, mode }),
    setPersonalityMode: (personalityMode) => persistSettings({ ...settings, personalityMode }),
  };
  }, [action, activeContext, activePanel, anchor, appState, askBrain, askExperience, brainThinking, canTalk, card, dismissed, emotion, emotionalState, executeAction, experienceOpen, handleCharacterTap, history, isHiddenOnPanel, lastEvent, memory, message, openContextExperience, persistSettings, resetUserMemory, settings, showMessage, updateHistory, updateMemory, user, userMemory, visible]);

  return <LokiContext.Provider value={value}>{children}</LokiContext.Provider>;
}

export function useLoki() {
  const value = useContext(LokiContext);
  if (!value) throw new Error('useLoki must be used inside LokiProvider');
  return value;
}
