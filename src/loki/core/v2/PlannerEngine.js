const EVENT_PLAN = [
  { id: 'event.draft', title: 'Создать черновик события', requiredPermission: 'draft:content' },
  { id: 'news.draft', title: 'Подготовить черновик новости', requiredPermission: 'draft:content' },
  { id: 'poster.draft', title: 'Сформировать техническое задание на афишу', requiredPermission: 'draft:content' },
  { id: 'vk.draft', title: 'Подготовить публикацию ВКонтакте', requiredPermission: 'draft:content' },
  { id: 'experts.match', title: 'Подобрать подходящих экспертов', requiredPermission: 'read:public' },
  { id: 'calendar.check', title: 'Проверить даты и пересечения', requiredPermission: 'read:admin' },
  { id: 'push.draft', title: 'Подготовить черновик уведомления', requiredPermission: 'draft:operations' },
];

export const PlannerEngine = {
  id: 'plannerEngine',
  canHandle({ query }) {
    const text = String(query || '').toLowerCase();
    return ['хочу провести мероприятие', 'создать мероприятие', 'организовать событие'].some(phrase => text.includes(phrase));
  },
  handle({ context }) {
    const role = context?.actor?.role || 'user';
    const allowed = role === 'owner' || role === 'super_admin' || role === 'admin' || role === 'editor';
    return {
      intent: 'planner.event_creation',
      text: allowed
        ? 'Собрал рабочий план мероприятия. Все изменения сначала создаются как черновики и требуют подтверждения.'
        : 'Я могу собрать план мероприятия, но создание черновиков доступно только роли с соответствующими правами.',
      plan: EVENT_PLAN.map((step, index) => ({ ...step, order: index + 1, status: 'pending', executable: allowed })),
      requiresConfirmation: true,
      cards: [],
    };
  },
};
