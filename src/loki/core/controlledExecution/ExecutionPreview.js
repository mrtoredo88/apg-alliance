export function buildExecutionPreview({ executionContext = {}, policy = {}, dispatch = {}, confirmation = {} } = {}) {
  const title = executionContext.title || executionContext.capability || 'Действие';
  const parts = [
    `Действие: ${title}`,
    `Будет выполнено: ${dispatch.dispatcher || executionContext.execution || 'не определено'}`,
    dispatch.route ? `Маршрут: ${dispatch.route}` : '',
    executionContext.workflow ? `Workflow: ${executionContext.workflow}` : '',
    executionContext.tools?.length ? `Tools: ${executionContext.tools.join(', ')}` : '',
    `Подтверждение: ${confirmation.required ? 'требуется' : 'не требуется'}`,
  ].filter(Boolean);
  return {
    title,
    dispatcher: dispatch.dispatcher || '',
    route: dispatch.route || '',
    workflow: executionContext.workflow || '',
    tools: executionContext.tools || [],
    confirmationRequired: Boolean(confirmation.required),
    text: parts.join('\n'),
    policy: policy.policy || '',
  };
}

export class ExecutionPreview {
  build(input = {}) {
    return buildExecutionPreview(input);
  }
}
