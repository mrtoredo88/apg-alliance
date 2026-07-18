import { Navigator } from './modules/Navigator.js';
import { ActionRouter } from './modules/ActionRouter.js';
import { ConciergeEngine } from './modules/ConciergeEngine.js';
import { PartnerExpert } from './modules/PartnerExpert.js';
import { EventExpert } from './modules/EventExpert.js';
import { RewardsExpert } from './modules/RewardsExpert.js';
import { NewsExpert } from './modules/NewsExpert.js';
import { ProfileExpert } from './modules/ProfileExpert.js';
import { KnowledgeExpert } from './modules/KnowledgeExpert.js';
import { MemoryEngine } from './modules/MemoryEngine.js';
import { RecommendationEngine } from './modules/RecommendationEngine.js';
import { ObserverModule } from './modules/ObserverModule.js';
import { PersonalityEngine } from './modules/PersonalityEngine.js';
import { getActiveLokiAiProvider } from './lokiAiProviders.js';
import { emptyResult, includesAny, normalizeText } from './lokiCoreUtils.js';
import { APG_KNOWLEDGE_BASE, validateApgKnowledgeBase } from '../knowledge/index.js';
import { explainLastRecommendation } from '../LokiIntelligence.js';
import { buildPersonalRoute, buildSurprisePick } from '../LokiPlanner.js';
import { runBrainLayer } from './brain/BrainLayer.js';
import { getLearningScreenExplanation } from '../../learningSystem.js';
import { AdminAssistant, PlannerEngine, Reasoner } from './v2/index.js';
import { LokiModuleRegistry } from './v2/LokiModuleRegistry.js';
import { ScenarioRegistry } from './v2/ScenarioRegistry.js';
import { LOKI_SCENARIOS } from './brain/lokiScenarios.js';
import { buildLokiKnowledgeProvider } from './knowledge/KnowledgeProvider.js';
import { runLokiKnowledgeEngine } from './knowledge/SmartAnswerPipeline.js';
import { runPersonalizationEngine } from './personalization/PersonalizationEngine.js';
import { runProactiveAnswer } from './proactive/ProactiveEngine.js';
import { runLokiActionCenter } from './actions/ActionCenter.js';
import { runLokiDecisionEngine } from './decision/index.js';
import { runLokiEvaluationEngine } from './evaluation/index.js';

const LOKI_MODULES = [
  ActionRouter,
  ConciergeEngine,
  Navigator,
  KnowledgeExpert,
  PartnerExpert,
  EventExpert,
  RewardsExpert,
  NewsExpert,
  ProfileExpert,
  RecommendationEngine,
];

export const LOKI_CORE_REGISTRY = {
  core: 'Loki Core V2',
  memory: MemoryEngine,
  personality: PersonalityEngine,
  observer: ObserverModule,
  modules: LOKI_MODULES,
  scenarios: new ScenarioRegistry(LOKI_SCENARIOS.map(scenario => ({
    ...scenario,
    role: scenario.role || 'user',
    intent: scenario.intent || scenario.id,
    triggerConditions: scenario.utterances,
    followUpActions: scenario.availableActions,
  }))),
  plugins: new LokiModuleRegistry([PlannerEngine, AdminAssistant]),
};

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function buildLokiBrainContext(appState = {}, memory = {}, userMemory = {}) {
  const sourceState = appState?.__lokiContext ? appState.appState ?? {} : appState;
  const contextUser = appState?.__lokiContext ? appState.user ?? sourceState.user : sourceState.user;
  const base = {
    actor: {
      id: contextUser?.id ?? null,
      role: appState.actor?.role ?? contextUser?.role ?? contextUser?.userRole ?? 'user',
      permissions: appState.actor?.permissions ?? contextUser?.adminPermissions ?? [],
    },
    personality: {
      mode: appState.personality?.mode ?? sourceState.lokiPersonalityMode ?? 'friendly',
    },
    user: {
      name: appState.profile?.name || contextUser?.first_name || contextUser?.name || null,
      keys: Number(appState.keys?.balance ?? sourceState.userKeys ?? 0),
      completedTasks: appState.tasks?.completedIds ?? sourceState.completedTasks ?? [],
      favorites: appState.favorites?.ids ?? sourceState.favorites ?? [],
      city: 'Зеленоград',
      currentPanel: appState.currentScreen?.id ?? sourceState.activePanel,
      lastScanDate: appState.keys?.lastScanDate ?? sourceState.lastScanDate ?? null,
    },
    apg: {
      partners: sourceState.partners ?? [],
      experts: sourceState.experts ?? [],
      events: sourceState.events ?? [],
      news: sourceState.news ?? [],
      tasks: sourceState.customTasks ?? [],
      notifications: sourceState.notifications ?? [],
      prizesKnown: false,
    },
    admin: appState.admin ?? sourceState.admin ?? null,
    contextEngine: appState?.__lokiContext ? appState : null,
    knowledge: {
      ...APG_KNOWLEDGE_BASE,
      custom: Array.isArray(sourceState.lokiKnowledge) ? sourceState.lokiKnowledge : [],
    },
    knowledgeEngine: buildLokiKnowledgeProvider(sourceState),
    memory: {
      ...memory,
      activeContext: sourceState.activeContext ?? appState.memory?.activeContext ?? memory?.activeContext ?? memory?.lastContext ?? null,
      lastContext: sourceState.activeContext ?? appState.memory?.lastContext ?? memory?.lastContext ?? null,
    },
    userMemory,
    knowledgeHealth: validateApgKnowledgeBase(APG_KNOWLEDGE_BASE),
  };
  return MemoryEngine.enrich({ context: base, memory, userMemory });
}

function applyActions(result, context, appState) {
  return runLokiActionCenter({ result, context, appState });
}

function applyDecision({ question, result, context }) {
  if (!result) return result;
  return {
    ...result,
    decisionContext: runLokiDecisionEngine({ question, result, context }),
  };
}

function pushDecisionTrace(trace, decisionContext) {
  if (!decisionContext?.decisionId) return;
  trace.push({
    module: 'decisionIntelligence',
    ms: decisionContext.duration ?? 0,
    decision: decisionContext.status || 'completed',
    decisionId: decisionContext.decisionId,
    intent: decisionContext.intent,
    goal: decisionContext.goal,
    confidence: decisionContext.confidence,
    level: decisionContext.level,
    engines: decisionContext.trace?.engines || [],
    alternatives: decisionContext.alternatives?.length || 0,
    reason: decisionContext.reason,
  });
}

function applyEvaluation({ question, result, context, trace }) {
  if (!result) return result;
  const evaluation = runLokiEvaluationEngine({ question, result, context, trace });
  trace.push({
    module: 'evaluationEngine',
    ms: evaluation.evaluationSnapshot.durationMs,
    decision: `${evaluation.evaluationSnapshot.Grade}:${evaluation.evaluationSnapshot.Overall}`,
    hallucination: evaluation.evaluationSnapshot.Hallucination,
  });
  return {
    ...result,
    evaluationContext: evaluation.evaluationContext,
    evaluationMetrics: evaluation.evaluationMetrics,
    evaluationScore: evaluation.evaluationScore,
    evaluationSnapshot: evaluation.evaluationSnapshot,
  };
}

function finishResult({ shaped, question, context, trace, debugPayload = null, debug }) {
  const evaluated = applyEvaluation({ question, result: shaped, context, trace });
  if (!debug) return evaluated;
  return {
    ...evaluated,
    debug: {
      ...debugPayload,
      trace,
    },
  };
}

export async function askLokiCore({ text, appState, memory, userMemory, history = [], debug = false }) {
  const start = nowMs();
  const query = normalizeText(text);
  const trace = [];
  const provider = getActiveLokiAiProvider();
  const contextStart = nowMs();
  const context = buildLokiBrainContext(appState, memory, userMemory);
  trace.push({ module: MemoryEngine.id, ms: Math.round(nowMs() - contextStart), decision: 'context_enriched' });

  if (!query) {
    const actionReady = applyActions({ intent: 'empty.query', text: 'Спроси меня про места, мероприятия, акции, ключи или новости АПГ.', card: null, cards: [] }, context, appState);
    const decisionReady = applyDecision({ question: text, result: actionReady, context });
    pushDecisionTrace(trace, decisionReady.decisionContext);
    const result = PersonalityEngine.shape({
      result: decisionReady,
      context,
    });
    return finishResult({ shaped: result, question: text, context, trace, debugPayload: { provider, totalMs: Math.round(nowMs() - start) }, debug });
  }

  const knowledgeStart = nowMs();
  const knowledgeResult = runLokiKnowledgeEngine({ text, appState, context });
  trace.push({ module: 'knowledgeEngine', ms: Math.round(nowMs() - knowledgeStart), decision: knowledgeResult?.intent ?? 'skipped' });
  if (knowledgeResult?.memoryContext) {
    trace.push({ module: 'memoryEngine', ms: 0, decision: knowledgeResult.memoryContext.empty ? 'empty' : `used:${knowledgeResult.memoryContext.used?.length || 0}` });
  }
  if (knowledgeResult?.conversationContext) {
    trace.push({
      module: 'conversationEngine',
      ms: knowledgeResult.conversationContext.durationMs ?? 0,
      decision: knowledgeResult.conversationContext.resolvedReference ? 'reference_resolved' : knowledgeResult.conversationContext.isContinuation ? 'context_restored' : 'tracked',
      activeTopics: knowledgeResult.conversationContext.snapshot?.activeTopics || [],
      activeEntities: knowledgeResult.conversationContext.snapshot?.activeEntities || [],
      resolvedReference: knowledgeResult.conversationContext.snapshot?.resolvedReference || null,
      conversationSnapshot: knowledgeResult.conversationContext.snapshot || null,
      restoreReason: knowledgeResult.conversationContext.restoreReason || '',
      source: knowledgeResult.conversationContext.source || 'local',
    });
  }
  if (knowledgeResult?.capabilityContext) {
    trace.push({
      module: 'capabilityEngine',
      ms: knowledgeResult.capabilityContext.durationMs ?? 0,
      decision: knowledgeResult.capabilityContext.capability || 'empty',
      confidence: knowledgeResult.capabilityContext.confidence,
      alternatives: knowledgeResult.capabilityContext.alternatives?.length || 0,
      missingParameters: knowledgeResult.capabilityContext.missing || [],
      executionOrder: knowledgeResult.capabilityContext.executionOrder?.map?.(item => item.capability) || [],
    });
  }
  if (knowledgeResult?.executionContext) {
    trace.push({
      module: 'executionBridge',
      ms: knowledgeResult.executionContext.durationMs ?? 0,
      decision: knowledgeResult.executionContext.ready ? 'ready' : knowledgeResult.executionContext.reason || 'not_ready',
      capability: knowledgeResult.executionContext.capability,
      planner: knowledgeResult.executionContext.planner,
      workflow: knowledgeResult.executionContext.workflow,
      navigation: knowledgeResult.executionContext.navigation?.screen || '',
      tools: knowledgeResult.executionContext.tools || [],
      missingParameters: knowledgeResult.executionContext.missing || [],
      executionOrder: knowledgeResult.executionContext.executionOrder?.map?.(item => item.capability) || [],
    });
  }
  if (knowledgeResult?.controlledExecutionContext) {
    trace.push({
      module: 'controlledExecution',
      ms: 0,
      decision: knowledgeResult.controlledExecutionContext.result?.status || 'skipped',
      capability: knowledgeResult.controlledExecutionContext.capability,
      ready: knowledgeResult.controlledExecutionContext.executionReady,
      policy: knowledgeResult.controlledExecutionContext.policy?.policy || '',
      confirmation: knowledgeResult.controlledExecutionContext.confirmation?.status || '',
      dispatcher: knowledgeResult.controlledExecutionContext.dispatcher?.dispatcher || '',
      actionType: knowledgeResult.controlledExecutionContext.dispatcher?.action?.type || '',
      reason: knowledgeResult.controlledExecutionContext.result?.reason || '',
    });
  }
  if (knowledgeResult?.planContext) {
    trace.push({ module: 'planner', ms: knowledgeResult.planContext.durationMs ?? 0, decision: knowledgeResult.planContext.goal || knowledgeResult.planContext.status || 'completed' });
  }
  if (knowledgeResult?.workflowContext) {
    trace.push({
      module: 'workflowEngine',
      ms: knowledgeResult.workflowContext.durationMs ?? 0,
      decision: `${knowledgeResult.workflowContext.workflowId || 'workflow'}:${knowledgeResult.workflowContext.status || 'selected'}`,
      steps: knowledgeResult.workflowContext.steps?.map?.(step => ({ id: step.id, status: step.status })) || [],
      expectedUserActions: knowledgeResult.workflowContext.expectedUserActions || [],
    });
  }
  if (knowledgeResult?.agentContext) {
    trace.push({
      module: 'agentMode',
      ms: knowledgeResult.agentContext.durationMs ?? 0,
      decision: knowledgeResult.agentContext.decision?.type || 'RESPOND',
      mode: knowledgeResult.agentContext.decision?.mode || 'passive',
      sessionId: knowledgeResult.agentContext.session?.sessionId || '',
      workflowId: knowledgeResult.agentContext.session?.currentWorkflow?.workflowId || '',
      waitingForUser: Boolean(knowledgeResult.agentContext.session?.waitingForUser),
      reason: knowledgeResult.agentContext.decision?.reason || '',
      safety: knowledgeResult.agentContext.safety?.checks || [],
      confirmation: knowledgeResult.agentContext.session?.pendingConfirmation || null,
    });
  }
  if (knowledgeResult?.toolContext) {
    trace.push({ module: 'toolLayer', ms: knowledgeResult.toolContext.durationMs ?? 0, decision: knowledgeResult.toolContext.call?.id || knowledgeResult.toolContext.status || 'completed' });
  }
  if (knowledgeResult) {
    const personalizationStart = nowMs();
    const personalized = runPersonalizationEngine({ question: text, result: knowledgeResult, context, appState });
    trace.push({ module: 'personalizationEngine', ms: Math.round(nowMs() - personalizationStart), decision: personalized?.personalizationContext?.enabled ? 'applied' : 'skipped' });
    const actionReady = applyActions(personalized || knowledgeResult, context, appState);
    trace.push({ module: 'actionCenter', ms: 0, decision: actionReady?.actionCenter?.suggested?.length ? 'suggested' : 'empty' });
    const decisionReady = applyDecision({ question: text, result: actionReady, context });
    pushDecisionTrace(trace, decisionReady.decisionContext);
    const shaped = PersonalityEngine.shape({ result: decisionReady, context, selectedModule: { id: 'knowledgeEngine' } });
    return finishResult({ shaped, question: text, context, trace, debugPayload: { provider, selectedModule: 'knowledgeEngine', totalMs: Math.round(nowMs() - start) }, debug });
  }

  const personalOnlyStart = nowMs();
  const personalOnly = runPersonalizationEngine({ question: text, result: null, context, appState });
  trace.push({ module: 'personalizationEngine', ms: Math.round(nowMs() - personalOnlyStart), decision: personalOnly?.intent ?? 'skipped' });
  if (personalOnly) {
    const actionReady = applyActions(personalOnly, context, appState);
    trace.push({ module: 'actionCenter', ms: 0, decision: actionReady?.actionCenter?.suggested?.length ? 'suggested' : 'empty' });
    const decisionReady = applyDecision({ question: text, result: actionReady, context });
    pushDecisionTrace(trace, decisionReady.decisionContext);
    const shaped = PersonalityEngine.shape({ result: decisionReady, context, selectedModule: { id: 'personalizationEngine' } });
    return finishResult({ shaped, question: text, context, trace, debugPayload: { provider, selectedModule: 'personalizationEngine', totalMs: Math.round(nowMs() - start) }, debug });
  }

  const proactiveStart = nowMs();
  const proactiveAnswer = runProactiveAnswer({ question: text, memory });
  trace.push({ module: 'proactiveEngine', ms: Math.round(nowMs() - proactiveStart), decision: proactiveAnswer?.intent ?? 'skipped' });
  if (proactiveAnswer) {
    const actionReady = applyActions(proactiveAnswer, context, appState);
    trace.push({ module: 'actionCenter', ms: 0, decision: actionReady?.actionCenter?.suggested?.length ? 'suggested' : 'empty' });
    const decisionReady = applyDecision({ question: text, result: actionReady, context });
    pushDecisionTrace(trace, decisionReady.decisionContext);
    const shaped = PersonalityEngine.shape({ result: decisionReady, context, selectedModule: { id: 'proactiveEngine' } });
    return finishResult({ shaped, question: text, context, trace, debugPayload: { provider, selectedModule: 'proactiveEngine', totalMs: Math.round(nowMs() - start) }, debug });
  }

  const v2Start = nowMs();
  const v2Resolution = await LOKI_CORE_REGISTRY.plugins.resolve({ query, text, context, history });
  trace.push({ module: v2Resolution.module?.id ?? 'v2Plugins', ms: Math.round(nowMs() - v2Start), decision: v2Resolution.result?.intent ?? 'skipped' });
  if (v2Resolution.result) {
    const reasoned = Reasoner.combine({ query, context });
    const actionReady = applyActions({ ...v2Resolution.result, evidence: v2Resolution.result.evidence ?? reasoned.evidence }, context, appState);
    trace.push({ module: 'actionCenter', ms: 0, decision: actionReady?.actionCenter?.suggested?.length ? 'suggested' : 'empty' });
    const decisionReady = applyDecision({ question: text, result: actionReady, context });
    pushDecisionTrace(trace, decisionReady.decisionContext);
    const shaped = PersonalityEngine.shape({
      result: decisionReady,
      context,
      selectedModule: v2Resolution.module,
    });
    return finishResult({ shaped, question: text, context, trace, debugPayload: { provider, selectedModule: v2Resolution.module.id, totalMs: Math.round(nowMs() - start) }, debug });
  }

  const intelligenceStart = nowMs();
  let intelligenceResult = null;
  if (includesAny(query, ['почему ты', 'почему предлож', 'зачем предлож', 'объясни рекомендац'])) {
    intelligenceResult = explainLastRecommendation(memory);
  } else if (includesAny(query, ['объясни экран', 'объясни этот экран', 'что на этом экране', 'как пользоваться этим экраном', 'что здесь делать'])) {
    const panel = context.user?.currentPanel ?? appState?.currentScreen?.id ?? appState?.activePanel;
    intelligenceResult = {
      intent: 'learning.explain_screen',
      text: getLearningScreenExplanation(panel),
      cards: [],
    };
  } else if (includesAny(query, ['что мне сегодня посмотреть', 'маршрут', 'план на сегодня', 'куда сходить сегодня'])) {
    intelligenceResult = buildPersonalRoute({ appState, learning: memory?.learning ?? {}, now: new Date() });
  } else if (includesAny(query, ['удиви меня', 'что-нибудь необыч', 'что нибудь необыч', 'случайно', 'сюрприз'])) {
    intelligenceResult = buildSurprisePick({ appState, learning: memory?.learning ?? {}, history });
  }
  trace.push({ module: 'lokiIntelligence', ms: Math.round(nowMs() - intelligenceStart), decision: intelligenceResult?.intent ?? 'skipped' });
  if (intelligenceResult) {
    const actionReady = applyActions(intelligenceResult, context, appState);
    trace.push({ module: 'actionCenter', ms: 0, decision: actionReady?.actionCenter?.suggested?.length ? 'suggested' : 'empty' });
    const decisionReady = applyDecision({ question: text, result: actionReady, context });
    pushDecisionTrace(trace, decisionReady.decisionContext);
    const shaped = PersonalityEngine.shape({ result: decisionReady, context, selectedModule: { id: 'lokiIntelligence' } });
    return finishResult({ shaped, question: text, context, trace, debugPayload: { provider, selectedModule: 'lokiIntelligence', totalMs: Math.round(nowMs() - start) }, debug });
  }

  const brainStart = nowMs();
  const brainResult = runBrainLayer({ query, context, history, debug });
  trace.push({ module: 'brainLayer', ms: Math.round(nowMs() - brainStart), decision: brainResult?.intent ?? 'skipped' });
  if (brainResult) {
    const actionReady = applyActions(brainResult, context, appState);
    trace.push({ module: 'actionCenter', ms: 0, decision: actionReady?.actionCenter?.suggested?.length ? 'suggested' : 'empty' });
    const decisionReady = applyDecision({ question: text, result: actionReady, context });
    pushDecisionTrace(trace, decisionReady.decisionContext);
    const shaped = PersonalityEngine.shape({ result: decisionReady, context, selectedModule: { id: 'brainLayer' } });
    return finishResult({ shaped, question: text, context, trace, debugPayload: { provider, selectedModule: 'brainLayer', totalMs: Math.round(nowMs() - start), brain: brainResult.debugBrain ?? brainResult.brain }, debug });
  }

  let selected = null;
  let rawResult = null;
  for (const module of LOKI_MODULES) {
    const moduleStart = nowMs();
    const accepted = module.canHandle({ query, context, text });
    trace.push({ module: module.id, ms: Math.round(nowMs() - moduleStart), decision: accepted ? 'accepted' : 'skipped' });
    if (!accepted) continue;
    selected = module;
    const handleStart = nowMs();
    rawResult = await module.handle({ query, context, text });
    trace.push({ module: `${module.id}.handle`, ms: Math.round(nowMs() - handleStart), decision: rawResult?.intent ?? 'handled' });
    if (!rawResult) {
      selected = null;
      continue;
    }
    break;
  }

  const personalityStart = nowMs();
  const actionReady = applyActions(rawResult ?? emptyResult(), context, appState);
  trace.push({ module: 'actionCenter', ms: 0, decision: actionReady?.actionCenter?.suggested?.length ? 'suggested' : 'empty' });
  const decisionReady = applyDecision({ question: text, result: actionReady, context });
  pushDecisionTrace(trace, decisionReady.decisionContext);
  const result = PersonalityEngine.shape({ result: decisionReady, context, selectedModule: selected });
  trace.push({ module: PersonalityEngine.id, ms: Math.round(nowMs() - personalityStart), decision: result.tone });
  return finishResult({ shaped: result, question: text, context, trace, debugPayload: { provider, selectedModule: selected?.id ?? null, totalMs: Math.round(nowMs() - start) }, debug });
}
