import { getToolDefinition } from '../tools/ToolRegistry.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function validateLokiPlan(plan = {}) {
  if (!plan?.steps?.length) return { ok: false, reason: 'План пустой.' };
  const invalid = list(plan.steps).find(step => step.kind === 'tool' && !getToolDefinition(step.toolId));
  if (invalid) return { ok: false, reason: `В плане есть неизвестный инструмент: ${invalid.toolId}.`, step: invalid };
  const hasRespond = list(plan.steps).some(step => step.kind === 'respond');
  if (!hasRespond) return { ok: false, reason: 'План не содержит шаг ответа.' };
  return { ok: true };
}

export function makePlanDeniedResult(plan, validation) {
  return {
    intent: 'planner.denied',
    preserveText: true,
    text: validation.reason || 'Не удалось построить безопасный план.',
    card: null,
    cards: [],
    planContext: {
      plan,
      status: 'denied',
      failed: validation.step ? [validation.step.id] : [],
    },
  };
}
