import { buildToolResult, text } from '../ToolResult.js';

function userData(knowledge = {}, context = {}) {
  return knowledge.sources?.userProfile || context.user || {};
}

function numberOf(...values) {
  const found = values.find(value => Number.isFinite(Number(value)));
  return Number(found || 0);
}

export const UserTool = {
  profile({ knowledge, context, appState }) {
    const user = userData(knowledge, context);
    const keys = numberOf(context.user?.keys, user.keys, user.keyBalance, appState.userKeys);
    const level = numberOf(user.level, user.currentLevel, context.user?.level);
    const achievements = Array.isArray(user.achievements) ? user.achievements.length : numberOf(user.achievementsCount, user.badgesCount);
    const streak = numberOf(user.streak, user.currentStreak);
    const reputation = numberOf(user.reputation, user.rating, user.score);
    return buildToolResult({
      tool: 'user',
      method: 'profile',
      title: 'профиль',
      text: `По профилю: ${text(user.name || user.first_name || context.user?.name || 'пользователь')}. Ключи: ${keys}. Уровень: ${level || 'не указан'}. Достижения: ${achievements}. Серия: ${streak}. Репутация: ${reputation || 'пока без оценки'}.`,
      items: [],
      data: { name: user.name || user.first_name || null, keys, level, achievements, streak, reputation },
    });
  },

  keys({ knowledge, context, appState }) {
    const user = userData(knowledge, context);
    const keys = numberOf(context.user?.keys, user.keys, user.keyBalance, appState.userKeys);
    return buildToolResult({
      tool: 'user',
      method: 'keys',
      title: 'ключи',
      text: `Сейчас у вас ${keys} ${keys === 1 ? 'ключ' : 'ключей'}.`,
      items: [],
      data: { keys },
    });
  },

  points({ knowledge, context, appState }) {
    const user = userData(knowledge, context);
    const points = numberOf(user.points, user.score, user.reputation, context.user?.points, appState.userPoints);
    return buildToolResult({
      tool: 'user',
      method: 'points',
      title: 'баллы',
      text: points ? `Сейчас вижу ${points} баллов/очков в профиле.` : 'В текущих данных профиля отдельные баллы не заполнены. Ключи и уровень доступны в профиле.',
      items: [],
      data: { points },
    });
  },
};
