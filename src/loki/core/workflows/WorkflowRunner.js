import { executeLokiTool } from '../tools/ToolExecutor.js';
import { nowMs } from '../tools/ToolResult.js';
import { LOKI_WORKFLOW_EVENTS, workflowEvent } from './WorkflowHistory.js';
import { buildWorkflowProgress } from './WorkflowProgress.js';
import { WORKFLOW_STATES, WORKFLOW_STEP_STATES } from './WorkflowState.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function isDependencyDone(steps = [], dependencyId) {
  const step = steps.find(item => item.id === dependencyId);
  return [WORKFLOW_STEP_STATES.COMPLETED, WORKFLOW_STEP_STATES.SKIPPED].includes(step?.status);
}

function summarizeToolResult(result = {}) {
  return {
    status: result.toolContext?.status || 'unknown',
    text: result.text || '',
    cards: list(result.cards).slice(0, 3),
    card: result.card || null,
  };
}

export function runWorkflowPlan(plan = {}, { workflow = {}, knowledge = {}, context = {}, appState = {} } = {}) {
  const started = nowMs();
  const startedAt = new Date().toISOString();
  const events = [
    workflowEvent(LOKI_WORKFLOW_EVENTS.CREATED, { workflowId: workflow.id, workflowRunId: plan.id, status: WORKFLOW_STATES.CREATED }),
    workflowEvent(LOKI_WORKFLOW_EVENTS.STARTED, { workflowId: workflow.id, workflowRunId: plan.id, status: WORKFLOW_STATES.RUNNING }),
  ];
  const toolResults = [];
  const steps = list(plan.steps).map(step => ({ ...step }));
  let status = WORKFLOW_STATES.RUNNING;
  let errorReason = '';

  for (const step of steps) {
    if (step.status === WORKFLOW_STEP_STATES.SKIPPED) continue;
    if (!list(step.dependencies).every(id => isDependencyDone(steps, id))) continue;
    if (step.kind === 'tool') {
      step.status = WORKFLOW_STEP_STATES.RUNNING;
      events.push(workflowEvent(LOKI_WORKFLOW_EVENTS.STEP_STARTED, { workflowId: workflow.id, workflowRunId: plan.id, stepId: step.id, status: step.status }));
      const result = executeLokiTool({ id: step.toolId, params: step.params || {} }, { knowledge, context, appState });
      toolResults.push(result);
      step.status = result.toolContext?.status === 'completed' ? WORKFLOW_STEP_STATES.COMPLETED : WORKFLOW_STEP_STATES.FAILED;
      step.result = summarizeToolResult(result);
      events.push(workflowEvent(
        step.status === WORKFLOW_STEP_STATES.COMPLETED ? LOKI_WORKFLOW_EVENTS.STEP_COMPLETED : LOKI_WORKFLOW_EVENTS.FAILED,
        { workflowId: workflow.id, workflowRunId: plan.id, stepId: step.id, status: step.status, reason: result.toolContext?.events?.find?.(event => event.reason)?.reason || '' },
      ));
      if (step.status === WORKFLOW_STEP_STATES.FAILED && !step.optional) {
        status = WORKFLOW_STATES.FAILED;
        errorReason = result.text || 'Tool step failed.';
        break;
      }
      continue;
    }
    if (step.kind === 'user_action') {
      step.status = WORKFLOW_STEP_STATES.WAITING_USER;
      status = WORKFLOW_STATES.WAITING_USER;
      step.result = { actionId: step.actionId, waitingUser: true };
      events.push(workflowEvent(LOKI_WORKFLOW_EVENTS.WAITING_USER, { workflowId: workflow.id, workflowRunId: plan.id, stepId: step.id, status }));
      break;
    }
  }

  const finished = status === WORKFLOW_STATES.FAILED || status === WORKFLOW_STATES.COMPLETED;
  if (status === WORKFLOW_STATES.RUNNING) status = WORKFLOW_STATES.COMPLETED;
  if (status === WORKFLOW_STATES.COMPLETED) events.push(workflowEvent(LOKI_WORKFLOW_EVENTS.COMPLETED, { workflowId: workflow.id, workflowRunId: plan.id, status }));
  const updatedAt = new Date().toISOString();
  const progress = buildWorkflowProgress({
    steps,
    status,
    startedAt,
    updatedAt,
    finishedAt: finished || status === WORKFLOW_STATES.COMPLETED ? updatedAt : null,
  });
  return {
    steps,
    status,
    progress,
    events,
    toolResults,
    errorReason,
    durationMs: Math.round(nowMs() - started),
  };
}
