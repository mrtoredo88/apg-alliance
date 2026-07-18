import { TOOL_IDS } from '../../tools/ToolRegistry.js';

export const PartnerWorkflow = {
  id: 'partner',
  title: 'Партнёр',
  goals: ['FIND_PARTNER', 'CONTACT_PARTNER', 'FIND_VALUE_PLACE'],
  plannerGoals: ['FIND_VALUE_PLACE'],
  intents: ['search.partners', 'context.card', 'planner.evening_discounts'],
  keywords: ['партн', 'салон', 'магазин', 'кафе', 'цвет', 'скидк', 'акци', 'рядом'],
  reason: 'запрос ведёт к выбору партнёра и действиям в его карточке',
  steps: [
    { id: 'find-partner', title: 'Найти партнёров', kind: 'tool', toolId: TOOL_IDS.PARTNER_FIND, paramsFromQuestion: true },
    { id: 'promotions', title: 'Проверить акции', kind: 'tool', toolId: TOOL_IDS.PROMOTION_ACTIVE },
    { id: 'open-partner', title: 'Открыть карточку', kind: 'user_action', actionId: 'OPEN_PARTNER', dependencies: ['find-partner'] },
    { id: 'contact', title: 'Связаться', kind: 'user_action', actionId: 'CONTACT', optional: true, dependencies: ['open-partner'] },
    { id: 'route', title: 'Построить маршрут', kind: 'user_action', actionId: 'OPEN_ROUTE', optional: true, dependencies: ['open-partner'] },
  ],
};
