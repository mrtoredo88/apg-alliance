import { buildExecutionPlan } from './ExecutionPlan.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function buildExecutionContext({
  question = '',
  capabilityContext = null,
  resolution = {},
  validation = null,
  context = {},
} = {}) {
  const primary = list(resolution.executionOrder)[0] || {};
  return {
    id: `execution-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    version: 'v1',
    source: 'local',
    question,
    capability: resolution.capability || capabilityContext?.capability || '',
    title: resolution.title || capabilityContext?.title || '',
    execution: resolution.execution?.mode || primary.mode || '',
    planner: primary.plannerGoal || resolution.execution?.plannerGoal || '',
    workflow: primary.workflowId || resolution.execution?.workflowId || '',
    navigation: primary.navigation || resolution.execution?.navigation || null,
    actionId: primary.actionId || resolution.execution?.actionId || '',
    actionType: primary.actionType || resolution.execution?.actionType || '',
    tools: list(primary.toolIds?.length ? primary.toolIds : resolution.execution?.toolIds),
    required: list(resolution.requiredParameters),
    resolved: resolution.resolvedParameters || {},
    missing: list(resolution.missingParameters),
    executionOrder: list(resolution.executionOrder),
    executionPlan: buildExecutionPlan(resolution),
    ready: Boolean(resolution.ready),
    reason: resolution.reason || '',
    clarificationQuestion: resolution.clarificationQuestion || '',
    capabilityContext,
    validation,
    actorRole: context?.actor?.role || 'user',
    createdAt: new Date().toISOString(),
  };
}

export class ExecutionContext {
  constructor(input = {}) {
    Object.assign(this, buildExecutionContext(input));
  }
}
