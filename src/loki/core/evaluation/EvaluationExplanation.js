function pct(value) {
  return `${Math.round(Number(value || 0))}%`;
}

export function explainEvaluation(snapshot = {}, context = {}, metrics = {}) {
  const reasons = [];
  reasons.push(`Итог ${snapshot.Overall ?? 0}: ответ ${pct(metrics.answerQuality?.score)}, решение ${pct(metrics.decisionQuality?.score)}, контекст ${pct(metrics.contextCoverage?.coverage)}.`);
  if (metrics.contextCoverage?.missing?.length) reasons.push(`Ниже из-за отсутствующих сигналов: ${metrics.contextCoverage.missing.slice(0, 4).join(', ')}.`);
  if (metrics.hallucinationRisk?.risk !== 'LOW') reasons.push(`Hallucination ${metrics.hallucinationRisk.risk}: найдены маркеры предположения или не хватило Knowledge-контекста.`);
  if (metrics.personalization?.personalizationScore < 75) reasons.push(`Personalization ${metrics.personalization.personalizationScore}: использовано мало персональных сигналов.`);
  if (metrics.toolQuality?.toolUsed && !metrics.toolQuality?.toolNeeded) reasons.push('Tool выглядел лишним: вопрос можно было закрыть локальным контекстом.');
  if (metrics.toolQuality?.toolNeeded && !metrics.toolQuality?.toolUsed) reasons.push('Tool мог быть полезен, но ответ был построен без tool-вызова.');
  return reasons;
}

export function answerEvaluationExplainQuery(question = '', snapshot = {}, context = {}, metrics = {}) {
  const query = String(question || '').toLowerCase();
  if (!query.includes('почему') && !query.includes('оценк') && !query.includes('hallucination') && !query.includes('personalization') && !query.includes('tool')) return null;
  return explainEvaluation(snapshot, context, metrics).join('\n');
}

export class EvaluationExplanation {
  explain(snapshot = {}, context = {}, metrics = {}) {
    return explainEvaluation(snapshot, context, metrics);
  }
}
