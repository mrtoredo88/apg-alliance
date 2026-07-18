import { normalizeText } from '../lokiCoreUtils.js';
import { getWorkflowRegistry } from './WorkflowRegistry.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function includesAny(query, values = []) {
  return values.some(value => query.includes(normalizeText(value)));
}

function scoreWorkflow(workflow = {}, { question = '', intent = {}, plannerResult = null } = {}) {
  const query = normalizeText(question);
  const plannerGoal = plannerResult?.planContext?.goal || '';
  let score = 0;
  const reasons = [];
  if (workflow.plannerGoals?.includes(plannerGoal)) {
    score += 5;
    reasons.push(`planner:${plannerGoal}`);
  }
  if (workflow.intents?.includes(intent.id) || workflow.intents?.includes(plannerResult?.intent)) {
    score += 3;
    reasons.push(`intent:${intent.id || plannerResult?.intent}`);
  }
  if (includesAny(query, workflow.keywords)) {
    score += 2;
    reasons.push('keyword');
  }
  if (workflow.id === 'event' && includesAny(query, ['мероприят', 'событ', 'афиш'])) score += 4;
  if (workflow.id === 'gift' && includesAny(query, ['подар', 'приз'])) score += 4;
  if (workflow.id === 'referral' && includesAny(query, ['рефера', 'приглас', 'друз', 'ссылк'])) score += 4;
  if (workflow.id === 'workspace' && includesAny(query, ['workspace', 'кабинет'])) score += 4;
  if (workflow.id === 'partner' && includesAny(query, ['партн', 'салон', 'магазин', 'кафе', 'цвет'])) score += 2;
  if (workflow.id === 'booking' && includesAny(query, ['запис', 'запиши', 'бронь'])) score += 4;
  return { workflow, score, reasons };
}

export function resolveWorkflow({ question = '', intent = {}, plannerResult = null, context = {} } = {}) {
  const actorRole = context?.actor?.role || 'user';
  const ranked = getWorkflowRegistry()
    .filter(workflow => !workflow.roles?.length || workflow.roles.includes(actorRole))
    .map(workflow => scoreWorkflow(workflow, { question, intent, plannerResult, context }))
    .sort((a, b) => b.score - a.score);
  const selected = ranked[0];
  if (!selected || selected.score < 4) return null;
  return {
    workflow: selected.workflow,
    reason: selected.workflow.reason || selected.reasons.join(', ') || 'workflow соответствует плану',
    score: selected.score,
    candidates: ranked.filter(item => item.score > 0).map(item => ({
      id: item.workflow.id,
      score: item.score,
      reasons: list(item.reasons),
    })),
  };
}
