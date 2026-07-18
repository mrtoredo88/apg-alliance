import { TOOL_IDS } from '../../tools/ToolRegistry.js';

export const EventWorkflow = {
  id: 'event',
  title: 'Мероприятие',
  goals: ['JOIN_EVENT', 'FIND_VALUE_PLACE', 'PLAN_DAY'],
  plannerGoals: ['FIND_VALUE_PLACE', 'PLAN_DAY'],
  intents: ['planner.evening_discounts', 'planner.day_plan', 'search.events'],
  keywords: ['мероприят', 'событ', 'афиш', 'сходить', 'посетить', 'регистрац'],
  reason: 'запрос ведёт к выбору и посещению мероприятия',
  steps: [
    { id: 'search-event', title: 'Найти ближайшие мероприятия', kind: 'tool', toolId: TOOL_IDS.EVENT_UPCOMING },
    { id: 'check-registrations', title: 'Проверить мои регистрации', kind: 'tool', toolId: TOOL_IDS.EVENT_MY_REGISTRATIONS },
    { id: 'open-event', title: 'Открыть карточку мероприятия', kind: 'user_action', actionId: 'OPEN_EVENT', dependencies: ['search-event'] },
    { id: 'register', title: 'Зарегистрироваться', kind: 'user_action', actionId: 'OPEN_EVENT', dependencies: ['open-event'] },
    { id: 'route', title: 'Построить маршрут', kind: 'user_action', actionId: 'OPEN_ROUTE', optional: true, dependencies: ['register'] },
    { id: 'check-in', title: 'Отметиться на событии', kind: 'user_action', actionId: 'SCAN', optional: true, dependencies: ['register'] },
    { id: 'review', title: 'Оставить отзыв', kind: 'user_action', actionId: 'OPEN_REVIEW', optional: true, dependencies: ['check-in'] },
  ],
};
