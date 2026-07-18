import { normalizeText } from '../lokiCoreUtils.js';

const TOPIC_DEFINITIONS = [
  { id: 'events', title: 'Мероприятия', types: ['event'], words: ['мероприят', 'событ', 'афиша', 'регистрац'] },
  { id: 'partners', title: 'Партнёры', types: ['partner', 'location'], words: ['партнер', 'партнер', 'салон', 'кафе', 'магазин', 'филиал', 'адрес'] },
  { id: 'experts', title: 'Эксперты', types: ['expert'], words: ['эксперт', 'специалист', 'стоматолог', 'мастер', 'тренер'] },
  { id: 'booking', title: 'Запись', types: ['booking'], words: ['запис', 'бронь', 'время', 'услуг'] },
  { id: 'promotions', title: 'Акции', types: ['promotion'], words: ['акци', 'скидк', 'выгод', 'предлож'] },
  { id: 'gifts', title: 'Подарки', types: ['gift', 'prize'], words: ['подар', 'приз', 'ключ'] },
  { id: 'news', title: 'Новости', types: ['news', 'article'], words: ['новост', 'стат', 'публикац'] },
  { id: 'workspace', title: 'Workspace', types: ['workspace'], words: ['workspace', 'кабинет', 'аналитик', 'диалог'] },
];

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function topicFromType(type = '') {
  return TOPIC_DEFINITIONS.find(topic => topic.types.includes(type)) || null;
}

export function inferConversationTopic({ question = '', intent = {}, result = null, entities = [] } = {}) {
  const query = normalizeText(question);
  const intentId = normalizeText(intent.id || result?.intent || '');
  const fromIntent = TOPIC_DEFINITIONS.find(topic => intentId.includes(topic.id) || topic.words.some(word => intentId.includes(word)));
  if (fromIntent) return fromIntent;
  const fromQuery = TOPIC_DEFINITIONS.find(topic => topic.words.some(word => query.includes(word)));
  if (fromQuery) return fromQuery;
  const firstEntityType = list(entities)[0]?.type || result?.card?.type || list(result?.cards)[0]?.type || '';
  return topicFromType(firstEntityType) || null;
}

export function mergeConversationTopics(previous = [], nextTopic = null) {
  const normalized = list(previous).map(topic => ({
    ...topic,
    active: false,
  }));
  if (!nextTopic?.id) return normalized.slice(0, 8);
  const existing = normalized.filter(topic => topic.id !== nextTopic.id);
  return [{
    id: nextTopic.id,
    title: nextTopic.title,
    active: true,
    touchedAt: new Date().toISOString(),
  }, ...existing].slice(0, 8);
}

export function findTopicByEntityType(type = '') {
  return topicFromType(type);
}
