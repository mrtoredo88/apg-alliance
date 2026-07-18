import { executeLokiTool } from '../tools/ToolExecutor.js';
import { cardForToolItem, list, nowMs } from '../tools/ToolResult.js';
import { memoryMatchScore } from '../memory/MemoryRanker.js';
import { PLANNER_GOALS } from './GoalResolver.js';

function uniqueCards(cards = []) {
  const seen = new Set();
  return list(cards).filter(card => {
    const key = `${card.type || ''}:${card.id || card.title || ''}`;
    if (!key.trim() || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
}

function collectCards(toolResults = []) {
  return uniqueCards(toolResults.flatMap(result => list(result.cards)));
}

function collectItems(toolResults = [], memorySnapshot = null) {
  return toolResults.flatMap(result => list(result.cards).map(card => {
    const memoryScore = memoryMatchScore(card, memorySnapshot);
    return { ...card, score: scoreCard(card) + memoryScore, memoryScore };
  }));
}

function scoreCard(card = {}) {
  const body = `${card.title || ''} ${card.text || ''} ${list(card.meta).join(' ')}`.toLowerCase();
  let score = 1;
  if (body.includes('скид') || body.includes('акци')) score += 2;
  if (body.includes('завтра') || body.includes('сегодня')) score += 1.5;
  if (card.action) score += 1;
  return score;
}

function buildAnswer({ plan, toolResults, ranked }) {
  const top = ranked[0];
  if (plan.goal === PLANNER_GOALS.FIND_VALUE_PLACE) {
    return top
      ? `Собрал план: проверил ваши записи, акции и ближайшие события. Лучший следующий вариант — «${top.title}»: он выглядит самым полезным по текущим данным.`
      : 'Проверил записи, акции и события, но подходящего варианта по текущим данным не нашёл.';
  }
  if (plan.goal === PLANNER_GOALS.BOOK_SERVICE_WITH_CONTEXT) {
    return top
      ? `Проверил партнёров, акции и текущие записи. Начал бы с «${top.title}»: дальше можно открыть карточку и перейти к записи.`
      : 'Проверил партнёров, акции и записи, но подходящей карточки для записи сейчас не нашёл.';
  }
  if (plan.goal === PLANNER_GOALS.OPTIMIZE_KEYS) {
    const keysText = toolResults.find(result => result.toolContext?.call?.id === 'user.keys')?.text || '';
    return top
      ? `${keysText}\nСамый полезный следующий шаг — «${top.title}». Я сравнил текущий путь, акции, подарки и мероприятия.`
      : `${keysText || 'Проверил ключи.'}\nПо текущим данным не вижу очевидного способа выгоднее получить или потратить ключи.`;
  }
  if (plan.goal === PLANNER_GOALS.PLAN_DAY) {
    return ranked.length
      ? `Собрал повестку из записей, событий и свежих новостей. На первом месте — «${ranked[0].title}».`
      : 'Проверил записи, события и новости: явных пунктов для плана дня в текущих данных не вижу.';
  }
  if (plan.goal === PLANNER_GOALS.REVIEW_WORKSPACE) {
    return toolResults.map(result => result.text).filter(Boolean).slice(0, 3).join('\n') || 'Проверил Workspace, записи и незавершённые пути.';
  }
  return toolResults.map(result => result.text).filter(Boolean).join('\n');
}

export function executePlanSteps(plan, { knowledge = {}, context = {}, appState = {} } = {}) {
  const started = nowMs();
  const toolResults = [];
  const memorySnapshot = context?.memory?.memorySnapshot || context?.userMemory?.memorySnapshot || null;
  let merged = [];
  let ranked = [];
  const steps = [];
  for (const step of list(plan.steps)) {
    const stepStarted = nowMs();
    if (step.kind === 'tool') {
      const result = executeLokiTool({ id: step.toolId, params: step.params || {} }, { knowledge, context, appState });
      toolResults.push(result);
      steps.push({ ...step, status: result.toolContext?.status === 'completed' ? 'completed' : 'failed', durationMs: Math.round(nowMs() - stepStarted), toolContext: result.toolContext });
    } else if (step.kind === 'merge') {
      merged = collectItems(toolResults, memorySnapshot);
      steps.push({ ...step, status: 'completed', durationMs: Math.round(nowMs() - stepStarted), count: merged.length });
    } else if (step.kind === 'rank') {
      ranked = (merged.length ? merged : collectItems(toolResults, memorySnapshot)).sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, 5);
      steps.push({ ...step, status: 'completed', durationMs: Math.round(nowMs() - stepStarted), count: ranked.length });
    } else if (step.kind === 'respond') {
      if (!ranked.length) ranked = collectCards(toolResults).map(card => ({ ...card, score: scoreCard(card) + memoryMatchScore(card, memorySnapshot) })).sort((a, b) => b.score - a.score);
      steps.push({ ...step, status: 'completed', durationMs: Math.round(nowMs() - stepStarted) });
    }
  }
  const cards = uniqueCards((ranked.length ? ranked : collectCards(toolResults)).map(item => item.action ? item : cardForToolItem(item, item.type)));
  const failed = steps.filter(step => step.status === 'failed');
  const completed = steps.filter(step => step.status === 'completed').map(step => step.id);
  return {
    intent: `planner.${String(plan.goal || 'general').toLowerCase()}`,
    preserveText: true,
    text: buildAnswer({ plan, toolResults, ranked: cards }),
    card: cards[0] || null,
    cards,
    planContext: {
      version: 'v1',
      id: plan.id,
      goal: plan.goal,
      goalTitle: plan.goalTitle,
      steps,
      currentStep: failed[0] || null,
      completed,
      failed: failed.map(step => step.id),
      durationMs: Math.round(nowMs() - started),
      status: failed.length ? 'partial' : 'completed',
      toolCalls: toolResults.map(result => result.toolContext?.call).filter(Boolean),
      memoryUsed: list(memorySnapshot?.used).slice(0, 5).map(item => ({ id: item.id, key: item.key, type: item.type, score: item.score })),
    },
    toolContext: {
      status: failed.length ? 'partial' : 'completed',
      durationMs: Math.round(nowMs() - started),
      events: toolResults.flatMap(result => list(result.toolContext?.events)),
    },
  };
}
