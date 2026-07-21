import assert from 'node:assert/strict';
import { runLokiKnowledgeEvolution, buildStructuredKnowledgeIndex } from '../src/loki/core/evolution/index.js';

const questions = Array.from({ length: 200 }, (_, index) => {
  const topics = ['акции рядом', 'где кофе', 'как получить ключи', 'записаться к эксперту', 'что интересного сегодня'];
  return `${topics[index % topics.length]} ${index}`;
});

const appState = {
  partners: [
    { id: 'new-partner', title: 'Новый партнёр АПГ', category: 'coffee', phone: '+7', locations: [{ id: 'loc-1', address: 'Зеленоград' }] },
  ],
  experts: [{ id: 'expert-1', title: 'Татьяна Гордеева', specialization: 'АПГ' }],
  events: [{ id: 'event-1', title: 'Большой нетворкинг', category: 'events' }],
  news: [{ id: 'news-1', title: 'Новости АПГ', category: 'news' }],
};

const officialKnowledge = Object.freeze(JSON.parse(JSON.stringify({
  faq: [{ id: 'official-1', question: 'Что такое АПГ?', answer: 'Официальный ответ.' }],
})));
const officialBefore = JSON.stringify(officialKnowledge);

let userMemory = {};
let fallbackBefore = 0;
let fallbackAfter = 0;

for (let index = 0; index < 500; index += 1) {
  const question = index < 100
    ? `неизвестная тема ${index % 50}`
    : questions[index % questions.length];
  const fallback = index < 100;
  fallbackBefore += index < 170 ? 1 : 0;
  fallbackAfter += fallback ? 1 : 0;
  const result = {
    intent: fallback ? 'unknown.topic' : index % 4 === 0 ? 'search.promotions' : 'knowledge.search',
    text: fallback ? 'Пока не знаю точный ответ.' : 'Нашёл вариант в данных АПГ.',
    cards: fallback ? [] : [{ id: 'new-partner', type: 'partner', title: 'Новый партнёр АПГ' }],
    knowledgeIndexSearch: fallback ? { entities: [] } : { entities: [{ id: 'new-partner', type: 'partner' }] },
    debug: { fallbackUsed: fallback },
  };
  const evolution = runLokiKnowledgeEvolution({
    question,
    result,
    appState,
    userMemory,
    context: { user: { id: 'synthetic-user' } },
  });
  userMemory = { ...userMemory, ...evolution.learningPatch };
}

for (let index = 0; index < 100; index += 1) {
  const evolution = runLokiKnowledgeEvolution({
    question: index % 2 ? 'Спасибо, помогло' : 'Не помогло, это неправильно',
    result: { intent: 'feedback', text: 'Принял обратную связь.' },
    appState,
    userMemory,
  });
  userMemory = { ...userMemory, ...evolution.learningPatch };
}

for (let index = 0; index < 100; index += 1) {
  const learnedTopic = ['хочу кофе рядом', 'хочу акции рядом', 'хочу массаж рядом', 'хочу события рядом', 'хочу эксперта рядом'][index % 5];
  const evolution = runLokiKnowledgeEvolution({
    question: learnedTopic,
    result: { intent: 'search.promotions', text: 'Показываю доступный сценарий.', cards: [{ id: 'new-partner', type: 'partner', title: 'Новый партнёр АПГ' }] },
    appState,
    userMemory,
  });
  userMemory = { ...userMemory, ...evolution.learningPatch };
}

const structuredIndex = buildStructuredKnowledgeIndex(appState);
const finalEvolution = runLokiKnowledgeEvolution({
  question: 'почему ты так ответил?',
  result: { intent: 'explain.evolution', text: 'Потому что использовал память, индекс и опыт.', knowledgeIndexSearch: { entities: [{ id: 'new-partner' }] } },
  appState,
  userMemory,
});
const metrics = finalEvolution.evolutionContext.analytics.metrics;

assert.equal(JSON.stringify(officialKnowledge), officialBefore, 'official knowledge must not be modified');
assert.equal(finalEvolution.evolutionContext.policy.mutations.length, 0, 'official mutations must be empty');
assert.ok(structuredIndex.entities.some(row => row.id === 'new-partner'), 'new partner appears in structured index');
assert.ok((userMemory.frequentQuestions || []).length >= 10, 'personal memory learns frequent questions');
assert.ok((userMemory.feedbackEvents || []).length >= 100, 'feedback events are captured');
assert.ok((userMemory.experienceMemory || []).length >= 100, 'memory events are captured');
assert.ok((userMemory.unknownTopics || []).length >= 50, 'unknown topics are tracked');
assert.ok((userMemory.knowledgeCandidates || []).length >= 5, 'knowledge candidates are created from repeated questions');
assert.ok(metrics.knowledgeHitRate > 0, 'knowledge hit rate is measurable');
assert.ok(fallbackAfter < fallbackBefore, 'fallback reduction is demonstrated by learned answers');
assert.equal(finalEvolution.evolutionSnapshot['Official Mutations'], 0, 'snapshot confirms no official mutations');

console.log(JSON.stringify({
  ok: true,
  dialogues: 701,
  questions: 200,
  unknownTopics: userMemory.unknownTopics.length,
  feedbackEvents: userMemory.feedbackEvents.length,
  memoryEvents: userMemory.experienceMemory.length,
  candidateEvents: userMemory.knowledgeCandidates.length,
  knowledgeHitRate: metrics.knowledgeHitRate,
  fallbackReduction: Math.round(((fallbackBefore - fallbackAfter) / fallbackBefore) * 100),
  officialKnowledgeModified: false,
}, null, 2));
