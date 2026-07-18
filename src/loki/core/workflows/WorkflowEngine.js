import { cardForToolItem } from '../tools/ToolResult.js';
import { resolveWorkflow } from './WorkflowResolver.js';
import { buildWorkflowPlan } from './WorkflowPlanner.js';
import { runWorkflowPlan } from './WorkflowRunner.js';
import { validateWorkflowRun } from './WorkflowValidator.js';
import { buildWorkflowSnapshot } from './WorkflowSnapshot.js';
import { LOKI_WORKFLOW_EVENTS, workflowEvent } from './WorkflowHistory.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function uniqueCards(cards = []) {
  const seen = new Set();
  return list(cards).filter(card => {
    const key = `${card.type || ''}:${card.id || card.title || ''}`;
    if (!key.trim() || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
}

function cardsFromTools(toolResults = []) {
  return uniqueCards(toolResults.flatMap(result => list(result.cards).length ? result.cards : result.card ? [result.card] : []))
    .map(item => item.action ? item : cardForToolItem(item, item.type));
}

function nextStepLabel(progress = {}) {
  return progress.currentStep?.title || 'продолжить сценарий';
}

function buildWorkflowText({ workflow, run }) {
  const done = run.progress?.completedSteps?.length || 0;
  const total = run.steps?.length || 0;
  if (run.status === 'WAITING_USER') {
    return `Запустил сценарий «${workflow.title}». Выполнено ${done} из ${total}. Следующий шаг — ${nextStepLabel(run.progress)}.`;
  }
  if (run.status === 'FAILED') {
    return `Начал сценарий «${workflow.title}», но остановился: ${run.errorReason || 'один из шагов не выполнился'}.`;
  }
  return `Сценарий «${workflow.title}» выполнен. Выполнено ${done} из ${total}.`;
}

export function runLokiWorkflowEngine({
  question = '',
  intent = {},
  plannerResult = null,
  reasoningResult = null,
  journeyResult = null,
  knowledge = {},
  context = {},
  appState = {},
} = {}) {
  if (!plannerResult?.planContext) return null;
  const snapshot = context?.memory?.workflowSnapshot || buildWorkflowSnapshot(context?.memory || {});
  const resolution = resolveWorkflow({ question, intent, plannerResult, reasoningResult, journeyResult, context, snapshot });
  if (!resolution?.workflow) return null;
  const workflow = resolution.workflow;
  const plan = buildWorkflowPlan({ workflow, question, plannerResult, snapshot });
  const validation = validateWorkflowRun({ ...plan, workflow }, { actor: context?.actor });
  const selectedEvent = workflowEvent(LOKI_WORKFLOW_EVENTS.SELECTED, {
    workflowId: workflow.id,
    workflowRunId: plan.id,
    status: validation.ok ? 'selected' : 'denied',
    reason: resolution.reason,
  });
  if (!validation.ok) {
    return {
      intent: 'workflow.denied',
      preserveText: true,
      text: validation.reason,
      card: plannerResult.card || null,
      cards: list(plannerResult.cards),
      workflowContext: {
        version: 'v1',
        id: plan.id,
        workflowId: workflow.id,
        title: workflow.title,
        status: 'FAILED',
        selectedReason: resolution.reason,
        steps: plan.steps,
        events: [selectedEvent],
        errorReason: validation.reason,
      },
      toolContext: plannerResult.toolContext || null,
    };
  }
  const run = runWorkflowPlan(plan, { workflow, knowledge, context, appState });
  const cards = cardsFromTools(run.toolResults);
  const workflowContext = {
    version: 'v1',
    id: plan.id,
    workflowId: workflow.id,
    title: workflow.title,
    goal: plan.goal,
    plannerId: plan.plannerId,
    selectedReason: resolution.reason,
    candidates: resolution.candidates,
    steps: run.steps,
    progress: run.progress,
    status: run.status,
    durationMs: run.durationMs,
    expectedUserActions: run.steps.filter(step => step.status === 'waiting_user' || step.kind === 'user_action').map(step => ({
      id: step.id,
      title: step.title,
      actionId: step.actionId,
      status: step.status,
    })).slice(0, 3),
    events: [selectedEvent, ...run.events],
    toolCalls: run.toolResults.map(result => result.toolContext?.call).filter(Boolean),
    snapshot: plan.snapshot,
    errorReason: run.errorReason,
  };
  return {
    intent: `workflow.${workflow.id}`,
    preserveText: true,
    text: buildWorkflowText({ workflow, run }),
    card: cards[0] || plannerResult.card || null,
    cards: cards.length ? cards : list(plannerResult.cards),
    workflowContext,
    planContext: plannerResult.planContext,
    toolContext: {
      status: run.status === 'FAILED' ? 'partial' : 'completed',
      durationMs: run.durationMs,
      events: run.toolResults.flatMap(result => list(result.toolContext?.events)),
      workflowEvents: workflowContext.events,
    },
  };
}
