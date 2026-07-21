import { runLearningEngine } from './LearningEngine.js';
import { buildStructuredKnowledgeIndex, buildKnowledgeUpdatePolicy } from './KnowledgeUpdater.js';
import { buildKnowledgeEvolutionAnalytics } from './KnowledgeAnalytics.js';
import { buildKnowledgeSchedulerState } from './KnowledgeScheduler.js';

export function runLokiKnowledgeEvolution(input = {}) {
  const learning = runLearningEngine(input);
  const structuredIndex = buildStructuredKnowledgeIndex(input.appState || {});
  const analytics = buildKnowledgeEvolutionAnalytics({
    experiences: learning.learningPatch.experienceMemory,
    feedbackEvents: learning.learningPatch.feedbackEvents,
    candidates: learning.knowledgeCandidates,
    unknownTopics: learning.unknownTopics,
    structuredIndex,
  });
  const scheduler = buildKnowledgeSchedulerState({ candidates: learning.knowledgeCandidates, unknownTopics: learning.unknownTopics, feedback: analytics.feedback });
  const policy = buildKnowledgeUpdatePolicy();
  const evolutionContext = {
    version: 'v2',
    mode: 'safe_two_contour',
    personalMemory: 'local_user_operational_memory',
    globalKnowledge: 'structured_index_and_owner_review_queue',
    officialKnowledgeMutationAllowed: false,
    learningOrder: ['memory', 'knowledge_index', 'experience', 'reasoning', 'llm'],
    policy,
    learning,
    structuredIndex,
    analytics,
    scheduler,
  };
  return {
    evolutionContext,
    evolutionSnapshot: {
      Version: 'v2',
      Mode: 'safe_two_contour',
      'Knowledge Hit Rate': analytics.metrics.knowledgeHitRate,
      'Fallback Rate': analytics.metrics.fallbackRate,
      'Learning Queue': learning.knowledgeCandidates.length,
      'Unknown Topics': learning.unknownTopics.length,
      'Memory Types': learning.memoryTypes.length,
      'Official Mutations': policy.mutations.length,
      'Structured Entities': structuredIndex.counts.entities,
    },
    learningPatch: learning.learningPatch,
    personalMemoryPatch: learning.personalMemoryPatch,
  };
}

export function buildEvolutionSnapshot(input = {}) {
  return runLokiKnowledgeEvolution(input).evolutionSnapshot;
}

export function isKnowledgeEvolutionExplainQuery(value = '') {
  const query = String(value || '').toLowerCase().replace(/ё/g, 'е');
  return query.includes('почему ты так ответил') || query.includes('почему такой ответ') || query.includes('объясни ответ') || query.includes('evolution');
}

export function explainLastKnowledgeEvolution(memory = {}) {
  const context = memory.lastEvolutionContext || memory.evolutionContext || {};
  const snapshot = memory.lastEvolutionSnapshot || {};
  if (!context.version && !snapshot.Version) {
    return {
      intent: 'evolution.explain.empty',
      text: 'Пока нет последнего ответа, который можно объяснить. Сначала задайте вопрос Локи.',
      card: null,
      cards: [],
    };
  }
  const metrics = context.analytics?.metrics || {};
  const lines = [
    `Я ответил через контур ${context.mode || snapshot.Mode || 'safe_two_contour'}.`,
    `Память: ${context.learning?.personalMemoryBlocked ? 'не использовал чувствительные данные' : 'учёл локальные предпочтения пользователя'}.`,
    `Индекс знаний: ${metrics.knowledgeHitRate ?? snapshot['Knowledge Hit Rate'] ?? 0}% hit rate, ${context.structuredIndex?.counts?.entities ?? snapshot['Structured Entities'] ?? 0} структурных сущностей.`,
    `Опыт: ${context.learning?.experienceSummary?.total ?? 0} недавних диалогов, ${context.learning?.unknownTopics?.length ?? snapshot['Unknown Topics'] ?? 0} неизвестных тем.`,
    `Кандидаты: ${context.learning?.knowledgeCandidates?.length ?? snapshot['Learning Queue'] ?? 0} предложений владельцу, без автоправки официальной базы.`,
    `Качество: confidence ${context.learning?.quality?.confidence ?? 0}%, fallback ${context.learning?.quality?.fallback ? 'да' : 'нет'}.`,
  ];
  return {
    intent: 'evolution.explain',
    preserveText: true,
    text: lines.join('\n'),
    card: null,
    cards: [],
    evolutionContext: context,
    evolutionSnapshot: snapshot,
  };
}
