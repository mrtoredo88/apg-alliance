import { nowMs } from '../tools/ToolResult.js';
import { buildEvaluationContext } from './EvaluationContext.js';
import { computeEvaluationMetrics } from './EvaluationMetrics.js';
import { scoreEvaluation } from './EvaluationScorer.js';
import { buildEvaluationSnapshot } from './EvaluationSnapshot.js';
import { explainEvaluation } from './EvaluationExplanation.js';
import { validateEvaluation } from './EvaluationValidator.js';

function evaluationId() {
  return `evaluation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function runLokiEvaluationEngine({ question = '', result = {}, context = {}, trace = [] } = {}) {
  const started = nowMs();
  const evaluationContext = {
    ...buildEvaluationContext({ question, result, context, trace }),
    evaluationId: evaluationId(),
  };
  const metrics = computeEvaluationMetrics(evaluationContext);
  const score = scoreEvaluation(metrics);
  const evaluationSnapshot = buildEvaluationSnapshot({ context: evaluationContext, metrics, score });
  const validation = validateEvaluation({ context: evaluationContext, metrics, snapshot: evaluationSnapshot });
  return {
    evaluationContext,
    evaluationMetrics: metrics,
    evaluationScore: score,
    evaluationSnapshot: {
      ...evaluationSnapshot,
      validation,
      durationMs: Math.round(nowMs() - started),
      explanation: explainEvaluation(evaluationSnapshot, evaluationContext, metrics),
    },
  };
}

export class EvaluationEngine {
  evaluate(input = {}) {
    return runLokiEvaluationEngine(input);
  }
}
