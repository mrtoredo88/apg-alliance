import { normalizeText } from '../lokiCoreUtils.js';

const INTENTS = [
  { id: 'search.partners', types: ['partner'], priority: 1, keys: ['партнер', 'партнёр', 'место', 'салон', 'кафе', 'магазин', 'студия', 'где'] },
  { id: 'search.events', types: ['event'], keys: ['мероприят', 'событ', 'афиш', 'встреч', 'мастер-класс', 'куда сходить'] },
  { id: 'search.promotions', types: ['promotion'], keys: ['акци', 'скидк', 'предложен', 'выгод', 'промо'] },
  { id: 'search.gifts', types: ['gift'], keys: ['подар', 'приз', 'розыгрыш', 'награда', 'получить за ключ'] },
  { id: 'search.locations', types: ['location'], priority: 2, keys: ['филиал', 'локац', 'адрес', 'район', 'микрорайон', 'где находится'] },
  { id: 'search.specialists', types: ['expert'], priority: 3, keys: ['специалист', 'эксперт', 'мастер', 'консультац', 'услуг', 'психолог', 'юрист', 'врач', 'коуч', 'наставник'] },
  { id: 'context.card', types: ['partner', 'expert', 'event', 'news', 'location'], keys: ['эта карточка', 'здесь', 'у него', 'у нее', 'у неё', 'об этом', 'расскажи про'] },
  { id: 'info.hours', types: ['partner', 'location'], priority: 4, keys: ['часы', 'график', 'работает', 'открыто', 'закрыто', 'время работы'] },
  { id: 'info.contacts', types: ['partner', 'expert', 'location'], priority: 4, keys: ['контакт', 'телефон', 'позвонить', 'telegram', 'телеграм', 'whatsapp', 'сайт'] },
  { id: 'info.booking', types: ['partner', 'expert', 'location'], priority: 4, keys: ['запис', 'бронь', 'booking', 'свободное время', 'встреча'] },
  { id: 'workspace.question', types: [], priority: 4, keys: ['workspace', 'кабинет', 'аналитик', 'заявк', 'диалог', 'контент', 'черновик'] },
  { id: 'profile.question', types: [], priority: 4, keys: ['мой профиль', 'мои ключи', 'мои данные', 'избранное', 'уведомления', 'сколько ключ'] },
  { id: 'news.question', types: ['news'], keys: ['новост', 'стать', 'публикац', 'лента', 'что нового'] },
  { id: 'reviews.question', types: ['review'], keys: ['отзыв', 'рейтинг', 'оценк', 'мнение'] },
];

function includesAny(query, keys) {
  return keys.some(key => query.includes(normalizeText(key)));
}

function scoreIntent(query, intent) {
  const direct = includesAny(query, intent.keys) ? 8 : 0;
  const words = query.split(/\s+/).filter(word => word.length > 2);
  const keyText = intent.keys.map(normalizeText).join(' ');
  const wordScore = words.reduce((sum, word) => sum + (keyText.includes(word) ? 1 : 0), 0);
  return direct + wordScore;
}

export function detectLokiIntent(text, knowledge = {}) {
  const query = normalizeText(text);
  if (!query) return { id: 'empty', confidence: 1, types: [], query };
  const ranked = INTENTS
    .map(intent => ({ ...intent, score: scoreIntent(query, intent) }))
    .sort((a, b) => b.score - a.score || Number(b.priority || 0) - Number(a.priority || 0));
  const best = ranked[0];
  if (!best || best.score <= 0) {
    const screenType = knowledge.screenContext?.type || '';
    if (['partner', 'expert', 'event', 'news', 'location'].includes(screenType)) {
      return { id: 'context.card', confidence: 0.46, types: [screenType], query, source: 'screen_context' };
    }
    return { id: 'unknown', confidence: 0.1, types: [], query };
  }
  return {
    id: best.id,
    confidence: Math.min(0.98, best.score / 12),
    types: best.types,
    query,
    candidates: ranked.slice(0, 3).map(item => ({ id: item.id, score: item.score })),
  };
}

export function intentNeedsLocalAnswer(intent) {
  return Boolean(intent?.id && intent.id !== 'unknown' && intent.id !== 'empty');
}
