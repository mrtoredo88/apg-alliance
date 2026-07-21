import { collectMemorySignals } from './memory/MemoryCollector.js';

const LOKI_USER_MEMORY_KEY = 'apg_loki_user_memory_v1';

const CATEGORY_HINTS = [
  ['coffee', ['кофе', 'кофейн', 'капучино']],
  ['food', ['еда', 'поесть', 'ресторан', 'кафе', 'ужин', 'обед', 'пицца']],
  ['wellness', ['массаж', 'спа', 'йога', 'фитнес']],
  ['beauty', ['красота', 'салон', 'маникюр', 'стриж']],
  ['events', ['мероприят', 'событ', 'афиш', 'куда сходить']],
  ['rewards', ['ключ', 'приз', 'розыгрыш', 'подар']],
  ['news', ['новост', 'что нового']],
];

export const DEFAULT_LOKI_USER_MEMORY = {
  favoriteCategories: {},
  interests: [],
  visitedPartners: [],
  favoriteExperts: [],
  frequentQuestions: [],
  preferences: {},
  lastActions: [],
  typicalRoutes: [],
  favoriteLanguage: 'ru',
  frequentIntents: {},
  queryHours: {},
  lastQueries: [],
  lokiMemory: null,
  experienceMemory: [],
  feedbackEvents: [],
  knowledgeCandidates: [],
  unknownTopics: [],
  lastExperience: null,
  lastFeedback: null,
  lastQuality: null,
  updatedAt: null,
};

export function loadLokiUserMemory() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOKI_USER_MEMORY_KEY) || '{}');
    return { ...DEFAULT_LOKI_USER_MEMORY, ...(raw && typeof raw === 'object' ? raw : {}) };
  } catch {
    return DEFAULT_LOKI_USER_MEMORY;
  }
}

export function saveLokiUserMemory(memory) {
  try {
    localStorage.setItem(LOKI_USER_MEMORY_KEY, JSON.stringify({ ...DEFAULT_LOKI_USER_MEMORY, ...memory, updatedAt: new Date().toISOString() }));
  } catch {}
}

export function clearLokiUserMemory() {
  try {
    localStorage.removeItem(LOKI_USER_MEMORY_KEY);
  } catch {}
}

export function clearLokiUserMemoryItem(type, key) {
  const memory = loadLokiUserMemory();
  const value = memory?.[type];
  if (Array.isArray(value)) {
    saveLokiUserMemory({ ...memory, [type]: value.filter(item => String(item) !== String(key)) });
    return loadLokiUserMemory();
  }
  if (value && typeof value === 'object') {
    const nextValue = { ...value };
    delete nextValue[key];
    saveLokiUserMemory({ ...memory, [type]: nextValue });
    return loadLokiUserMemory();
  }
  return memory;
}

export function mergeLokiLearningPatch(memory, patch = {}) {
  if (!patch || typeof patch !== 'object') return memory;
  const next = { ...memory, ...patch };
  saveLokiUserMemory(next);
  return { ...DEFAULT_LOKI_USER_MEMORY, ...next, updatedAt: new Date().toISOString() };
}

export function learnFromLokiQuery(memory, query, result) {
  const text = String(query ?? '').toLowerCase().replace(/ё/g, 'е');
  const favoriteCategories = { ...(memory?.favoriteCategories ?? {}) };
  const frequentIntents = { ...(memory?.frequentIntents ?? {}) };
  const queryHours = { ...(memory?.queryHours ?? {}) };
  const hour = new Date().getHours();
  const bucket = hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'day' : 'evening';
  for (const [category, words] of CATEGORY_HINTS) {
    if (words.some(word => text.includes(word))) favoriteCategories[category] = (favoriteCategories[category] ?? 0) + 1;
  }
  if (result?.intent) frequentIntents[result.intent] = (frequentIntents[result.intent] ?? 0) + 1;
  queryHours[bucket] = (queryHours[bucket] ?? 0) + 1;
  const lastQueries = [text].filter(Boolean).concat(memory?.lastQueries ?? []).slice(0, 8);
  const collected = collectMemorySignals({ memory: memory?.lokiMemory, query: text, result });
  const learningPatch = result?.learningPatch && typeof result.learningPatch === 'object' ? result.learningPatch : {};
  const next = { ...learningPatch, favoriteCategories: { ...favoriteCategories, ...(learningPatch.favoriteCategories || {}) }, frequentIntents, queryHours, lastQueries, lokiMemory: collected.memory };
  saveLokiUserMemory(next);
  return { ...DEFAULT_LOKI_USER_MEMORY, ...next, updatedAt: new Date().toISOString() };
}
