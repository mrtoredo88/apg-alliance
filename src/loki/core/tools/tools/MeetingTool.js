import { buildToolResult, isSameDay, isUpcoming, itemDate, list, text } from '../ToolResult.js';

function meetings(knowledge = {}) {
  return list(knowledge.sources?.bookings || knowledge.sources?.meetings)
    .filter(item => !['cancelled', 'done', 'archived'].includes(String(item.status || '').toLowerCase()))
    .filter(item => isUpcoming(item.startAt || item.date))
    .sort((a, b) => itemDate(a) - itemDate(b));
}

export const MeetingTool = {
  list({ knowledge }) {
    const rows = meetings(knowledge).slice(0, 5);
    return buildToolResult({
      tool: 'meeting',
      method: 'list',
      title: 'мои записи',
      text: rows.length ? `Активные записи: ${rows.slice(0, 3).map(item => `«${text(item.title || item.serviceTitle || item.providerName, 80)}»`).join(', ')}.` : 'В текущих данных не вижу активных записей.',
      items: rows,
      itemType: 'meeting',
      data: { count: rows.length },
    });
  },

  next({ knowledge }) {
    const rows = meetings(knowledge).slice(0, 1);
    return buildToolResult({
      tool: 'meeting',
      method: 'next',
      title: 'ближайшая запись',
      text: rows.length ? `Ближайшая запись: «${text(rows[0].title || rows[0].serviceTitle || rows[0].providerName, 100)}».` : 'Ближайшей активной записи в текущих данных не вижу.',
      items: rows,
      itemType: 'meeting',
      data: { count: rows.length },
    });
  },

  tomorrow({ knowledge }) {
    const rows = meetings(knowledge).filter(item => isSameDay(item.startAt || item.date, 1)).slice(0, 5);
    return buildToolResult({
      tool: 'meeting',
      method: 'tomorrow',
      title: 'завтрашние записи',
      text: rows.length ? `На завтра вижу ${rows.length} записи: ${rows.slice(0, 3).map(item => `«${text(item.title || item.serviceTitle || item.providerName, 80)}»`).join(', ')}.` : 'На завтра в текущих данных записей не вижу.',
      items: rows,
      itemType: 'meeting',
      data: { count: rows.length },
    });
  },
};
