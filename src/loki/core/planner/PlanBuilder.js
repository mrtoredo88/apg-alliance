import { TOOL_IDS } from '../tools/ToolRegistry.js';
import { PLANNER_GOALS } from './GoalResolver.js';

function step(id, title, kind, payload = {}) {
  return { id, title, kind, status: 'pending', ...payload };
}

function memoryPlanSummary(memorySnapshot = null) {
  if (!memorySnapshot?.used?.length) return null;
  return {
    source: memorySnapshot.source,
    used: memorySnapshot.used.slice(0, 5).map(item => ({ id: item.id, key: item.key, type: item.type, score: item.score })),
    preferences: memorySnapshot.preferences?.slice?.(0, 3) || [],
  };
}

function workflowPlanSummary(workflowSnapshot = null) {
  if (!workflowSnapshot || workflowSnapshot.empty) return null;
  return {
    source: workflowSnapshot.source,
    activeWorkflowId: workflowSnapshot.active?.workflowId || '',
    currentStep: workflowSnapshot.currentStep?.id || '',
    completedSteps: workflowSnapshot.completedSteps?.slice?.(0, 8) || [],
  };
}

export function buildLokiPlan({ goal = {}, classification = {}, question = '', memorySnapshot = null, workflowSnapshot = null } = {}) {
  const base = {
    id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    goal: goal.id,
    goalTitle: goal.title,
    intent: classification.id,
    query: classification.query || question,
    confidence: classification.confidence || 0,
    memory: memoryPlanSummary(memorySnapshot),
    workflow: workflowPlanSummary(workflowSnapshot),
    createdAt: new Date().toISOString(),
    steps: [],
  };
  if (goal.id === PLANNER_GOALS.FIND_VALUE_PLACE) {
    base.steps = [
      step('check-meetings', 'Проверить занятость пользователя', 'tool', { toolId: TOOL_IDS.MEETING_TOMORROW }),
      step('find-promotions', 'Найти актуальные акции', 'tool', { toolId: TOOL_IDS.PROMOTION_ACTIVE }),
      step('find-events', 'Найти ближайшие события', 'tool', { toolId: TOOL_IDS.EVENT_UPCOMING }),
      step('merge', 'Объединить варианты', 'merge'),
      step('rank', 'Отсортировать по пользе', 'rank'),
      step('respond', 'Сформировать ответ', 'respond'),
    ];
  } else if (goal.id === PLANNER_GOALS.BOOK_SERVICE_WITH_CONTEXT) {
    base.steps = [
      step('find-partners', 'Найти подходящих партнёров', 'tool', { toolId: TOOL_IDS.PARTNER_FIND, params: { query: question } }),
      step('check-promotions', 'Проверить акции партнёров', 'tool', { toolId: TOOL_IDS.PROMOTION_ACTIVE }),
      step('check-meetings', 'Проверить текущие записи', 'tool', { toolId: TOOL_IDS.MEETING_LIST }),
      step('merge', 'Собрать варианты записи', 'merge'),
      step('rank', 'Выбрать лучший следующий шаг', 'rank'),
      step('respond', 'Сформировать ответ', 'respond'),
    ];
  } else if (goal.id === PLANNER_GOALS.OPTIMIZE_KEYS) {
    base.steps = [
      step('user-keys', 'Проверить баланс ключей', 'tool', { toolId: TOOL_IDS.USER_KEYS }),
      step('journey', 'Проверить текущий путь', 'tool', { toolId: TOOL_IDS.JOURNEY_PROGRESS }),
      step('promotions', 'Проверить акции', 'tool', { toolId: TOOL_IDS.PROMOTION_ACTIVE }),
      step('gifts', 'Проверить доступные подарки', 'tool', { toolId: TOOL_IDS.GIFT_AVAILABLE }),
      step('events', 'Проверить мероприятия', 'tool', { toolId: TOOL_IDS.EVENT_UPCOMING }),
      step('rank', 'Расставить приоритет', 'rank'),
      step('respond', 'Сформировать ответ', 'respond'),
    ];
  } else if (goal.id === PLANNER_GOALS.PLAN_DAY) {
    base.steps = [
      step('meetings', 'Проверить записи', 'tool', { toolId: TOOL_IDS.MEETING_TOMORROW }),
      step('events', 'Проверить события', 'tool', { toolId: TOOL_IDS.EVENT_UPCOMING }),
      step('news', 'Проверить свежие новости', 'tool', { toolId: TOOL_IDS.NEWS_LATEST }),
      step('merge', 'Собрать повестку', 'merge'),
      step('respond', 'Сформировать ответ', 'respond'),
    ];
  } else if (goal.id === PLANNER_GOALS.REVIEW_WORKSPACE) {
    base.steps = [
      step('workspace', 'Получить сводку Workspace', 'tool', { toolId: TOOL_IDS.WORKSPACE_SUMMARY }),
      step('meetings', 'Проверить записи', 'tool', { toolId: TOOL_IDS.MEETING_LIST }),
      step('journey', 'Проверить незавершённый путь', 'tool', { toolId: TOOL_IDS.JOURNEY_UNFINISHED }),
      step('rank', 'Выделить важное', 'rank'),
      step('respond', 'Сформировать ответ', 'respond'),
    ];
  }
  return base.steps.length ? base : null;
}
