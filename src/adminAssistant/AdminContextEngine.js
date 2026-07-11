const TAB_TITLES = {
  dashboard: 'Главная', users: 'Пользователи', partners: 'Партнёры', experts: 'Эксперты', news: 'Новости',
  events: 'Мероприятия', 'events-center': 'Центр событий', comments: 'Комментарии', moderation: 'Модерация',
  activity: 'Ключи и активность', prizes: 'Призы', rotation: 'QR и ротация', analytics: 'Статистика',
  notifs: 'Рассылки', errors: 'Ошибки', access: 'Журнал действий и доступ', system: 'Настройки системы',
  banners: 'Реклама', tasks: 'Задания', automation: 'Автоматизация', referrals: 'Рефералы',
  'loki-knowledge': 'База знаний Локи', 'loki-analytics': 'Аналитика Локи', 'ai-import': 'ИИ-импорт',
};

function cleanObject(value) {
  return Object.fromEntries(Object.entries(value || {}).filter(([, item]) => item !== null && item !== undefined && item !== ''));
}

export function buildAdminContext({ activeTab, role, permissions, filters, search, sort, selected, data, loadedAt }) {
  const section = activeTab || 'dashboard';
  return Object.freeze({
    version: 1,
    section,
    page: TAB_TITLES[section] || section,
    role: role || 'unknown',
    permissions: Array.isArray(permissions) ? permissions : [],
    filters: cleanObject(filters),
    search: String(search || '').trim(),
    sort: sort || null,
    selected: cleanObject(selected),
    data: data || {},
    loadedAt: loadedAt || null,
    generatedAt: new Date().toISOString(),
  });
}

export { TAB_TITLES as ADMIN_SECTION_TITLES };
