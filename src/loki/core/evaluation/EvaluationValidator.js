export function validateEvaluation({ context = {}, metrics = {}, snapshot = {} } = {}) {
  if (!context.question && !context.answer) return { ok: false, reason: 'missing_question_and_answer' };
  if (!metrics.answerQuality) return { ok: false, reason: 'missing_metrics' };
  if (!Number.isFinite(Number(snapshot.Overall))) return { ok: false, reason: 'invalid_overall_score' };
  if (!snapshot.Grade) return { ok: false, reason: 'missing_grade' };
  return { ok: true, reason: '' };
}

export class EvaluationValidator {
  validate(input = {}) {
    return validateEvaluation(input);
  }
}
