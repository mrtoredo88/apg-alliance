import { LOKI_APP_ACTIONS, createLokiAction } from '../../lokiActionTypes.js';
import { normalizeText, titleOf } from '../lokiCoreUtils.js';
import { detectLokiIntent, intentNeedsLocalAnswer } from '../intent/IntentRouter.js';
import { buildLokiKnowledgeProvider, makeKnowledgeResultCard, searchKnowledge } from './KnowledgeProvider.js';
import { explainLastKnowledgeIndex, isKnowledgeIndexExplainQuery, runLokiKnowledgeIndex } from '../knowledgeIndex/index.js';
import { runReasoningEngine } from '../reasoning/ReasoningEngine.js';
import { runJourneyEngine } from '../journey/JourneyEngine.js';
import { runLokiMemoryEngine } from '../memory/MemoryEngine.js';
import { runLokiPlanner } from '../planner/Planner.js';
import { runLokiToolLayer } from '../tools/ToolCenter.js';
import { runLokiWorkflowEngine } from '../workflows/WorkflowEngine.js';
import { buildWorkflowSnapshot } from '../workflows/WorkflowSnapshot.js';
import { runLokiAgentContinuation, runLokiAgentEngine } from '../agent/AgentEngine.js';
import { runLokiConversationEngine } from '../conversation/ConversationEngine.js';
import { explainLastDecision, isDecisionExplainQuery, runLokiDecisionEngine } from '../decision/index.js';
import { explainLastCapability, isCapabilityExplainQuery, runLokiCapabilityEngine } from '../capabilities/index.js';
import { explainLastSkill, isSkillExplainQuery, runLokiSkillResolver } from '../skills/index.js';
import { explainLastExecution, isExecutionExplainQuery, runCapabilityExecutionBridge } from '../execution/index.js';
import { explainLastControlledExecution, isControlledExecutionExplainQuery, runControlledExecutionEngine } from '../controlledExecution/index.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function text(value, max = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function firstFilled(...values) {
  return values.map(value => text(value)).find(Boolean) || '';
}

function findSourceItem(knowledge, row) {
  const sourceKey = row.type === 'article' ? 'news' : row.type === 'gift' ? 'gifts' : `${row.type}s`;
  return list(knowledge.sources?.[sourceKey]).find(item => String(item.id) === String(row.id)) || null;
}

function currentContextItem(knowledge, expectedTypes = []) {
  const context = knowledge.screenContext || {};
  if (context.item && (!expectedTypes.length || expectedTypes.includes(context.item.type || context.type))) return context.item;
  const type = expectedTypes.find(item => list(knowledge.sources?.[`${item}s`]).length) || context.type;
  if (type === 'partner') return knowledge.sources.partners?.[0] || null;
  if (type === 'expert') return knowledge.sources.experts?.[0] || null;
  if (type === 'event') return knowledge.sources.events?.[0] || null;
  if (type === 'news') return knowledge.sources.news?.[0] || null;
  if (type === 'location') return knowledge.sources.locations?.[0] || null;
  return null;
}

function cardsFromRows(knowledge, rows) {
  return rows
    .map(row => {
      const item = findSourceItem(knowledge, row);
      return item ? makeKnowledgeResultCard(item, row.type) : null;
    })
    .filter(Boolean);
}

function answerSearch({ intent, knowledge }) {
  const rows = searchKnowledge(knowledge, intent.query, intent.types, 4);
  const cards = cardsFromRows(knowledge, rows);
  const labels = {
    'search.partners': 'партнёров',
    'search.events': 'мероприятия',
    'search.promotions': 'акции',
    'search.gifts': 'подарки',
    'search.locations': 'филиалы',
    'search.specialists': 'специалистов',
    'news.question': 'публикации',
  };
  if (!cards.length) {
    return {
      intent: intent.id,
      text: `Я проверил данные АПГ, но сейчас не нашёл подходящие ${labels[intent.id] || 'объекты'}. Ничего не придумываю.`,
      card: null,
      cards: [],
      knowledge,
    };
  }
  return {
    intent: intent.id,
    text: `Нашёл ${cards.length} ${labels[intent.id] || 'варианта'} в данных АПГ. Начал бы с «${cards[0].title}».`,
    card: cards[0],
    cards,
    knowledge,
  };
}

function answerHours({ intent, knowledge }) {
  const item = currentContextItem(knowledge, ['location', 'partner']) || findSourceItem(knowledge, searchKnowledge(knowledge, intent.query, ['location', 'partner'], 1)[0] || {});
  if (!item) return null;
  const location = item.type === 'location' ? item : item.mainLocation || item.locations?.[0] || null;
  const hours = firstFilled(location?.workingHours, location?.hours, item.workingHours, item.hours, item.schedule);
  const title = titleOf(location || item, titleOf(item, 'карточки'));
  return {
    intent: 'info.hours',
    text: hours
      ? `По «${title}» вижу график: ${hours}.`
      : `В данных АПГ для «${title}» пока нет заполненного графика работы.`,
    card: makeKnowledgeResultCard(item.type === 'location' ? item : { ...item, address: location?.address || item.address }, item.type === 'location' ? 'location' : 'partner', { locationId: location?.id || '' }),
    cards: [],
    knowledge,
  };
}

function answerContacts({ intent, knowledge }) {
  const item = currentContextItem(knowledge, ['location', 'partner', 'expert']) || findSourceItem(knowledge, searchKnowledge(knowledge, intent.query, ['location', 'partner', 'expert'], 1)[0] || {});
  if (!item) return null;
  const location = item.type === 'location' ? item : item.mainLocation || item.locations?.[0] || null;
  const phone = firstFilled(location?.phone, item.phone);
  const telegram = firstFilled(location?.telegramUrl, location?.telegram, item.telegramUrl, item.telegram);
  const whatsapp = firstFilled(location?.whatsappUrl, location?.whatsapp, item.whatsappUrl, item.whatsapp);
  const website = firstFilled(location?.websiteUrl, location?.website, item.websiteUrl, item.website);
  const rows = [
    phone ? `телефон: ${phone}` : '',
    telegram ? `Telegram: ${telegram}` : '',
    whatsapp ? `WhatsApp: ${whatsapp}` : '',
    website ? `сайт: ${website}` : '',
  ].filter(Boolean);
  return {
    intent: 'info.contacts',
    text: rows.length
      ? `Контакты «${titleOf(item, 'карточки')}»: ${rows.join('; ')}.`
      : `В карточке «${titleOf(item, 'карточки')}» пока нет заполненных контактов.`,
    card: makeKnowledgeResultCard(item, item.type === 'expert' ? 'expert' : item.type === 'location' ? 'location' : 'partner', { locationId: location?.id || '' }),
    cards: [],
    knowledge,
  };
}

function answerBooking({ knowledge }) {
  const item = currentContextItem(knowledge, ['partner', 'expert', 'location']);
  const future = list(knowledge.sources.bookings).filter(row => !row.status || !['cancelled', 'done'].includes(normalizeText(row.status))).slice(0, 3);
  if (item) {
    const bookingUrl = firstFilled(item.bookingUrl, item.mainLocation?.bookingUrl);
    return {
      intent: 'info.booking',
      text: bookingUrl
        ? `Для «${titleOf(item, 'карточки')}» есть ссылка на запись. Открою карточку, там можно продолжить сценарий.`
        : `Открою карточку «${titleOf(item, 'карточки')}»: если запись доступна, кнопка будет внутри карточки.`,
      card: makeKnowledgeResultCard(item, item.type === 'expert' ? 'expert' : item.type === 'location' ? 'location' : 'partner'),
      cards: [],
      knowledge,
    };
  }
  return {
    intent: 'info.booking',
    text: future.length
      ? `Вижу ${future.length} ближайшие записи. Могу помочь открыть профиль или Workspace, чтобы продолжить.`
      : 'По текущим данным не вижу активных записей. Можно открыть партнёра или эксперта и начать запись из карточки.',
    card: { title: 'Профиль', text: 'Записи и действия пользователя.', action: createLokiAction(LOKI_APP_ACTIONS.SHOW_PROFILE), label: 'Открыть' },
    cards: future.map(row => ({ id: row.id, type: 'booking', title: row.title, text: row.locationTitle || row.providerName || row.status || 'Запись', label: 'Профиль', action: createLokiAction(LOKI_APP_ACTIONS.SHOW_PROFILE) })),
    knowledge,
  };
}

function answerProfile({ context, knowledge }) {
  const user = context.user || {};
  const profile = knowledge.sources.userProfile || {};
  const keys = Number(user.keys ?? profile.keys ?? 0);
  const favorites = Number(user.favorites?.length ?? context.favorites?.count ?? 0);
  return {
    intent: 'profile.question',
    text: `По профилю: ${keys} ключей, ${favorites} избранных, активный экран — ${user.currentPanel || context.currentScreen?.id || 'АПГ'}.`,
    card: { title: 'Профиль', text: 'Ключи, достижения, избранное и настройки.', action: createLokiAction(LOKI_APP_ACTIONS.SHOW_PROFILE), label: 'Открыть профиль' },
    cards: [],
    knowledge,
  };
}

function answerWorkspace({ knowledge }) {
  const analytics = knowledge.sources.workspaceAnalytics || {};
  const kpis = analytics.kpis || analytics.summary || analytics;
  const rows = [
    Number(kpis.profileViews || kpis.views || 0) ? `просмотры: ${Number(kpis.profileViews || kpis.views || 0)}` : '',
    Number(kpis.newBookings || kpis.bookings || 0) ? `записи: ${Number(kpis.newBookings || kpis.bookings || 0)}` : '',
    Number(kpis.newDialogs || kpis.dialogs || 0) ? `диалоги: ${Number(kpis.newDialogs || kpis.dialogs || 0)}` : '',
    Number(kpis.conversion || 0) ? `конверсия: ${Number(kpis.conversion)}%` : '',
  ].filter(Boolean);
  return {
    intent: 'workspace.question',
    text: rows.length
      ? `По Workspace вижу: ${rows.join('; ')}.`
      : 'Workspace доступен как рабочая зона партнёра/эксперта: профиль, контент, аналитика, записи, диалоги и подарки.',
    card: { title: 'Workspace', text: 'Рабочая зона АПГ для управления профилем и контентом.', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_LOKI), label: 'Продолжить' },
    cards: [],
    knowledge,
  };
}

function answerReviews({ knowledge }) {
  const reviews = list(knowledge.sources.reviews);
  const rated = reviews.filter(row => Number(row.rating || 0) > 0);
  if (!reviews.length) return {
    intent: 'reviews.question',
    text: 'В текущем контексте у меня нет загруженных отзывов. Если они есть в карточке, откройте раздел отзывов внутри профиля.',
    card: null,
    cards: [],
    knowledge,
  };
  const average = rated.length ? Math.round(rated.reduce((sum, row) => sum + Number(row.rating || 0), 0) / rated.length * 10) / 10 : 0;
  return {
    intent: 'reviews.question',
    text: average ? `Вижу ${reviews.length} отзывов, средняя оценка ${average}.` : `Вижу ${reviews.length} отзывов без числовой оценки.`,
    card: null,
    cards: reviews.slice(0, 3).map(row => ({ id: row.id, type: 'review', title: row.title, text: text(row.text || row.comment, 160), label: 'Понятно' })),
    knowledge,
  };
}

function answerContext({ intent, knowledge }) {
  const item = currentContextItem(knowledge, intent.types);
  if (!item) return null;
  const locations = list(item.locations);
  const bits = [
    item.category || item.specialization,
    item.address || item.mainLocation?.address,
    hasOfferText(item),
    locations.length > 1 ? `${locations.length} филиала` : '',
  ].filter(Boolean);
  return {
    intent: 'context.card',
    text: `Сейчас контекст — «${titleOf(item, 'карточка')}». ${bits.length ? `Коротко: ${bits.join('; ')}.` : 'Вижу основную карточку и могу отвечать по её данным.'}`,
    card: makeKnowledgeResultCard(item, item.type === 'expert' ? 'expert' : item.type === 'event' ? 'event' : item.type === 'news' ? 'news' : 'partner'),
    cards: [],
    knowledge,
  };
}

function hasOfferText(item = {}) {
  return firstFilled(item.offer, item.promo, item.discount, item.specialOffer, item.actionText);
}

function attachDecision(result, question, context) {
  if (!result) return result;
  if (result.decisionContext?.decisionId) return result;
  return {
    ...result,
    decisionContext: runLokiDecisionEngine({ question, result, context }),
  };
}

function attachCapability(result, capability = {}) {
  if (!result || !capability.capabilityContext?.capability) return result;
  return {
    ...result,
    capabilityContext: result.capabilityContext || capability.capabilityContext,
    capabilitySnapshot: result.capabilitySnapshot || capability.capabilitySnapshot,
  };
}

function attachExecution(result, execution = {}) {
  if (!result || !execution.executionContext?.capability) return result;
  return {
    ...result,
    executionContext: result.executionContext || execution.executionContext,
    executionSnapshot: result.executionSnapshot || execution.executionSnapshot,
  };
}

function attachControlledExecution(result, controlled = {}) {
  if (!result || !controlled.controlledExecutionContext?.capability) return result;
  return {
    ...result,
    controlledExecutionContext: result.controlledExecutionContext || controlled.controlledExecutionContext,
    controlledExecutionSnapshot: result.controlledExecutionSnapshot || controlled.controlledExecutionSnapshot,
  };
}

function attachSkill(result, skill = {}) {
  if (!result || !skill.skillContext?.skill) return result;
  return {
    ...result,
    skillContext: result.skillContext || skill.skillContext,
    skillSnapshot: result.skillSnapshot || skill.skillSnapshot,
  };
}

function attachKnowledgeIndex(result, indexResult = {}) {
  if (!result || !indexResult.knowledgeSnapshot) return result;
  return {
    ...result,
    knowledgeSnapshot: result.knowledgeSnapshot || indexResult.knowledgeSnapshot,
    knowledgeIndexSearch: result.knowledgeIndexSearch || indexResult.knowledgeIndexSearch,
    expandedKnowledgeContext: result.expandedKnowledgeContext || indexResult.expandedKnowledgeContext,
  };
}

export function runLokiKnowledgeEngine({ text: question, appState = {}, context = null, traceMessage = null } = {}) {
  const trace = typeof traceMessage === 'function' ? traceMessage : () => {};
  if (isKnowledgeIndexExplainQuery(question)) {
    return attachDecision(explainLastKnowledgeIndex(context?.memory || {}), question, context);
  }
  if (isSkillExplainQuery(question)) {
    return attachDecision(explainLastSkill(context?.memory || {}), question, context);
  }
  if (isControlledExecutionExplainQuery(question)) {
    return attachDecision(explainLastControlledExecution(context?.memory || {}), question, context);
  }
  if (isExecutionExplainQuery(question)) {
    return attachDecision(explainLastExecution(context?.memory || {}), question, context);
  }
  if (isCapabilityExplainQuery(question)) {
    return attachDecision(explainLastCapability(context?.memory || {}), question, context);
  }
  if (isDecisionExplainQuery(question)) {
    return attachDecision(explainLastDecision(context?.memory || {}), question, context);
  }
  const sourceState = context?.appState || appState?.appState || appState;
  trace('STEP 11.1 Knowledge provider start', {});
  const knowledge = buildLokiKnowledgeProvider({ ...sourceState, activeContext: context?.memory?.activeContext || sourceState.activeContext });
  trace('STEP 11.1 Knowledge provider OK', { partners: knowledge?.counts?.partners || 0, events: knowledge?.counts?.events || 0, news: knowledge?.counts?.news || 0 });
  trace('STEP 11.2 Knowledge Index start', {});
  const knowledgeIndexResult = runLokiKnowledgeIndex({ question, knowledge, appState: sourceState });
  trace('STEP 11.2 Knowledge Index OK', {
    entities: knowledgeIndexResult?.knowledgeSnapshot?.Entities || 0,
    relations: knowledgeIndexResult?.knowledgeSnapshot?.Relations || 0,
    searchResults: knowledgeIndexResult?.knowledgeIndexSearch?.entities?.length || 0,
  });
  knowledge.knowledgeIndex = knowledgeIndexResult.knowledgeIndex;
  knowledge.knowledgeSnapshot = knowledgeIndexResult.knowledgeSnapshot;
  knowledge.knowledgeIndexSearch = knowledgeIndexResult.knowledgeIndexSearch;
  knowledge.expandedKnowledgeContext = knowledgeIndexResult.expandedKnowledgeContext;
  const intent = detectLokiIntent(question, knowledge);
  trace('STEP 11.3 Intent OK', { intent: intent?.id || '', confidence: intent?.confidence || 0 });
  trace('STEP 11.4 Reasoning start', {});
  const contextReasoning = runReasoningEngine({ question, intent, knowledge, context });
  trace('STEP 11.4 Reasoning OK', { handled: Boolean(contextReasoning?.reasoningHandled), intent: contextReasoning?.intent || '' });
  trace('STEP 11.5 Conversation start', {});
  const conversationResult = runLokiConversationEngine({ question, intent, reasoningResult: contextReasoning, context });
  trace('STEP 11.5 Conversation OK', { needsClarification: Boolean(conversationResult?.needsClarification), effectiveQuestion: conversationResult?.effectiveQuestion || '' });
  const conversationContext = conversationResult?.conversationContext || null;
  if (conversationResult?.needsClarification) {
    return attachDecision({
      intent: 'conversation.clarify',
      preserveText: true,
      text: conversationResult.clarificationText,
      card: null,
      cards: [],
      knowledge,
      reasoningContext: contextReasoning?.reasoningContext,
      conversationContext,
    }, question, context);
  }
  const effectiveQuestion = conversationResult?.effectiveQuestion || question;
  const effectiveIntent = conversationResult?.effectiveIntent || intent;
  const contextWithConversation = {
    ...(context || {}),
    memory: {
      ...(context?.memory || {}),
      knowledgeSnapshot: knowledgeIndexResult.knowledgeSnapshot,
      lastKnowledgeSnapshot: knowledgeIndexResult.knowledgeSnapshot,
      lastKnowledgeIndexSearch: knowledgeIndexResult.knowledgeIndexSearch,
      conversationSnapshot: conversationContext?.snapshot,
      lastConversationSession: conversationContext?.session,
    },
  };
  const effectiveReasoning = effectiveQuestion !== question || effectiveIntent !== intent
    ? runReasoningEngine({ question: effectiveQuestion, intent: effectiveIntent, knowledge, context: contextWithConversation }) || contextReasoning
    : contextReasoning;
  const capabilityResult = runLokiCapabilityEngine({
    question: effectiveQuestion,
    intent: effectiveIntent,
    reasoningResult: effectiveReasoning,
    conversationContext,
    decisionContext: context?.memory?.lastDecisionContext || context?.memory?.decisionSnapshot || null,
    context: contextWithConversation,
    memory: context?.memory || {},
    knowledge,
  });
  trace('STEP 11.6 Capability OK', { capability: capabilityResult?.capabilityContext?.capability || '', confidence: capabilityResult?.capabilityContext?.confidence || 0 });
  const skillResult = runLokiSkillResolver({
    question: effectiveQuestion,
    intent: effectiveIntent,
    reasoningResult: effectiveReasoning,
    conversationContext,
    capabilityContext: capabilityResult.capabilityContext,
    context: contextWithConversation,
    memory: context?.memory || {},
    knowledge,
  });
  trace('STEP 11.7 Skills OK', { skill: skillResult?.skillContext?.skill || '', confidence: skillResult?.skillContext?.confidence || 0 });
  const executionResult = runCapabilityExecutionBridge({
    question: effectiveQuestion,
    capabilityContext: capabilityResult.capabilityContext,
    context: contextWithConversation,
    memory: context?.memory || {},
    knowledge,
    parameters: skillResult.skillContext?.preparedParameters || {},
  });
  trace('STEP 11.8 Execution Bridge OK', { capability: executionResult?.executionContext?.capability || '', ready: Boolean(executionResult?.executionContext?.ready), missing: executionResult?.executionContext?.missing || [] });
  const controlledExecutionResult = runControlledExecutionEngine({
    question: effectiveQuestion,
    executionContext: executionResult.executionContext,
    context: contextWithConversation,
    memory: context?.memory || {},
    appState: sourceState,
  });
  trace('STEP 11.9 Controlled Execution OK', { ready: Boolean(controlledExecutionResult?.controlledExecutionContext?.executionReady), status: controlledExecutionResult?.controlledExecutionContext?.result?.status || '' });
  const contextWithCapability = {
    ...contextWithConversation,
    capabilityContext: capabilityResult.capabilityContext,
    knowledgeSnapshot: knowledgeIndexResult.knowledgeSnapshot,
    knowledgeIndexSearch: knowledgeIndexResult.knowledgeIndexSearch,
    expandedKnowledgeContext: knowledgeIndexResult.expandedKnowledgeContext,
    capabilitySnapshot: capabilityResult.capabilitySnapshot,
    skillContext: skillResult.skillContext,
    skillSnapshot: skillResult.skillSnapshot,
    executionContext: executionResult.executionContext,
    executionSnapshot: executionResult.executionSnapshot,
    controlledExecutionContext: controlledExecutionResult.controlledExecutionContext,
    controlledExecutionSnapshot: controlledExecutionResult.controlledExecutionSnapshot,
    memory: {
      ...(contextWithConversation?.memory || {}),
      knowledgeSnapshot: knowledgeIndexResult.knowledgeSnapshot,
      lastKnowledgeSnapshot: knowledgeIndexResult.knowledgeSnapshot,
      lastKnowledgeIndexSearch: knowledgeIndexResult.knowledgeIndexSearch,
      capabilityContext: capabilityResult.capabilityContext,
      capabilitySnapshot: capabilityResult.capabilitySnapshot,
      lastCapabilityContext: capabilityResult.capabilityContext,
      skillContext: skillResult.skillContext,
      skillSnapshot: skillResult.skillSnapshot,
      lastSkillContext: skillResult.skillContext,
      executionContext: executionResult.executionContext,
      executionSnapshot: executionResult.executionSnapshot,
      lastExecutionContext: executionResult.executionContext,
      controlledExecutionContext: controlledExecutionResult.controlledExecutionContext,
      controlledExecutionSnapshot: controlledExecutionResult.controlledExecutionSnapshot,
      lastControlledExecutionContext: controlledExecutionResult.controlledExecutionContext,
    },
  };
  const contextJourney = runJourneyEngine({ question: effectiveQuestion, intent: effectiveIntent, knowledge, reasoningResult: effectiveReasoning, context: contextWithCapability });
  trace('STEP 11.10 Journey OK', { handled: Boolean(contextJourney?.journeyHandled), intent: contextJourney?.intent || '' });
  const memoryResult = runLokiMemoryEngine({ question: effectiveQuestion, intent: effectiveIntent, reasoningResult: effectiveReasoning, journeyResult: contextJourney, knowledge, context: contextWithCapability, appState: sourceState });
  trace('STEP 11.11 Memory OK', { empty: Boolean(memoryResult?.memoryContext?.empty), used: memoryResult?.memoryContext?.used?.length || 0 });
  const contextWithMemory = memoryResult?.context || context;
  const workflowSnapshot = buildWorkflowSnapshot(contextWithMemory?.memory || {});
  const contextWithWorkflow = {
    ...contextWithMemory,
    capabilityContext: capabilityResult.capabilityContext,
    knowledgeSnapshot: knowledgeIndexResult.knowledgeSnapshot,
    knowledgeIndexSearch: knowledgeIndexResult.knowledgeIndexSearch,
    expandedKnowledgeContext: knowledgeIndexResult.expandedKnowledgeContext,
    capabilitySnapshot: capabilityResult.capabilitySnapshot,
    skillContext: skillResult.skillContext,
    skillSnapshot: skillResult.skillSnapshot,
    executionContext: executionResult.executionContext,
    executionSnapshot: executionResult.executionSnapshot,
    controlledExecutionContext: controlledExecutionResult.controlledExecutionContext,
    controlledExecutionSnapshot: controlledExecutionResult.controlledExecutionSnapshot,
    memory: { ...(contextWithMemory?.memory || {}), knowledgeSnapshot: knowledgeIndexResult.knowledgeSnapshot, lastKnowledgeSnapshot: knowledgeIndexResult.knowledgeSnapshot, lastKnowledgeIndexSearch: knowledgeIndexResult.knowledgeIndexSearch, workflowSnapshot, conversationSnapshot: conversationContext?.snapshot, lastConversationSession: conversationContext?.session, capabilityContext: capabilityResult.capabilityContext, capabilitySnapshot: capabilityResult.capabilitySnapshot, lastCapabilityContext: capabilityResult.capabilityContext, skillContext: skillResult.skillContext, skillSnapshot: skillResult.skillSnapshot, lastSkillContext: skillResult.skillContext, executionContext: executionResult.executionContext, executionSnapshot: executionResult.executionSnapshot, lastExecutionContext: executionResult.executionContext, controlledExecutionContext: controlledExecutionResult.controlledExecutionContext, controlledExecutionSnapshot: controlledExecutionResult.controlledExecutionSnapshot, lastControlledExecutionContext: controlledExecutionResult.controlledExecutionContext },
  };
  const finalize = result => attachKnowledgeIndex(attachDecision(attachControlledExecution(attachExecution(attachSkill(attachCapability(result, capabilityResult), skillResult), executionResult), controlledExecutionResult), effectiveQuestion, contextWithWorkflow), knowledgeIndexResult);
  const continuationResult = runLokiAgentContinuation({ question: effectiveQuestion, context: contextWithWorkflow });
  trace('STEP 12 Agent continuation checked', { handled: Boolean(continuationResult) });
  if (continuationResult) return finalize({ ...continuationResult, knowledge, reasoningContext: effectiveReasoning?.reasoningContext, conversationContext, journeyContext: contextJourney?.journeyContext, memoryContext: memoryResult?.memoryContext });
  trace('STEP 13 Planner start', {});
  const plannerResult = runLokiPlanner({ question: effectiveQuestion, intent: effectiveIntent, reasoningResult: effectiveReasoning, journeyResult: contextJourney, knowledge, context: contextWithWorkflow, appState: sourceState });
  trace('STEP 13 Planner returned', { hasResult: Boolean(plannerResult), intent: plannerResult?.intent || '', goal: plannerResult?.planContext?.goal || '' });
  if (plannerResult) {
    trace('STEP 13.1 Workflow start', {});
    const workflowResult = runLokiWorkflowEngine({ question: effectiveQuestion, intent: effectiveIntent, plannerResult, reasoningResult: effectiveReasoning, journeyResult: contextJourney, knowledge, context: contextWithWorkflow, appState: sourceState });
    trace('STEP 13.1 Workflow returned', { hasResult: Boolean(workflowResult), workflow: workflowResult?.workflowContext?.workflowId || '' });
    if (workflowResult) {
      trace('STEP 13.2 Agent start', { source: 'workflow' });
      const agentResult = runLokiAgentEngine({ question: effectiveQuestion, result: workflowResult, context: contextWithWorkflow, appState: sourceState });
      trace('STEP 13.2 Agent returned', { hasResult: Boolean(agentResult), intent: agentResult?.intent || '' });
      return finalize({ ...agentResult, knowledge, reasoningContext: effectiveReasoning?.reasoningContext, conversationContext, journeyContext: contextJourney?.journeyContext, memoryContext: memoryResult?.memoryContext });
    }
    trace('STEP 13.2 Agent start', { source: 'planner' });
    const agentResult = runLokiAgentEngine({ question: effectiveQuestion, result: plannerResult, context: contextWithWorkflow, appState: sourceState });
    trace('STEP 13.2 Agent returned', { hasResult: Boolean(agentResult), intent: agentResult?.intent || '' });
    return finalize({ ...agentResult, knowledge, reasoningContext: effectiveReasoning?.reasoningContext, conversationContext, journeyContext: contextJourney?.journeyContext, memoryContext: memoryResult?.memoryContext });
  }
  trace('STEP 13 Tool Calling start', {});
  const toolResult = runLokiToolLayer({ question: effectiveQuestion, intent: effectiveIntent, reasoningResult: effectiveReasoning, journeyResult: contextJourney, knowledge, context: contextWithWorkflow, appState: sourceState });
  trace('STEP 13 Tool Calling returned', { hasResult: Boolean(toolResult), status: toolResult?.toolContext?.status || '', tool: toolResult?.toolContext?.call?.id || '' });
  if (toolResult && toolResult.toolContext?.status !== 'denied') {
    trace('STEP 13.2 Agent start', { source: 'tool' });
    const agentResult = runLokiAgentEngine({ question: effectiveQuestion, result: toolResult, context: contextWithWorkflow, appState: sourceState });
    trace('STEP 13.2 Agent returned', { hasResult: Boolean(agentResult), intent: agentResult?.intent || '' });
    return finalize({ ...agentResult, knowledge, reasoningContext: effectiveReasoning?.reasoningContext, conversationContext, journeyContext: contextJourney?.journeyContext, memoryContext: memoryResult?.memoryContext });
  }
  if (contextJourney?.journeyHandled) return finalize({ ...contextJourney, conversationContext });
  if (contextJourney && (context?.memory?.lastJourneyContext || context?.memory?.journeyContext)) return finalize({ ...contextJourney, conversationContext });
  if (effectiveReasoning?.reasoningHandled) return finalize({ ...effectiveReasoning, conversationContext });
  if (effectiveReasoning?.reasoningContext?.source === 'memory') return finalize({ ...effectiveReasoning, conversationContext });
  if (!intentNeedsLocalAnswer(effectiveIntent)) {
    if (contextJourney) return finalize({ ...contextJourney, conversationContext });
    if (effectiveReasoning) return finalize({ ...effectiveReasoning, conversationContext });
    const fallbackRows = searchKnowledge(knowledge, effectiveIntent.query || effectiveQuestion, [], 4);
    if (fallbackRows.length) {
      const fallbackIntent = { ...effectiveIntent, id: 'knowledge.search', types: [], query: effectiveIntent.query || effectiveQuestion };
      const reasoned = runReasoningEngine({ question: effectiveQuestion, intent: fallbackIntent, knowledge, context: contextWithWorkflow });
      const journey = runJourneyEngine({ question: effectiveQuestion, intent: fallbackIntent, knowledge, reasoningResult: reasoned, context: contextWithWorkflow });
      if (journey) return finalize({ ...journey, conversationContext });
      return finalize({ ...(reasoned || answerSearch({ intent: fallbackIntent, knowledge })), conversationContext });
    }
    return null;
  }

  if (effectiveIntent.id.startsWith('search.') || effectiveIntent.id === 'news.question') {
    const reasoned = runReasoningEngine({ question: effectiveQuestion, intent: effectiveIntent, knowledge, context: contextWithWorkflow });
    const journey = runJourneyEngine({ question: effectiveQuestion, intent: effectiveIntent, knowledge, reasoningResult: reasoned, context: contextWithWorkflow });
    if (journey) return finalize({ ...journey, conversationContext });
    return finalize({ ...(reasoned || answerSearch({ intent: effectiveIntent, knowledge })), conversationContext });
  }
  if (effectiveIntent.id === 'context.card') {
    const reasoned = runReasoningEngine({ question: effectiveQuestion, intent: effectiveIntent, knowledge, context: contextWithWorkflow });
    const journey = runJourneyEngine({ question: effectiveQuestion, intent: effectiveIntent, knowledge, reasoningResult: reasoned, context: contextWithWorkflow });
    if (journey) return finalize({ ...journey, conversationContext });
    if (reasoned) return finalize({ ...reasoned, conversationContext });
  }

  if (effectiveIntent.id === 'info.hours') return finalize({ ...answerHours({ intent: effectiveIntent, knowledge }), conversationContext });
  if (effectiveIntent.id === 'info.contacts') return finalize({ ...answerContacts({ intent: effectiveIntent, knowledge }), conversationContext });
  if (effectiveIntent.id === 'info.booking') return finalize({ ...answerBooking({ intent: effectiveIntent, knowledge }), conversationContext });
  if (effectiveIntent.id === 'profile.question') return finalize({ ...answerProfile({ context: context || {}, knowledge }), conversationContext });
  if (effectiveIntent.id === 'workspace.question') return finalize({ ...answerWorkspace({ knowledge }), conversationContext });
  if (effectiveIntent.id === 'reviews.question') return finalize({ ...answerReviews({ knowledge }), conversationContext });
  if (effectiveIntent.id === 'context.card') return finalize({ ...answerContext({ intent: effectiveIntent, knowledge }), conversationContext });
  return null;
}
