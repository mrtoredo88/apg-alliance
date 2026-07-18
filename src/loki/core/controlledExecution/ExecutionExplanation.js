export function isControlledExecutionExplainQuery(question = '') {
  const query = String(question || '').toLowerCase();
  return query.includes('почему') && (query.includes('controlled') || query.includes('выполн') || query.includes('подтвержд') || query.includes('заблок') || query.includes('доступн'));
}

export function explainControlledExecution(context = {}) {
  if (!context?.capability) return 'Пока нет сохранённого Controlled Execution: сначала нужно обработать запрос с безопасным действием.';
  const rows = [
    `Capability: ${context.capability}.`,
    `Policy: ${context.policy?.policy || 'unknown'} (${context.policy?.reason || 'без причины'}).`,
    `Ready: ${context.executionReady ? 'true' : 'false'}.`,
  ];
  if (context.confirmationRequired) rows.push(`Подтверждение требуется: ${context.confirmation?.status || 'pending'}, executionId ${context.confirmation?.executionId || 'unknown'}.`);
  if (context.dispatcher?.dispatcher) rows.push(`Dispatcher: ${context.dispatcher.dispatcher}${context.dispatcher.action?.type ? ` через ${context.dispatcher.action.type}` : ''}.`);
  if (context.guard?.checks?.length) rows.push(`Проверки: ${context.guard.checks.map(item => `${item.id}:${item.ok ? 'ok' : 'fail'}`).join(', ')}.`);
  if (context.executionContext?.tools?.length) rows.push(`Существующие Tool: ${context.executionContext.tools.join(', ')}.`);
  if (context.result?.reason) rows.push(`Причина: ${context.result.reason}.`);
  return rows.join('\n');
}

export function explainLastControlledExecution(memory = {}) {
  const context = memory.lastControlledExecutionContext || null;
  return {
    intent: 'controlledExecution.explain',
    preserveText: true,
    text: explainControlledExecution(context),
    card: null,
    cards: [],
    controlledExecutionContext: context,
    controlledExecutionSnapshot: memory.lastControlledExecutionSnapshot || null,
  };
}

export class ExecutionExplanation {
  explain(context = {}) {
    return explainControlledExecution(context);
  }
}
