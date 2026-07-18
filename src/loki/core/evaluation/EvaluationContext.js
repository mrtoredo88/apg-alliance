function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function text(value, max = 1600) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function conversationIdOf(result = {}, decisionContext = {}) {
  const sourceResult = result || {};
  return sourceResult.conversationContext?.conversationId
    || sourceResult.conversationContext?.session?.conversationId
    || decisionContext.trace?.conversationId
    || decisionContext.decisionId
    || '';
}

function usedToolsOf(result = {}, decisionContext = {}) {
  const sourceResult = result || {};
  return [
    ...list(decisionContext.toolCalls),
    ...list(sourceResult.workflowContext?.toolCalls),
    sourceResult.toolContext?.call,
    sourceResult.toolContext?.toolResult,
    sourceResult.toolResult,
  ].filter(Boolean);
}

export function buildEvaluationContext({ question = '', result = {}, context = {}, trace = [] } = {}) {
  const sourceResult = result || {};
  const decisionContext = sourceResult.decisionContext || {};
  return {
    version: 'v1',
    conversationId: conversationIdOf(result, decisionContext),
    question: text(question, 800),
    answer: text(sourceResult.text || sourceResult.answer || sourceResult.message, 2600),
    decisionContext,
    actions: list(sourceResult.actionCenter?.suggested).length ? list(sourceResult.actionCenter?.suggested) : list(sourceResult.suggestions),
    usedTools: usedToolsOf(result, decisionContext),
    reasoning: sourceResult.reasoningContext || context?.memory?.lastReasoningContext || null,
    planner: sourceResult.planContext || context?.memory?.lastPlanContext || null,
    workflow: sourceResult.workflowContext || context?.memory?.lastWorkflowContext || null,
    confidence: Number(sourceResult.confidence ?? decisionContext.confidence ?? sourceResult.reasoningContext?.confidence ?? 0),
    knowledge: sourceResult.knowledge || null,
    memoryContext: sourceResult.memoryContext || context?.memory?.lastMemoryContext || null,
    conversationContext: sourceResult.conversationContext || context?.memory?.lastConversationContext || null,
    journeyContext: sourceResult.journeyContext || context?.memory?.lastJourneyContext || null,
    toolContext: sourceResult.toolContext || context?.memory?.lastToolContext || null,
    personalizationContext: sourceResult.personalizationContext || null,
    actionCenter: sourceResult.actionCenter || null,
    appContext: {
      userName: context?.user?.name || '',
      role: context?.actor?.role || context?.user?.role || '',
      city: context?.user?.city || 'Зеленоград',
      activePanel: context?.user?.currentPanel || context?.currentScreen?.id || '',
    },
    trace: list(trace),
    timestamp: new Date().toISOString(),
  };
}

export class EvaluationContext {
  constructor(input = {}) {
    Object.assign(this, buildEvaluationContext(input));
  }
}
