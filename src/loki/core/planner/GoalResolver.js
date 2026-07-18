import { PLANNER_INTENTS } from './IntentClassifier.js';

export const PLANNER_GOALS = {
  FIND_VALUE_PLACE: 'FIND_VALUE_PLACE',
  BOOK_SERVICE_WITH_CONTEXT: 'BOOK_SERVICE_WITH_CONTEXT',
  OPTIMIZE_KEYS: 'OPTIMIZE_KEYS',
  PLAN_DAY: 'PLAN_DAY',
  REVIEW_WORKSPACE: 'REVIEW_WORKSPACE',
  GENERAL: 'GENERAL',
};

export function resolvePlannerGoal(classification = {}) {
  if (classification.id === PLANNER_INTENTS.EVENING_DISCOUNTS) return { id: PLANNER_GOALS.FIND_VALUE_PLACE, title: 'найти выгодное место для визита' };
  if (classification.id === PLANNER_INTENTS.BOOK_NEARBY_SERVICE) return { id: PLANNER_GOALS.BOOK_SERVICE_WITH_CONTEXT, title: 'подобрать запись рядом' };
  if (classification.id === PLANNER_INTENTS.KEY_OPPORTUNITY) return { id: PLANNER_GOALS.OPTIMIZE_KEYS, title: 'найти лучший способ получить или потратить ключи' };
  if (classification.id === PLANNER_INTENTS.DAY_PLAN) return { id: PLANNER_GOALS.PLAN_DAY, title: 'собрать план дня' };
  if (classification.id === PLANNER_INTENTS.WORKSPACE_OVERVIEW) return { id: PLANNER_GOALS.REVIEW_WORKSPACE, title: 'проверить рабочую сводку' };
  return { id: PLANNER_GOALS.GENERAL, title: 'ответить на вопрос' };
}
