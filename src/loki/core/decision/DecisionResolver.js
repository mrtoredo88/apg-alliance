function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function titleOf(item = {}) {
  return String(item.title || item.name || item.id || item.type || '').trim();
}

export function resolveDecisionAlternatives({ result = {} } = {}) {
  const alternatives = [];
  list(result.ranked || result.reasoningContext?.ranked || result.reasoningContext?.items).slice(1, 5).forEach(item => {
    alternatives.push({
      type: 'ranked_candidate',
      id: item.id || '',
      title: titleOf(item),
      reason: list(item.reasons).map(row => row.label || row).filter(Boolean).slice(0, 3).join(', ') || 'альтернативный вариант в ранжировании',
    });
  });
  list(result.workflowContext?.candidates).slice(0, 4).forEach(item => {
    alternatives.push({
      type: 'workflow_candidate',
      id: item.workflowId || item.id || '',
      title: item.title || item.workflowId || item.id || 'workflow',
      reason: item.reason || 'подходящий workflow-кандидат',
    });
  });
  list(result.actionCenter?.suggested).slice(1, 4).forEach(item => {
    alternatives.push({
      type: 'action_candidate',
      id: item.actionId || item.action?.type || '',
      title: item.label || item.action?.type || 'действие',
      reason: 'доступное следующее действие',
    });
  });
  if (result.conversationContext?.validation?.ok === false) {
    alternatives.push({
      type: 'clarification',
      id: 'conversation.clarify',
      title: 'Уточнить контекст',
      reason: result.conversationContext.validation.reason || 'ссылка неоднозначна',
    });
  }
  return alternatives.slice(0, 8);
}

export function resolveDecisionReason({ result = {}, alternatives = [] } = {}) {
  if (result.agentContext?.decision?.reason) return result.agentContext.decision.reason;
  if (result.workflowContext?.selectedReason) return result.workflowContext.selectedReason;
  if (result.planContext?.goal) return `Planner выбрал цель ${result.planContext.goal}`;
  if (result.toolContext?.call?.id) return `выбран read-only tool ${result.toolContext.call.id}`;
  if (result.conversationContext?.resolvedReference) return `разрешена ссылка на «${result.conversationContext.resolvedReference.entity?.title || 'объект'}»`;
  if (alternatives.length) return 'выбран лучший вариант среди альтернатив';
  return 'достаточно обычного ответа по текущему контексту';
}
