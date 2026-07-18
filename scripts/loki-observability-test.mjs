import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildConversationAnalytics } from '../src/loki/analytics/ConversationAnalytics.js';
import { buildFallbackAnalytics } from '../src/loki/analytics/FallbackAnalytics.js';
import { buildIntentAnalytics } from '../src/loki/analytics/IntentAnalytics.js';
import { buildJourneyAnalytics } from '../src/loki/analytics/JourneyAnalytics.js';
import { buildRecommendationAnalytics } from '../src/loki/analytics/RecommendationAnalytics.js';
import { buildProactiveAnalytics } from '../src/loki/analytics/ProactiveAnalytics.js';
import { calculateLokiQualityScore } from '../src/loki/analytics/QualityScore.js';
import { generateLokiQualityInsights } from '../src/loki/analytics/InsightGenerator.js';
import { buildLokiQualityCenter, exportLokiQualityCsv } from '../src/loki/analytics/index.js';

const intents = ['search.partners', 'info.booking', 'journey.book_service', 'reasoning.search', 'proactive.explain', 'knowledge.unknown'];
const actions = ['', 'OPEN_PARTNER', 'START_BOOKING', 'OPEN_EVENT', 'OPEN_PRIZE'];
const panels = ['home', 'partners', 'events', 'profile', 'workspace'];

function row(i, patch = {}) {
  return {
    id: `row-${i}`,
    query: i % 6 === 0 ? 'Где стоматолог?' : i % 5 === 0 ? 'Как записаться?' : `Вопрос ${i}`,
    intent: intents[i % intents.length],
    resultCount: i % 4,
    actionType: actions[i % actions.length],
    panel: panels[i % panels.length],
    ms: 80 + i,
    success: i % 13 !== 0,
    confidence: 45 + (i % 55),
    sessionId: `session-${i % 20}`,
    createdAt: new Date(Date.UTC(2026, 6, 18, 10, i % 50, 0)).toISOString(),
    journeyStep: i % 7 === 0 ? 'choose_time' : '',
    journeyStatus: i % 41 === 0 ? 'completed' : 'active',
    source: i % 9 === 0 ? 'loki_proactive_engine' : 'loki_experience',
    ...patch,
  };
}

function opportunityEvent(i, type) {
  return {
    id: `op-${i}-${type}`,
    type,
    opportunityType: ['BOOKING_SOON', 'REWARD_AVAILABLE', 'EVENT_SOON', 'JOURNEY_RESUME'][i % 4],
    status: type,
    ts: Date.now() - i * 1000,
  };
}

let scenarios = 0;
function scenario(name, fn) {
  fn();
  scenarios += 1;
  assert.ok(name);
}

const rows = Array.from({ length: 180 }, (_, i) => row(i));
const opportunityEvents = Array.from({ length: 80 }, (_, i) => opportunityEvent(i, [
  'LOKI_OPPORTUNITY_FOUND',
  'LOKI_OPPORTUNITY_SHOWN',
  'LOKI_OPPORTUNITY_ACCEPTED',
  'LOKI_OPPORTUNITY_DISMISSED',
  'LOKI_OPPORTUNITY_EXPIRED',
][i % 5]));

scenario('conversation analytics calculates KPI', () => {
  const analytics = buildConversationAnalytics(rows);
  assert.equal(analytics.total, rows.length);
  assert.ok(analytics.successRate > 80);
  assert.ok(analytics.averageMs > 0);
  assert.ok(analytics.averageConversationMessages > 1);
});

scenario('intent analytics returns top questions and distribution', () => {
  const analytics = buildIntentAnalytics(rows);
  assert.ok(analytics.topQuestions.length > 0);
  assert.ok(analytics.intents.length > 0);
  assert.ok(analytics.accuracy > 0);
});

scenario('fallback analytics detects reasons', () => {
  const analytics = buildFallbackAnalytics([row(1, { success: false }), row(2, { intent: 'knowledge.unknown' }), row(3, { confidence: 30 })]);
  assert.equal(analytics.total, 3);
  assert.ok(analytics.reasons.some(item => item.label === 'Ошибка ответа'));
});

scenario('journey analytics builds heat map', () => {
  const analytics = buildJourneyAnalytics(rows);
  assert.ok(analytics.heatMap.length >= 6);
  assert.ok(analytics.total > 0);
});

scenario('recommendation analytics calculates accepted actions', () => {
  const analytics = buildRecommendationAnalytics(rows);
  assert.ok(analytics.total > 0);
  assert.ok(analytics.byAction.length > 0);
});

scenario('proactive analytics aggregates opportunity lifecycle', () => {
  const analytics = buildProactiveAnalytics(rows, opportunityEvents);
  assert.ok(analytics.total >= opportunityEvents.length);
  assert.ok(analytics.byOpportunity.length > 0);
});

scenario('quality score combines all metrics', () => {
  const center = buildLokiQualityCenter(rows, opportunityEvents);
  assert.ok(center.quality.qualityScore >= 0);
  assert.ok(center.quality.qualityScore <= 100);
});

scenario('insight generator uses real analytics', () => {
  const center = buildLokiQualityCenter(rows, opportunityEvents);
  assert.ok(generateLokiQualityInsights(center).length > 0);
});

scenario('csv exports are generated', () => {
  const center = buildLokiQualityCenter(rows, opportunityEvents);
  ['intents', 'quality', 'proactive', 'journeys', 'raw'].forEach(kind => {
    const csv = exportLokiQualityCsv(kind, center);
    assert.ok(csv.includes('\n'));
  });
});

scenario('empty state is explicit', () => {
  const center = buildLokiQualityCenter([]);
  assert.equal(center.conversations.total, 0);
  assert.equal(center.insights[0].includes('недостаточно'), true);
});

for (let i = 0; i < 490; i += 1) {
  scenario(`observability matrix ${i}`, () => {
    const sample = Array.from({ length: 12 + (i % 20) }, (_, index) => row(i + index, {
      intent: intents[(i + index) % intents.length],
      success: (i + index) % 17 !== 0,
      confidence: i % 8 === 0 ? 35 : 65 + ((i + index) % 30),
      actionType: actions[(i + index) % actions.length],
      sessionId: `matrix-${i % 11}`,
      journeyStep: i % 4 === 0 ? 'choose_service' : '',
    }));
    const center = buildLokiQualityCenter(sample, opportunityEvents.slice(0, i % opportunityEvents.length));
    assert.ok(center.quality.qualityScore >= 0 && center.quality.qualityScore <= 100);
    assert.ok(center.intents.intents.length > 0);
    assert.ok(center.fallback.rate >= 0);
    assert.ok(center.recommendations.acceptedRate >= 0);
    assert.ok(center.journey.heatMap.every(item => typeof item.step === 'string'));
    assert.ok(exportLokiQualityCsv('quality', center).includes('metric,value'));
  });
}

const analyticsFiles = [
  'src/loki/analytics/ConversationAnalytics.js',
  'src/loki/analytics/IntentAnalytics.js',
  'src/loki/analytics/FallbackAnalytics.js',
  'src/loki/analytics/JourneyAnalytics.js',
  'src/loki/analytics/RecommendationAnalytics.js',
  'src/loki/analytics/ProactiveAnalytics.js',
  'src/loki/analytics/QualityScore.js',
  'src/loki/analytics/InsightGenerator.js',
  'src/loki/analytics/index.js',
];

for (const file of analyticsFiles) {
  const source = readFileSync(file, 'utf8');
  assert.equal(/firebase|firestore|getDocs|onSnapshot|addDoc|updateDoc|fetch\s*\(/.test(source), false, `${file} must stay read-only and local`);
}

assert.equal(scenarios, 500);
console.log(`Loki Observability & Quality Center v1: ${scenarios} scenarios passed`);
