import { buildToolResult, isNew, list, text } from '../ToolResult.js';

function gifts(knowledge = {}) {
  return list(knowledge.sources?.gifts);
}

function userKeys(knowledge = {}, context = {}, appState = {}) {
  return Number(context.user?.keys ?? knowledge.sources?.userProfile?.keys ?? appState.userKeys ?? 0);
}

export const GiftTool = {
  available({ knowledge, context, appState }) {
    const keys = userKeys(knowledge, context, appState);
    const rows = gifts(knowledge).filter(item => Number(item.cost || item.keys || item.price || 0) <= keys).slice(0, 5);
    return buildToolResult({
      tool: 'gift',
      method: 'available',
      title: 'доступные подарки',
      text: rows.length ? `За ваши ${keys} ключей доступны: ${rows.slice(0, 3).map(item => `«${text(item.title, 80)}»`).join(', ')}.` : `Сейчас не вижу подарков, доступных за ${keys} ключей.`,
      items: rows,
      itemType: 'gift',
      data: { keys, count: rows.length },
    });
  },

  new({ knowledge }) {
    const rows = gifts(knowledge).filter(item => isNew(item, 14)).slice(0, 5);
    return buildToolResult({
      tool: 'gift',
      method: 'new',
      title: 'новые подарки',
      text: rows.length ? `Новые подарки: ${rows.slice(0, 3).map(item => `«${text(item.title, 80)}»`).join(', ')}.` : 'Новых подарков в загруженных данных не вижу.',
      items: rows,
      itemType: 'gift',
      data: { count: rows.length },
    });
  },

  unviewed({ knowledge, context }) {
    const viewed = new Set(list(context.memory?.viewedGiftIds || knowledge.sources?.userProfile?.viewedGiftIds).map(String));
    const rows = gifts(knowledge).filter(item => !viewed.has(String(item.id))).slice(0, 5);
    return buildToolResult({
      tool: 'gift',
      method: 'unviewed',
      title: 'непросмотренные подарки',
      text: rows.length ? `Есть ${rows.length} подарков, которые вы ещё не смотрели.` : 'Все загруженные подарки уже просмотрены или данных о просмотрах нет.',
      items: rows,
      itemType: 'gift',
      data: { count: rows.length },
    });
  },
};
