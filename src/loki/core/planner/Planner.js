import { classifyPlannerIntent, PLANNER_INTENTS } from './IntentClassifier.js';
import { buildLokiPlan } from './PlanBuilder.js';
import { makePlanDeniedResult, validateLokiPlan } from './PlanValidator.js';
import { resolvePlannerGoal } from './GoalResolver.js';
import { executePlanSteps } from './StepExecutor.js';

export function runLokiPlanner({
  question = '',
  intent = {},
  reasoningResult = null,
  journeyResult = null,
  knowledge = {},
  context = {},
  appState = {},
} = {}) {
  const classification = classifyPlannerIntent({ question, intent, reasoningResult, journeyResult, context });
  if (!classification || classification.id === PLANNER_INTENTS.GENERAL || classification.confidence < 0.75) return null;
  const goal = resolvePlannerGoal(classification);
  const memorySnapshot = context?.memory?.memorySnapshot || context?.userMemory?.memorySnapshot || null;
  const plan = buildLokiPlan({ goal, classification, question, intent, memorySnapshot });
  if (!plan) return null;
  const validation = validateLokiPlan(plan);
  if (!validation.ok) return makePlanDeniedResult(plan, validation);
  return executePlanSteps(plan, { knowledge, context, appState });
}
