import { buildToolResult, list } from '../ToolResult.js';

function activeJourney(context = {}) {
  return context.memory?.lastJourneyContext || context.memory?.journeyContext || null;
}

export const JourneyTool = {
  progress({ context }) {
    const journey = activeJourney(context);
    const completed = list(journey?.completedStepIds);
    const current = journey?.currentStep?.title || '';
    return buildToolResult({
      tool: 'journey',
      method: 'progress',
      title: 'текущий путь',
      text: journey
        ? `По текущему пути: выполнено ${completed.length} шагов. Следующий шаг: ${current || 'выбрать действие'}.`
        : 'Активного пути в этой сессии пока нет. Скажите цель, и я соберу маршрут действий.',
      items: [],
      data: { hasJourney: Boolean(journey), completedCount: completed.length, currentStep: current },
    });
  },

  unfinished({ context }) {
    const journey = activeJourney(context);
    return buildToolResult({
      tool: 'journey',
      method: 'unfinished',
      title: 'незавершённые шаги',
      text: journey && !journey.completedAt
        ? `Есть незавершённый путь. Сейчас шаг: ${journey.currentStep?.title || 'выбрать следующее действие'}.`
        : 'Незавершённых путей в текущей сессии не вижу.',
      items: [],
      data: { hasUnfinished: Boolean(journey && !journey.completedAt), goal: journey?.goal || null },
    });
  },

  nextReward({ knowledge, context }) {
    const keys = Number(context.user?.keys ?? knowledge.sources?.userProfile?.keys ?? 0);
    const gifts = list(knowledge.sources?.gifts).map(item => ({ ...item, costValue: Number(item.cost || item.keys || item.price || 0) })).filter(item => item.costValue > keys).sort((a, b) => a.costValue - b.costValue);
    const next = gifts[0] || null;
    return buildToolResult({
      tool: 'journey',
      method: 'nextReward',
      title: 'ближайшая награда',
      text: next ? `Ближайшая награда: «${next.title || next.name}». Нужно ещё ${Math.max(0, next.costValue - keys)} ключей.` : 'По текущим данным ближайшая недоступная награда не найдена.',
      items: next ? [next] : [],
      itemType: 'gift',
      data: { keys, nextCost: next?.costValue || 0 },
    });
  },
};
