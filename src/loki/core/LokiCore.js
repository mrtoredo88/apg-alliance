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

export async function askLokiCore({ text, appState, memory, userMemory, history = [], debug = false }) {
  const start = nowMs();
  const query = normalizeText(text);
  const trace = [];
  const provider = getActiveLokiAiProvider();
  const contextStart = nowMs();
  const context = buildLokiBrainContext(appState, memory, userMemory);
  trace.push({ module: MemoryEngine.id, ms: Math.round(nowMs() - contextStart), decision: 'context_enriched' });

  if (!query) {
    const result = PersonalityEngine.shape({
      result: { text: 'Спроси меня про места, мероприятия, акции, ключи или новости АПГ.', card: null, cards: [] },
      context,
    });
    return debug ? { ...result, debug: { provider, totalMs: Math.round(nowMs() - start), trace } } : result;
  }

  const knowledgeStart = nowMs();
  const knowledgeResult = runLokiKnowledgeEngine({ text, appState, context });
  trace.push({ module: 'knowledgeEngine', ms: Math.round(nowMs() - knowledgeStart), decision: knowledgeResult?.intent ?? 'skipped' });
  if (knowledgeResult) {
    const personalizationStart = nowMs();
    const personalized = runPersonalizationEngine({ question: text, result: knowledgeResult, context, appState });
    trace.push({ module: 'personalizationEngine', ms: Math.round(nowMs() - personalizationStart), decision: personalized?.personalizationContext?.enabled ? 'applied' : 'skipped' });
    const shaped = PersonalityEngine.shape({ result: personalized || knowledgeResult, context, selectedModule: { id: 'knowledgeEngine' } });
    return debug ? { ...shaped, debug: { provider, selectedModule: 'knowledgeEngine', totalMs: Math.round(nowMs() - start), trace } } : shaped;
  }

  const personalOnlyStart = nowMs();
  const personalOnly = runPersonalizationEngine({ question: text, result: null, context, appState });
  trace.push({ module: 'personalizationEngine', ms: Math.round(nowMs() - personalOnlyStart), decision: personalOnly?.intent ?? 'skipped' });
  if (personalOnly) {
    const shaped = PersonalityEngine.shape({ result: personalOnly, context, selectedModule: { id: 'personalizationEngine' } });
    return debug ? { ...shaped, debug: { provider, selectedModule: 'personalizationEngine', totalMs: Math.round(nowMs() - start), trace } } : shaped;
  }

  const v2Start = nowMs();
  const v2Resolution = await LOKI_CORE_REGISTRY.plugins.resolve({ query, text, context, history });
  trace.push({ module: v2Resolution.module?.id ?? 'v2Plugins', ms: Math.round(nowMs() - v2Start), decision: v2Resolution.result?.intent ?? 'skipped' });
  if (v2Resolution.result) {
    const reasoned = Reasoner.combine({ query, context });
    const shaped = PersonalityEngine.shape({
      result: { ...v2Resolution.result, evidence: v2Resolution.result.evidence ?? reasoned.evidence },
      context,
      selectedModule: v2Resolution.module,
    });
    return debug ? { ...shaped, debug: { provider, selectedModule: v2Resolution.module.id, totalMs: Math.round(nowMs() - start), trace } } : shaped;
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
    const shaped = PersonalityEngine.shape({ result: intelligenceResult, context, selectedModule: { id: 'lokiIntelligence' } });
    return debug ? { ...shaped, debug: { provider, selectedModule: 'lokiIntelligence', totalMs: Math.round(nowMs() - start), trace } } : shaped;
  }

  const brainStart = nowMs();
  const brainResult = runBrainLayer({ query, context, history, debug });
  trace.push({ module: 'brainLayer', ms: Math.round(nowMs() - brainStart), decision: brainResult?.intent ?? 'skipped' });
  if (brainResult) {
    const shaped = PersonalityEngine.shape({ result: brainResult, context, selectedModule: { id: 'brainLayer' } });
    return debug ? { ...shaped, debug: { provider, selectedModule: 'brainLayer', totalMs: Math.round(nowMs() - start), trace, brain: brainResult.debugBrain ?? brainResult.brain } } : shaped;
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
  const result = PersonalityEngine.shape({ result: rawResult ?? emptyResult(), context, selectedModule: selected });
  trace.push({ module: PersonalityEngine.id, ms: Math.round(nowMs() - personalityStart), decision: result.tone });
  return debug ? { ...result, debug: { provider, selectedModule: selected?.id ?? null, totalMs: Math.round(nowMs() - start), trace } } : result;
}
