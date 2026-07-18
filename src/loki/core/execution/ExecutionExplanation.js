function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function isExecutionExplainQuery(question = '') {
  const query = String(question || '').toLowerCase();
  return query.includes('почему') && (query.includes('execution') || query.includes('bridge') || query.includes('цепоч') || query.includes('tool') || query.includes('экран') || query.includes('workflow') || query.includes('planner'));
}

export function explainExecution(executionContext = {}) {
  if (!executionContext?.capability) return 'Пока нет сохранённого Execution: сначала нужно обработать обычный запрос Локи.';
  const rows = [
    `Цепочка выбрана для ${executionContext.capability}: режим ${executionContext.execution || 'не определён'}.`,
  ];
  if (executionContext.planner) rows.push(`Planner: ${executionContext.planner}.`);
  if (executionContext.workflow) rows.push(`Workflow: ${executionContext.workflow}.`);
  if (executionContext.navigation?.screen) rows.push(`Экран: ${executionContext.navigation.screen}${executionContext.navigation.path ? ` (${executionContext.navigation.path})` : ''}.`);
  if (executionContext.tools?.length) rows.push(`Tools: ${executionContext.tools.join(', ')}.`);
  if (executionContext.missing?.length) rows.push(`Нужно уточнение: ${executionContext.missing.join(', ')}. Вопрос: ${executionContext.clarificationQuestion}`);
  rows.push(`Готовность: ${executionContext.validation?.ready ?? executionContext.ready ? 'ready' : 'not ready'}.`);
  const order = list(executionContext.executionOrder).map(row => row.capability);
  if (order.length > 1) rows.push(`Порядок выполнения: ${order.join(' → ')}.`);
  return rows.join('\n');
}

export function explainLastExecution(memory = {}) {
  const context = memory.lastExecutionContext || memory.executionContext || null;
  return {
    intent: 'execution.explain',
    preserveText: true,
    text: explainExecution(context),
    card: null,
    cards: [],
    executionContext: context,
    executionSnapshot: memory.lastExecutionSnapshot || null,
  };
}

export class ExecutionExplanation {
  explain(context = {}) {
    return explainExecution(context);
  }
}
