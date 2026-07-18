const MAX_EVALUATION_HISTORY = 100;

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function addEvaluationHistoryItem(history = [], snapshot = {}) {
  if (!snapshot?.evaluationId && !snapshot?.timestamp) return list(history).slice(0, MAX_EVALUATION_HISTORY);
  const item = {
    evaluationId: snapshot.evaluationId || '',
    overallScore: snapshot.Overall ?? snapshot.overallScore ?? 0,
    grade: snapshot.Grade || snapshot.grade || '',
    confidence: snapshot.Confidence ?? snapshot.confidence ?? 0,
    contextCoverage: snapshot.Context ?? snapshot.contextCoverage ?? 0,
    hallucination: snapshot.Hallucination || snapshot.hallucination || 'LOW',
    toolScore: snapshot.Tools ?? snapshot.toolScore ?? 0,
    decisionScore: snapshot.Decision ?? snapshot.decisionScore ?? 0,
    conversationScore: snapshot.Conversation ?? snapshot.conversationScore ?? 0,
    personalizationScore: snapshot.Personalization ?? snapshot.personalizationScore ?? 0,
    createdAt: snapshot.timestamp || snapshot.createdAt || new Date().toISOString(),
  };
  return [item, ...list(history)].slice(0, MAX_EVALUATION_HISTORY);
}

export function buildEvaluationHistoryPatch(memory = {}, snapshot = {}) {
  return {
    evaluationHistory: addEvaluationHistoryItem(memory.evaluationHistory, snapshot),
  };
}

export class EvaluationHistory {
  constructor(history = []) {
    this.history = list(history).slice(0, MAX_EVALUATION_HISTORY);
  }

  add(snapshot = {}) {
    this.history = addEvaluationHistoryItem(this.history, snapshot);
    return this.history;
  }
}
