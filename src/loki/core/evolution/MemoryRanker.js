import { list, normalizeTopic, text } from './ConversationLearning.js';

const MEMORY_LIMIT = 40;
const SENSITIVE_HINTS = ['телефон', 'паспорт', 'карта', 'адрес', 'болезн', 'диагноз', 'пароль', 'код', 'otp', 'email', '@'];
const CATEGORY_HINTS = [
  ['food', ['еда', 'пицц', 'кафе', 'ресторан', 'кофе']],
  ['beauty', ['красот', 'салон', 'маникюр', 'стриж']],
  ['wellness', ['массаж', 'спа', 'йога', 'фитнес']],
  ['events', ['мероприят', 'афиш', 'куда сходить']],
  ['offers', ['акци', 'скидк', 'подар', 'бонус']],
  ['experts', ['эксперт', 'консультац', 'запис']],
];

function incrementMap(source = {}, key = '') {
  if (!key) return source;
  return { ...source, [key]: Number(source[key] || 0) + 1 };
}

function rememberList(source = [], value = '') {
  const item = text(value, 160);
  if (!item) return list(source).slice(0, MEMORY_LIMIT);
  return [item, ...list(source).filter(row => row !== item)].slice(0, MEMORY_LIMIT);
}

export function buildPersonalMemoryPatch({ question = '', result = {}, currentMemory = {} } = {}) {
  const normalized = normalizeTopic(question);
  if (!normalized || SENSITIVE_HINTS.some(word => normalized.includes(word))) {
    return { blocked: true, reason: 'sensitive_or_empty', patch: {} };
  }
  let favoriteCategories = { ...(currentMemory.favoriteCategories || {}) };
  for (const [category, hints] of CATEGORY_HINTS) {
    if (hints.some(word => normalized.includes(word))) favoriteCategories = incrementMap(favoriteCategories, category);
  }
  const entities = list(result?.cards).concat(result?.card || []).filter(Boolean);
  const visitedPartners = entities.filter(row => row.type === 'partner').reduce((acc, row) => rememberList(acc, row.title || row.name || row.id), currentMemory.visitedPartners || []);
  const favoriteExperts = entities.filter(row => row.type === 'expert').reduce((acc, row) => rememberList(acc, row.title || row.name || row.id), currentMemory.favoriteExperts || []);
  return {
    blocked: false,
    reason: '',
    patch: {
      favoriteCategories,
      interests: rememberList(currentMemory.interests, Object.keys(favoriteCategories).sort((a, b) => favoriteCategories[b] - favoriteCategories[a])[0]),
      visitedPartners,
      favoriteExperts,
      frequentQuestions: rememberList(currentMemory.frequentQuestions, normalized),
      preferences: { ...(currentMemory.preferences || {}) },
      lastActions: rememberList(currentMemory.lastActions, result?.executeAction?.type || result?.autoAction?.type || result?.card?.action?.type),
      typicalRoutes: rememberList(currentMemory.typicalRoutes, result?.journeyContext?.route || result?.intent),
      favoriteLanguage: /[a-z]{3,}/i.test(question) && !/[а-я]/i.test(question) ? 'en' : 'ru',
      updatedAt: new Date().toISOString(),
    },
    memoryTypes: ['favoriteCategories', 'interests', 'visitedPartners', 'favoriteExperts', 'frequentQuestions', 'preferences', 'lastActions', 'typicalRoutes', 'favoriteLanguage'],
  };
}
