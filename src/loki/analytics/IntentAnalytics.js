import { countBy, normalizeLokiAnalyticsRows, percent } from './ConversationAnalytics.js';

export function buildIntentAnalytics(rows = []) {
  const normalized = normalizeLokiAnalyticsRows(rows);
  const total = normalized.length;
  const topQuestions = countBy(normalized.filter(row => row.query), row => row.query, 50);
  const intents = countBy(normalized, row => row.intent || 'unknown', 50)
    .map(item => ({ ...item, percent: percent(item.count, total) }));
  const recognized = normalized.filter(row => row.intent && row.intent !== 'unknown' && !row.intent.includes('unknown')).length;
  return {
    total,
    topQuestions,
    intents,
    recognized,
    accuracy: percent(recognized, total),
  };
}
