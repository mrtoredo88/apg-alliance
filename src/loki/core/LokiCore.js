import { Navigator } from './modules/Navigator.js';
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

const LOKI_MODULES = [
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
  core: 'Loki Core',
  memory: MemoryEngine,
  personality: PersonalityEngine,
  observer: ObserverModule,
  modules: LOKI_MODULES,
};

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function buildLokiBrainContext(appState = {}, memory = {}, userMemory = {}) {
  const base = {
    user: {
      name: appState.user?.first_name || appState.user?.name || null,
      keys: Number(appState.userKeys ?? 0),
      completedTasks: appState.completedTasks ?? [],
      favorites: appState.favorites ?? [],
      city: 'Зеленоград',
      currentPanel: appState.activePanel,
      lastScanDate: appState.lastScanDate ?? null,
    },
    apg: {
      partners: appState.partners ?? [],
      experts: appState.experts ?? [],
      events: appState.events ?? [],
      news: appState.news ?? [],
      tasks: appState.customTasks ?? [],
      notifications: appState.notifications ?? [],
      prizesKnown: false,
    },
    knowledge: APG_KNOWLEDGE_BASE,
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

  const intelligenceStart = nowMs();
  let intelligenceResult = null;
  if (includesAny(query, ['почему ты', 'почему предлож', 'зачем предлож', 'объясни рекомендац'])) {
    intelligenceResult = explainLastRecommendation(memory);
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
    break;
  }

  const personalityStart = nowMs();
  const result = PersonalityEngine.shape({ result: rawResult ?? emptyResult(), context, selectedModule: selected });
  trace.push({ module: PersonalityEngine.id, ms: Math.round(nowMs() - personalityStart), decision: result.tone });
  return debug ? { ...result, debug: { provider, selectedModule: selected?.id ?? null, totalMs: Math.round(nowMs() - start), trace } } : result;
}
