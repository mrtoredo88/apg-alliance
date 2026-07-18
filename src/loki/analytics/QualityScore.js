import { percent } from './ConversationAnalytics.js';

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateLokiQualityScore({ conversations, intents, fallback, journey, recommendations, proactive } = {}) {
  const confidenceRows = conversations?.rows?.filter(row => row.confidence != null) || [];
  const confidence = confidenceRows.length
    ? Math.round(confidenceRows.reduce((sum, row) => sum + row.confidence, 0) / confidenceRows.length)
    : 78;
  const fallbackScore = 100 - (fallback?.rate || 0);
  const intentScore = intents?.accuracy || 0;
  const journeyScore = journey?.total ? journey.completionRate : 72;
  const recommendationScore = recommendations?.total ? recommendations.acceptedRate : 70;
  const proactiveScore = proactive?.shown ? proactive.acceptedRate : 70;
  const qualityScore = clamp(
    fallbackScore * 0.28
    + intentScore * 0.22
    + confidence * 0.18
    + journeyScore * 0.14
    + recommendationScore * 0.10
    + proactiveScore * 0.08
  );
  return {
    qualityScore,
    intentAccuracy: intentScore,
    fallbackRate: fallback?.rate || 0,
    journeyCompletion: journey?.completionRate || 0,
    proactiveAccepted: proactive?.acceptedRate || 0,
    averageConfidence: confidenceRows.length ? confidence : null,
    answerSuccess: conversations?.total ? percent(conversations.answered, conversations.total) : 0,
  };
}
