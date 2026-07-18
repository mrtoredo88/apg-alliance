import { getActionDefinition } from '../actions/ActionRegistry.js';
import { getToolDefinition } from '../tools/ToolRegistry.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function validateWorkflowDefinition(workflow = {}, { actor = {} } = {}) {
  if (!workflow?.id) return { ok: false, reason: 'У workflow нет идентификатора.' };
  if (!list(workflow.steps).length) return { ok: false, reason: 'У workflow нет шагов.' };
  if (workflow.roles?.length && !workflow.roles.includes(actor.role || 'user')) {
    return { ok: false, reason: 'Этот сценарий недоступен для текущей роли.' };
  }
  const stepIds = new Set();
  for (const step of list(workflow.steps)) {
    if (!step.id || !step.title || !step.kind) return { ok: false, reason: `Некорректный шаг workflow ${workflow.id}.` };
    if (stepIds.has(step.id)) return { ok: false, reason: `Дублирующийся шаг ${step.id}.` };
    stepIds.add(step.id);
    if (step.kind === 'tool' && !getToolDefinition(step.toolId)) return { ok: false, reason: `Неизвестный tool ${step.toolId}.` };
    if (step.kind === 'user_action' && !getActionDefinition(step.actionId)) return { ok: false, reason: `Неизвестное действие ${step.actionId}.` };
    const missingDependency = list(step.dependencies).find(id => !stepIds.has(id));
    if (missingDependency) return { ok: false, reason: `Шаг ${step.id} зависит от неизвестного шага ${missingDependency}.` };
  }
  return { ok: true };
}

export function validateWorkflowRun(plan = {}, options = {}) {
  const base = validateWorkflowDefinition(plan.workflow || plan, options);
  if (!base.ok) return base;
  return { ok: true };
}
