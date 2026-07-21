import { scoreFeedback } from './FeedbackEngine.js';
import { summarizeExperience } from './ExperienceEngine.js';
import { list, normalizeTopic } from './ConversationLearning.js';

function percent(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}

function topBy(rows, selector, limit = 10) {
  const map = new Map();
  for (const row of list(rows)) {
    const key = selector(row);
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, limit);
}

export function buildKnowledgeEvolutionAnalytics({ experiences = [], feedbackEvents = [], candidates = [], unknownTopics = [], structuredIndex = null, analyticsRows = [] } = {}) {
  const rows = list(experiences).length ? list(experiences) : list(analyticsRows).map(row => ({
    query: row.query,
    intent: row.intent,
    success: row.success !== false,
    fallback: Boolean(row.fallback || row.fallbackUsed),
    topic: normalizeTopic(row.query),
    source: row.source,
  }));
  const summary = summarizeExperience(rows);
  const feedback = scoreFeedback(feedbackEvents);
  const hits = rows.filter(row => row.success && !row.fallback).length;
  const llmRows = rows.filter(row => String(row.source || '').includes('llm'));
  return {
    metrics: {
      knowledgeHitRate: percent(hits, rows.length),
      learningRate: percent(list(candidates).length, Math.max(1, rows.length)),
      feedbackScore: feedback.score,
      fallbackRate: percent(summary.fallback, rows.length),
      fallbackReduction: Math.max(0, 100 - percent(summary.fallback, rows.length)),
      memoryUsage: percent(rows.filter(row => String(row.source || '').includes('memory')).length, rows.length),
      knowledgeGrowth: structuredIndex?.counts?.entities || 0,
      llmUsage: percent(llmRows.length, rows.length),
      responseTimeMs: summary.averageResponseTimeMs,
      unknownTopicCount: list(unknownTopics).length,
    },
    topUserQuestions: topBy(rows, row => normalizeTopic(row.query), 20),
    unknownTopics: list(unknownTopics),
    knowledgeCandidates: list(candidates),
    topAnswers: summary.topAnswers,
    worstAnswers: summary.worstAnswers,
    feedback,
  };
}
