import { buildConversationAnalytics } from './ConversationAnalytics.js';
import { buildFallbackAnalytics } from './FallbackAnalytics.js';
import { buildIntentAnalytics } from './IntentAnalytics.js';
import { buildJourneyAnalytics } from './JourneyAnalytics.js';
import { buildRecommendationAnalytics } from './RecommendationAnalytics.js';
import { buildProactiveAnalytics } from './ProactiveAnalytics.js';
import { calculateLokiQualityScore } from './QualityScore.js';
import { generateLokiQualityInsights } from './InsightGenerator.js';
import { buildKnowledgeEvolutionAnalytics, buildStructuredKnowledgeIndex } from '../core/evolution/index.js';

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function rowsToCsv(headers, rows) {
  return [
    headers.map(csvEscape).join(','),
    ...rows.map(row => headers.map(header => csvEscape(row[header])).join(',')),
  ].join('\n');
}

export function buildLokiQualityCenter(rows = [], opportunityEvents = []) {
  const conversations = buildConversationAnalytics(rows);
  const intents = buildIntentAnalytics(conversations.rows);
  const fallback = buildFallbackAnalytics(conversations.rows);
  const journey = buildJourneyAnalytics(conversations.rows);
  const recommendations = buildRecommendationAnalytics(conversations.rows);
  const proactive = buildProactiveAnalytics(conversations.rows, opportunityEvents);
  const quality = calculateLokiQualityScore({ conversations, intents, fallback, journey, recommendations, proactive });
  const insights = generateLokiQualityInsights({ conversations, intents, fallback, journey, recommendations, proactive, quality });
  return { conversations, intents, fallback, journey, recommendations, proactive, quality, insights };
}

export function buildLokiEvolutionCenter(rows = [], appState = {}) {
  const experiences = rows.map(row => ({
    query: row.query,
    intent: row.intent,
    source: row.source,
    success: row.success !== false,
    fallback: Boolean(row.fallback || row.fallbackUsed),
    responseTimeMs: Number(row.ms || row.responseTimeMs || 0),
    answer: row.answer || '',
    topic: String(row.query || '').toLowerCase().replace(/ё/g, 'е'),
    createdAt: row.createdAt || row.timestamp || '',
  }));
  const feedbackEvents = rows
    .filter(row => row.feedbackScore != null && Number(row.feedbackScore) !== 0)
    .map(row => ({ score: Number(row.feedbackScore), type: Number(row.feedbackScore) > 0 ? 'positive' : 'negative' }));
  const unknownTopics = experiences.filter(row => row.fallback).map(row => ({ topic: row.topic, count: 1, category: row.intent, lastDate: row.createdAt }));
  const structuredIndex = buildStructuredKnowledgeIndex(appState);
  const analytics = buildKnowledgeEvolutionAnalytics({ experiences, feedbackEvents, unknownTopics, structuredIndex, analyticsRows: rows });
  return {
    ...analytics,
    growth: structuredIndex.counts,
    learningQueue: analytics.knowledgeCandidates,
    progress: [
      { label: 'Personal Memory', value: analytics.metrics.memoryUsage },
      { label: 'Knowledge Index', value: analytics.metrics.knowledgeHitRate },
      { label: 'Feedback Loop', value: Math.max(0, analytics.metrics.feedbackScore) },
      { label: 'Fallback Reduction', value: analytics.metrics.fallbackReduction },
    ],
    timeline: rows.slice(0, 20).map(row => ({
      title: row.intent || 'loki',
      text: row.query || row.source || '',
      createdAt: row.createdAt || row.timestamp || '',
    })),
  };
}

export function exportLokiQualityCsv(kind, center) {
  if (kind === 'intents') {
    return rowsToCsv(['label', 'count', 'percent'], center.intents.intents.map(row => ({ label: row.label, count: row.count, percent: row.percent })));
  }
  if (kind === 'quality') {
    return rowsToCsv(['metric', 'value'], Object.entries(center.quality).map(([metric, value]) => ({ metric, value })));
  }
  if (kind === 'proactive') {
    return rowsToCsv(['label', 'shown', 'accepted', 'dismissed', 'expired', 'acceptedRate'], center.proactive.byOpportunity);
  }
  if (kind === 'journeys') {
    return rowsToCsv(['step', 'count', 'percent'], center.journey.heatMap);
  }
  return rowsToCsv(['query', 'intent', 'success', 'source', 'actionType', 'panel', 'ms'], center.conversations.rows);
}
