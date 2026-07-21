import { normalizeTopic, text } from './ConversationLearning.js';

const POSITIVE = ['спасибо', 'помогло', 'класс', 'супер', 'отлично', '👍', 'полезно', 'понятно'];
const NEGATIVE = ['не помогло', 'нет', 'не понял', 'не поняла', 'неправильно', 'это неправильно', 'не то', 'ошибка', '👎'];

export function detectLokiFeedback(message = '', lastExperience = null) {
  const raw = text(message, 240);
  const normalized = normalizeTopic(raw);
  if (!normalized) return null;
  const negative = NEGATIVE.find(item => normalized.includes(item));
  const positive = POSITIVE.find(item => normalized.includes(item));
  if (!negative && !positive) return null;
  return {
    id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    type: negative ? 'negative' : 'positive',
    score: negative ? -1 : 1,
    phrase: negative || positive,
    message: raw,
    relatedExperienceId: lastExperience?.id || '',
    relatedIntent: lastExperience?.intent || '',
    relatedTopic: lastExperience?.topic || '',
  };
}

export function scoreFeedback(events = []) {
  const rows = Array.isArray(events) ? events : [];
  if (!rows.length) return { total: 0, positive: 0, negative: 0, score: 0 };
  const positive = rows.filter(row => Number(row.score || 0) > 0).length;
  const negative = rows.filter(row => Number(row.score || 0) < 0).length;
  return { total: rows.length, positive, negative, score: Math.round(((positive - negative) / rows.length) * 100) };
}
