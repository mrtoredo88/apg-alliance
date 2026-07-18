import { buildToolResult, isSameDay, isUpcoming, itemDate, list, text } from '../ToolResult.js';

function events(knowledge = {}) {
  return list(knowledge.sources?.events).filter(item => isUpcoming(item.startAt || item.date)).sort((a, b) => itemDate(a) - itemDate(b));
}

function registeredEvents(knowledge = {}, context = {}) {
  const ids = new Set(list(context.user?.eventIds || context.user?.registrations || knowledge.sources?.userProfile?.eventIds).map(String));
  return events(knowledge).filter(item => ids.has(String(item.id)) || item.registered === true || item.isRegistered === true);
}

export const EventTool = {
  today({ knowledge }) {
    const rows = events(knowledge).filter(item => isSameDay(item.startAt || item.date, 0));
    return buildToolResult({
      tool: 'event',
      method: 'today',
      title: 'сегодняшние события',
      text: rows.length ? `Сегодня в АПГ вижу ${rows.length} события: ${rows.slice(0, 3).map(item => `«${text(item.title, 80)}»`).join(', ')}.` : 'На сегодня в загруженных данных нет событий.',
      items: rows,
      itemType: 'event',
      data: { count: rows.length },
    });
  },

  upcoming({ knowledge }) {
    const rows = events(knowledge).slice(0, 5);
    return buildToolResult({
      tool: 'event',
      method: 'upcoming',
      title: 'ближайшие события',
      text: rows.length ? `Ближайшие события: ${rows.slice(0, 3).map(item => `«${text(item.title, 80)}»`).join(', ')}.` : 'Ближайших событий в загруженных данных нет.',
      items: rows,
      itemType: 'event',
      data: { count: rows.length },
    });
  },

  myRegistrations({ knowledge, context }) {
    const rows = registeredEvents(knowledge, context);
    return buildToolResult({
      tool: 'event',
      method: 'myRegistrations',
      title: 'мои регистрации',
      text: rows.length ? `Вы зарегистрированы на ${rows.length} события: ${rows.slice(0, 3).map(item => `«${text(item.title, 80)}»`).join(', ')}.` : 'В текущих данных не вижу активных регистраций на события.',
      items: rows,
      itemType: 'event',
      data: { count: rows.length },
    });
  },
};
