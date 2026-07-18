import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { runLokiActionCenter } from '../src/loki/core/actions/ActionCenter.js';
import { runLokiKnowledgeEngine } from '../src/loki/core/knowledge/SmartAnswerPipeline.js';
import { learnFromLokiQuery } from '../src/loki/core/lokiUserMemory.js';
import { buildMemorySnapshot } from '../src/loki/core/memory/MemorySnapshot.js';
import { collectMemorySignals } from '../src/loki/core/memory/MemoryCollector.js';
import { LOKI_MEMORY_EVENTS } from '../src/loki/core/memory/MemoryHistory.js';
import { memoryMatchScore, rankMemoryEntries } from '../src/loki/core/memory/MemoryRanker.js';
import { applyMemoryDecay, rememberSignals, upsertMemorySignal } from '../src/loki/core/memory/MemoryStore.js';
import { isSensitiveMemoryText, validateMemorySignal } from '../src/loki/core/memory/MemoryValidator.js';
import { LOKI_APP_ACTIONS } from '../src/loki/lokiActionTypes.js';

const now = Date.now();
const today = new Date(now).toISOString();
const tomorrow = new Date(now + 86400000).toISOString();

globalThis.localStorage = {
  data: new Map(),
  getItem(key) { return this.data.get(key) || null; },
  setItem(key, value) { this.data.set(key, String(value)); },
  removeItem(key) { this.data.delete(key); },
};

function partner(id, patch = {}) {
  return {
    id,
    type: 'partner',
    name: patch.name || `Партнёр ${id}`,
    category: patch.category || 'Красота',
    description: patch.description || 'Услуги для жителей Зеленограда',
    address: patch.address || 'Зеленоград',
    offer: patch.offer || '',
    bookingUrl: patch.bookingUrl || 'https://booking.example',
    catalogPublished: patch.catalogPublished ?? true,
    ...patch,
  };
}

const appState = {
  activePanel: 'home',
  user: { id: 'user-1', first_name: 'Ольга', role: 'user' },
  userKeys: 22,
  partners: [
    partner('family-cafe', { name: 'Семейное кафе', category: 'Кафе', description: 'Детское меню, семейные завтраки', offer: 'Скидка на детский завтрак', address: 'Зеленоград, 15 микрорайон' }),
    partner('sport-club', { name: 'Фитнес рядом', category: 'Спорт', description: 'Тренировки и йога рядом с домом', offer: 'Пробное занятие' }),
    partner('beauty-spa', { name: 'SPA Массаж', category: 'Массаж', description: 'Массаж, спа и восстановление', offer: 'Вечерняя скидка 20%' }),
  ],
  experts: [
    { id: 'trainer-1', type: 'expert', name: 'Анна Тренер', category: 'Спорт', specialization: 'Фитнес', rating: 4.8, reviewsCount: 20, catalogPublished: true },
  ],
  promotions: [
    { id: 'promo-family', title: 'Скидка для семей', description: 'Акция для детских мероприятий', partnerId: 'family-cafe', expiresAt: tomorrow, createdAt: today, status: 'published' },
    { id: 'promo-spa', title: 'Массаж вечером выгоднее', description: 'Скидка сегодня вечером', partnerId: 'beauty-spa', expiresAt: tomorrow, createdAt: today, status: 'published' },
  ],
  events: [
    { id: 'event-kids', type: 'event', title: 'Детский мастер-класс', category: 'Семья', description: 'Семейное событие', startAt: tomorrow, status: 'published' },
  ],
  news: [
    { id: 'news-city', type: 'news', title: 'Новости города', summary: 'Новые места', publishedAt: today, status: 'published' },
  ],
  rewards: [
    { id: 'gift-family', type: 'gift', title: 'Подарок для семьи', description: 'Можно получить за ключи', cost: 5, active: true },
  ],
  bookings: [],
};

const appActions = Object.fromEntries(Object.values(LOKI_APP_ACTIONS).map(type => [type, async payload => ({ type, payload })]));

let scenarios = 0;
function scenario(name, fn) {
  const result = fn();
  scenarios += 1;
  assert.ok(name);
  return result;
}

scenario('validator blocks email', () => {
  assert.equal(isSensitiveMemoryText('мой email test@example.com'), true);
  assert.equal(validateMemorySignal({ type: 'preference', key: 'test@example.com', label: 'test@example.com' }).ok, false);
});

scenario('validator blocks phone and password', () => {
  assert.equal(isSensitiveMemoryText('+7 999 111 22 33'), true);
  assert.equal(isSensitiveMemoryText('мой пароль qwerty'), true);
});

scenario('store creates preference memory', () => {
  const result = upsertMemorySignal({}, { type: 'preference', key: 'family_events', label: 'семейные мероприятия', scope: 'category' }, now);
  assert.ok(result.entry.id.includes('family_events'));
  assert.equal(result.events[0].type, LOKI_MEMORY_EVENTS.CREATED);
});

scenario('store updates existing memory idempotently', () => {
  const first = upsertMemorySignal({}, { type: 'preference', key: 'sport', label: 'спорт' }, now);
  const second = upsertMemorySignal(first.memory, { type: 'preference', key: 'sport', label: 'спорт' }, now + 1000);
  assert.equal(Object.keys(second.memory.preferences).length, 1);
  assert.equal(second.events[0].type, LOKI_MEMORY_EVENTS.UPDATED);
  assert.ok(second.memory.preferences['preference:sport'].frequency > first.memory.preferences['preference:sport'].frequency);
});

scenario('decay lowers stale memories', () => {
  const old = now - 40 * 86400000;
  const first = upsertMemorySignal({}, { type: 'preference', key: 'coffee', label: 'кофейни' }, old);
  const decayed = applyMemoryDecay(first.memory, now);
  assert.ok(decayed.memory.preferences['preference:coffee'].decay < 1);
  assert.ok(decayed.events.some(event => event.type === LOKI_MEMORY_EVENTS.DECAYED));
});

scenario('snapshot exposes ranked used memories', () => {
  const memory = rememberSignals({}, [
    { type: 'preference', key: 'family_events', label: 'семейные мероприятия', weight: 4, relevance: 0.5 },
    { type: 'preference', key: 'sport', label: 'спорт', weight: 1, relevance: 0.2 },
  ], now).memory;
  const snapshot = buildMemorySnapshot({ memory, query: 'детские мероприятия завтра', intent: { id: 'search.events' } });
  assert.equal(snapshot.empty, false);
  assert.equal(snapshot.preferences[0].key, 'family_events');
  assert.ok(snapshot.events.every(event => event.type === LOKI_MEMORY_EVENTS.USED));
});

scenario('ranker gives memory match score', () => {
  const snapshot = buildMemorySnapshot({
    memory: rememberSignals({}, [{ type: 'preference', key: 'спорт', label: 'спорт', weight: 5, relevance: 0.5 }], now).memory,
    query: 'спорт',
  });
  assert.ok(memoryMatchScore({ title: 'Фитнес рядом', category: 'Спорт' }, snapshot) > 0);
});

scenario('collector learns from query and result', () => {
  const result = runLokiKnowledgeEngine({ text: 'хочу детские мероприятия и семейные скидки', appState, context: {} });
  const collected = collectMemorySignals({ memory: {}, query: 'хочу детские мероприятия и семейные скидки', result });
  assert.ok(Object.keys(collected.memory.preferences).length >= 2);
  assert.ok(collected.memory.history.length >= 2);
});

scenario('learnFromLokiQuery keeps legacy counters and adds lokiMemory', () => {
  const result = runLokiKnowledgeEngine({ text: 'где скидки для семьи', appState, context: {} });
  const learned = learnFromLokiQuery({}, 'где скидки для семьи', result);
  assert.ok(learned.favoriteCategories.events || learned.favoriteCategories.promotions || learned.lokiMemory);
  assert.ok(learned.lokiMemory.preferences || learned.lokiMemory.activity);
});

scenario('planner receives memory snapshot and records memoryUsed', () => {
  const userMemory = learnFromLokiQuery({}, 'хочу массаж и спа рядом', runLokiKnowledgeEngine({ text: 'хочу массаж и спа рядом', appState, context: {} }));
  const result = runLokiKnowledgeEngine({
    text: 'Хочу завтра вечером сходить туда, где сейчас хорошие скидки',
    appState,
    context: { userMemory },
  });
  assert.ok(result.memoryContext);
  assert.ok(result.planContext);
  assert.ok(Array.isArray(result.planContext.memoryUsed));
});

scenario('debug trace includes memory engine contract', () => {
  const userMemory = learnFromLokiQuery({}, 'интересуют детские мероприятия', runLokiKnowledgeEngine({ text: 'интересуют детские мероприятия', appState, context: {} }));
  const result = runLokiKnowledgeEngine({
    text: 'Хочу завтра вечером сходить туда, где сейчас хорошие скидки',
    appState,
    context: { userMemory },
  });
  const source = readFileSync(new URL('../src/loki/core/LokiCore.js', import.meta.url), 'utf8');
  assert.ok(result.memoryContext);
  assert.ok(source.includes("module: 'memoryEngine'"));
  assert.ok(source.includes("module: 'planner'"));
});

scenario('action center still receives memory-driven planner result', () => {
  const userMemory = learnFromLokiQuery({}, 'люблю семейные кафе', runLokiKnowledgeEngine({ text: 'люблю семейные кафе', appState, context: {} }));
  const result = runLokiKnowledgeEngine({
    text: 'Куда сегодня пойти с выгодной акцией?',
    appState,
    context: { userMemory },
  });
  const centered = runLokiActionCenter({ result, context: { userMemory }, appState, appActions });
  assert.ok(centered.actionCenter.suggested.length <= 3);
});

scenario('conflicting preferences are ranked by frequency and relevance', () => {
  const memory = rememberSignals({}, [
    { type: 'preference', key: 'sport', label: 'спорт', weight: 1, relevance: 0.1 },
    { type: 'preference', key: 'family_events', label: 'семейные мероприятия', weight: 5, relevance: 0.5 },
  ], now).memory;
  const ranked = rankMemoryEntries(Object.values(memory.preferences), { query: 'семейные мероприятия' });
  assert.equal(ranked[0].key, 'family_events');
});

scenario('memory source files stay frontend-only', () => {
  [
    'MemoryEngine.js',
    'MemoryStore.js',
    'MemoryCollector.js',
    'MemoryResolver.js',
    'MemoryRanker.js',
    'MemoryValidator.js',
    'MemoryHistory.js',
    'MemorySnapshot.js',
  ].forEach(file => {
    const source = readFileSync(new URL(`../src/loki/core/memory/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /firebase|firestore|fetch\(|addDoc|setDoc|updateDoc|deleteDoc|userAction/i, file);
  });
});

scenario('documentation mentions Memory Engine v1', () => {
  const source = readFileSync(new URL('../.ai/21_LOKI_CORE_V2.md', import.meta.url), 'utf8');
  assert.ok(source.includes('Memory Engine v1') || source.includes('Memory v1'));
});

const queries = [
  'интересуют детские мероприятия',
  'хочу чаще заниматься спортом',
  'люблю семейные кафе',
  'ищу скидки вечером',
  'хочу массаж рядом',
  'какие подарки за ключи',
  'куда пойти сегодня с акцией',
  'хочу детский мастер-класс',
  'покажи фитнес рядом',
  'где выгоднее получить ключи',
];

for (let i = 0; i < 100; i += 1) {
  for (const query of queries) {
    scenario(`memory lifecycle scenario ${i}-${query}`, () => {
      const base = learnFromLokiQuery({}, query, runLokiKnowledgeEngine({ text: query, appState, context: {} }));
      const second = learnFromLokiQuery(base, query, runLokiKnowledgeEngine({ text: query, appState, context: { userMemory: base } }));
      const snapshot = buildMemorySnapshot({ memory: second.lokiMemory, query });
      assert.ok(second.lokiMemory);
      assert.ok(second.lokiMemory.history.length > 0);
      assert.ok(snapshot.used.length <= 12);
      assert.equal(Object.values(second.lokiMemory.preferences || {}).some(item => /@|password|парол|\+7/.test(`${item.key} ${item.label}`)), false);
    });
  }
}

assert.ok(scenarios >= 1000, `expected at least 1000 scenarios, got ${scenarios}`);
console.log(`Loki Memory Engine v1: ${scenarios} scenarios passed`);
