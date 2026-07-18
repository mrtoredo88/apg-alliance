import { buildToolResult, isSameDay, itemDate, list, text } from '../ToolResult.js';

function news(knowledge = {}) {
  return list(knowledge.sources?.news).sort((a, b) => itemDate(b) - itemDate(a));
}

export const NewsTool = {
  latest({ knowledge }) {
    const rows = news(knowledge).slice(0, 5);
    return buildToolResult({
      tool: 'news',
      method: 'latest',
      title: 'последние новости',
      text: rows.length ? `Последние новости АПГ: ${rows.slice(0, 3).map(item => `«${text(item.title, 80)}»`).join(', ')}.` : 'В загруженных данных пока нет новостей.',
      items: rows,
      itemType: 'news',
      data: { count: rows.length },
    });
  },

  today({ knowledge }) {
    const rows = news(knowledge).filter(item => isSameDay(itemDate(item), 0)).slice(0, 5);
    return buildToolResult({
      tool: 'news',
      method: 'today',
      title: 'новости за сегодня',
      text: rows.length ? `Сегодня появились: ${rows.slice(0, 3).map(item => `«${text(item.title, 80)}»`).join(', ')}.` : 'Сегодняшних новостей в загруженных данных не вижу.',
      items: rows,
      itemType: 'news',
      data: { count: rows.length },
    });
  },
};
