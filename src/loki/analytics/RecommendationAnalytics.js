import { countBy, normalizeLokiAnalyticsRows, percent } from './ConversationAnalytics.js';

export function buildRecommendationAnalytics(rows = []) {
  const normalized = normalizeLokiAnalyticsRows(rows);
  const recommendations = normalized.filter(row => row.actionType || row.resultCount > 0 || row.intent.startsWith('reasoning.'));
  const accepted = recommendations.filter(row => row.actionType).length;
  const byAction = countBy(recommendations.filter(row => row.actionType), row => row.actionType, 30)
    .map(item => ({ ...item, acceptedRate: percent(item.count, recommendations.length) }));
  return {
    total: recommendations.length,
    accepted,
    acceptedRate: percent(accepted, recommendations.length),
    byAction,
  };
}
