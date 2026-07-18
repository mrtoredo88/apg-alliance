function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
}

export function gradeEvaluation(score) {
  const value = clamp(score);
  if (value >= 95) return 'A+';
  if (value >= 86) return 'A';
  if (value >= 74) return 'B';
  if (value >= 60) return 'C';
  return 'D';
}

export function scoreEvaluation(metrics = {}) {
  const answer = metrics.answerQuality?.score ?? 0;
  const decision = metrics.decisionQuality?.score ?? 0;
  const context = metrics.contextCoverage?.coverage ?? 0;
  const tool = metrics.toolQuality?.score ?? 0;
  const conversation = metrics.conversationQuality?.score ?? 0;
  const personalization = metrics.personalization?.personalizationScore ?? 0;
  const confidence = metrics.confidence ?? 0;
  const overallScore = clamp(
    answer * 0.25
    + decision * 0.20
    + context * 0.15
    + tool * 0.10
    + conversation * 0.10
    + personalization * 0.10
    + confidence * 0.10
  );
  return {
    overallScore,
    grade: gradeEvaluation(overallScore),
    weights: {
      answer: 25,
      decision: 20,
      context: 15,
      tool: 10,
      conversation: 10,
      personalization: 10,
      confidence: 10,
    },
  };
}

export class EvaluationScorer {
  score(metrics = {}) {
    return scoreEvaluation(metrics);
  }
}
