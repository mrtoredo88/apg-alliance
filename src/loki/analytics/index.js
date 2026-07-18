import { buildConversationAnalytics } from './ConversationAnalytics.js';
import { buildFallbackAnalytics } from './FallbackAnalytics.js';
import { buildIntentAnalytics } from './IntentAnalytics.js';
import { buildJourneyAnalytics } from './JourneyAnalytics.js';
import { buildRecommendationAnalytics } from './RecommendationAnalytics.js';
import { buildProactiveAnalytics } from './ProactiveAnalytics.js';
import { calculateLokiQualityScore } from './QualityScore.js';
import { generateLokiQualityInsights } from './InsightGenerator.js';

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
