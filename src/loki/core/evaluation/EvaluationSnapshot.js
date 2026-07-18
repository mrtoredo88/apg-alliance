export function buildEvaluationSnapshot({ context = {}, metrics = {}, score = {} } = {}) {
  return {
    version: 'v1',
    evaluationId: context.evaluationId || '',
    Overall: score.overallScore ?? 0,
    Grade: score.grade || 'D',
    Context: metrics.contextCoverage?.coverage ?? 0,
    Decision: metrics.decisionQuality?.score ?? 0,
    Tools: metrics.toolQuality?.score ?? 0,
    Conversation: metrics.conversationQuality?.score ?? 0,
    Personalization: metrics.personalization?.personalizationScore ?? 0,
    Confidence: metrics.confidence ?? 0,
    Hallucination: metrics.hallucinationRisk?.risk || 'LOW',
    Action: metrics.actionQuality?.score ?? 0,
    Answer: metrics.answerQuality?.score ?? 0,
    missingContext: metrics.contextCoverage?.missing || [],
    toolQuality: metrics.toolQuality || null,
    decisionQuality: metrics.decisionQuality || null,
    conversationQuality: metrics.conversationQuality || null,
    timestamp: context.timestamp || new Date().toISOString(),
  };
}

export class EvaluationSnapshot {
  constructor(input = {}) {
    Object.assign(this, buildEvaluationSnapshot(input));
  }
}
