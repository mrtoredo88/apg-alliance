function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function scoreDecision({ result = {}, trace = {} } = {}) {
  let score = 0.72;
  const reasons = [];
  const confidence = Number(result.confidence || result.reasoningContext?.confidence || 0);
  if (confidence) {
    score = Math.max(score, Math.min(0.98, confidence / 100));
    reasons.push(`reasoning confidence ${confidence}%`);
  }
  if (result.card || list(result.cards).length) {
    score += 0.08;
    reasons.push('есть конкретные варианты');
  }
  if (result.conversationContext?.resolvedReference) {
    score += 0.04;
    reasons.push('контекстная ссылка разрешена');
  }
  if (result.conversationContext?.validation?.ok === false) {
    score -= 0.26;
    reasons.push('неоднозначная ссылка');
  }
  if (result.toolContext?.status === 'denied' || result.toolResult?.success === false) {
    score -= 0.18;
    reasons.push('tool недоступен');
  }
  if (result.workflowContext?.status === 'FAILED') {
    score -= 0.22;
    reasons.push('workflow остановился с ошибкой');
  }
  if (result.agentContext?.safety?.ok === false) {
    score -= 0.24;
    reasons.push('agent safety заблокировал действие');
  }
  if (!trace.engines?.length) {
    score -= 0.12;
    reasons.push('нет данных об участвующих движках');
  }
  const normalized = Math.max(0.12, Math.min(0.99, score));
  const level = normalized >= 0.86 ? 'high' : normalized >= 0.62 ? 'medium' : 'low';
  return {
    confidence: Number(normalized.toFixed(2)),
    level,
    reasons,
    lowConfidenceReasons: level === 'low' ? reasons : [],
  };
}
