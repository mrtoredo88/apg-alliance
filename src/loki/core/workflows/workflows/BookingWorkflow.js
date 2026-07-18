import { TOOL_IDS } from '../../tools/ToolRegistry.js';

export const BookingWorkflow = {
  id: 'booking',
  title: 'Запись',
  goals: ['BOOK_SERVICE_WITH_CONTEXT', 'BOOK_SERVICE'],
  plannerGoals: ['BOOK_SERVICE_WITH_CONTEXT'],
  intents: ['planner.book_service_with_context', 'planner.book_nearby_service', 'info.booking'],
  keywords: ['запис', 'запиши', 'массаж', 'стриж', 'маникюр', 'стоматолог', 'услуг'],
  reason: 'запрос похож на сценарий записи к партнёру или специалисту',
  steps: [
    { id: 'find-partner', title: 'Найти подходящего партнёра', kind: 'tool', toolId: TOOL_IDS.PARTNER_FIND, paramsFromQuestion: true },
    { id: 'find-specialist', title: 'Проверить специалистов', kind: 'tool', toolId: TOOL_IDS.EXPERT_FIND, paramsFromQuestion: true },
    { id: 'check-meetings', title: 'Проверить текущие записи', kind: 'tool', toolId: TOOL_IDS.MEETING_LIST },
    { id: 'choose-time', title: 'Выбрать удобное время', kind: 'user_action', actionId: 'OPEN_BOOKING', dependencies: ['find-partner'] },
    { id: 'open-route', title: 'Построить маршрут', kind: 'user_action', actionId: 'OPEN_ROUTE', optional: true, dependencies: ['choose-time'] },
    { id: 'review', title: 'Оставить отзыв после визита', kind: 'user_action', actionId: 'OPEN_REVIEW', optional: true, dependencies: ['choose-time'] },
  ],
};
