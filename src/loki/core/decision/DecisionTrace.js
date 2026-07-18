function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function used(name, value) {
  return value ? name : null;
}

export function buildDecisionTrace({ result = {}, context = {} } = {}) {
  const engines = [
    used('knowledge', result.knowledge),
    used('reasoning', result.reasoningContext),
    used('conversation', result.conversationContext),
    used('journey', result.journeyContext),
    used('memory', result.memoryContext),
    used('planner', result.planContext),
    used('workflow', result.workflowContext),
    used('agent', result.agentContext),
    used('tool', result.toolContext),
    used('actionCenter', result.actionCenter),
    used('personality', result.personalityPhraseId || result.personalityMode),
  ].filter(Boolean);
  return {
    version: 'v1',
    engines,
    intent: result.intent || '',
    goal: result.journeyContext?.goal || result.planContext?.goal || result.workflowContext?.goal || '',
    conversationId: result.conversationContext?.conversationId || result.conversationContext?.session?.conversationId || '',
    memoryUsed: list(result.memoryContext?.used).length,
    plannerUsed: Boolean(result.planContext),
    workflowUsed: Boolean(result.workflowContext),
    agentDecision: result.agentContext?.decision?.type || '',
    toolCalls: list(result.workflowContext?.toolCalls).length + (result.toolContext?.call ? 1 : 0),
    actions: list(result.actionCenter?.suggested).length || list(result.suggestions).length || list(result.card?.actions).length,
    duration: Number(result.agentContext?.durationMs || 0)
      + Number(result.workflowContext?.durationMs || 0)
      + Number(result.planContext?.durationMs || 0)
      + Number(result.toolContext?.durationMs || 0)
      + Number(result.conversationContext?.durationMs || 0),
    activePanel: context?.user?.currentPanel || context?.currentScreen?.id || '',
  };
}
