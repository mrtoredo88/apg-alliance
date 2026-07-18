import { buildToolResult, isNew, isSameDay, itemDate, list, text } from '../ToolResult.js';

function promotions(knowledge = {}) {
  return list(knowledge.sources?.promotions).sort((a, b) => itemDate(b) - itemDate(a));
}

function expiresAt(item = {}) {
  return item.expiresAt || item.endAt || item.endsAt || item.validUntil || item.dateTo || item.until || null;
}

function answer(rows, method, label) {
  return buildToolResult({
    tool: 'promotion',
    method,
    title: 'акции',
    text: rows.length
      ? `${label}: ${rows.slice(0, 3).map(item => `«${text(item.title || item.partnerTitle, 80)}»`).join(', ')}.`
      : `По текущим данным ${label.toLowerCase()} не нашёл.`,
    items: rows,
    itemType: 'promotion',
    data: { count: rows.length },
  });
}

export const PromotionTool = {
  active({ knowledge }) {
    return answer(promotions(knowledge).slice(0, 5), 'active', 'Активные акции');
  },

  expiring({ knowledge }) {
    return answer(promotions(knowledge).filter(item => expiresAt(item)).sort((a, b) => itemDate({ date: expiresAt(a) }) - itemDate({ date: expiresAt(b) })).slice(0, 5), 'expiring', 'Акции, которые скоро заканчиваются');
  },

  expiringToday({ knowledge }) {
    return answer(promotions(knowledge).filter(item => isSameDay(expiresAt(item), 0)), 'expiringToday', 'Акции заканчиваются сегодня');
  },

  expiringTomorrow({ knowledge }) {
    return answer(promotions(knowledge).filter(item => isSameDay(expiresAt(item), 1)), 'expiringTomorrow', 'Акции заканчиваются завтра');
  },

  new({ knowledge }) {
    return answer(promotions(knowledge).filter(item => isNew(item, 7)).slice(0, 5), 'new', 'Новые акции');
  },
};
