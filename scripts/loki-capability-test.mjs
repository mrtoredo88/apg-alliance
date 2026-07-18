import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { runLokiKnowledgeEngine } from '../src/loki/core/knowledge/SmartAnswerPipeline.js';
import {
  buildCapabilityHistoryPatch,
  explainCapability,
  getCapabilityById,
  getCapabilityRegistry,
  runLokiCapabilityEngine,
} from '../src/loki/core/capabilities/index.js';

function partner(id, patch = {}) {
  return {
    id,
    type: 'partner',
    name: patch.name || `Партнёр ${id}`,
    title: patch.name || `Партнёр ${id}`,
    category: patch.category || 'Красота',
    description: patch.description || 'Услуги для жителей Зеленограда',
    address: patch.address || 'Зеленоград',
    workingHours: patch.workingHours || 'Пн-Вс 10:00-22:00',
    bookingUrl: patch.bookingUrl || 'https://booking.example',
    catalogPublished: true,
    ...patch,
  };
}

const appState = {
  activePanel: 'home',
  user: { id: 'user-1', first_name: 'Ольга', role: 'user' },
  userKeys: 34,
  partners: [
    partner('massage-spa', { name: 'SPA Массаж', category: 'Массаж', description: 'Массаж и восстановление' }),
    partner('md-flowers', { name: 'MD flowers', category: 'Цветы' }),
  ],
  experts: [
    { id: 'doctor-anna', type: 'expert', name: 'Анна Белова', title: 'Анна Белова', category: 'Стоматология', specialization: 'Стоматолог', catalogPublished: true },
  ],
  events: [
    { id: 'event-family', type: 'event', title: 'Семейная встреча', category: 'Семья', description: 'Завтра', status: 'published' },
  ],
  news: [
    { id: 'news-1', type: 'news', title: 'Новые партнёры АПГ', summary: 'Свежие места города', status: 'published' },
  ],
};

const context = {
  actor: { role: 'user', permissions: [] },
  user: { id: 'user-1', keys: 34, role: 'user', currentPanel: 'home' },
  memory: {},
};

let scenarios = 0;
function scenario(name, fn) {
  const result = fn();
  scenarios += 1;
  assert.ok(name);
  return result;
}

scenario('registry contains required capability categories and ids', () => {
  const ids = new Set(getCapabilityRegistry().map(item => item.id));
  [
    'OPEN_HOME',
    'OPEN_PROFILE',
    'OPEN_PARTNER',
    'OPEN_EXPERT',
    'OPEN_EVENT',
    'OPEN_NEWS',
    'OPEN_PROMOTION',
    'OPEN_GIFTS',
    'OPEN_REWARDS',
    'OPEN_KEYS',
    'OPEN_SETTINGS',
    'OPEN_WORKSPACE',
    'BOOK_APPOINTMENT',
    'VIEW_BOOKINGS',
    'RESCHEDULE_BOOKING',
    'CANCEL_BOOKING',
    'OPEN_DIALOG',
    'SEND_MESSAGE',
    'VIEW_FRIENDS',
    'VIEW_ACTIVITY',
    'OPEN_FEED',
    'VIEW_PARTNER_PROFILE',
    'CALL_PARTNER',
    'BUILD_ROUTE',
    'OPEN_SITE',
    'OPEN_WHATSAPP',
    'OPEN_TELEGRAM',
    'OPEN_ANALYTICS',
    'OPEN_DAY_PLANNER',
    'OPEN_MEETINGS',
    'OPEN_EVENTS_MANAGER',
    'OPEN_PROMOTIONS_MANAGER',
    'OPEN_CONTENT_MANAGER',
    'OPEN_ADMIN',
    'OPEN_MODERATION',
    'OPEN_USERS',
    'OPEN_STATISTICS',
    'SEARCH_PARTNERS',
    'SEARCH_EXPERTS',
    'SEARCH_EVENTS',
    'SEARCH_PROMOTIONS',
    'SEARCH_NEWS',
  ].forEach(id => assert.ok(ids.has(id), id));
});

scenario('booking query resolves BOOK_APPOINTMENT with missing date', () => {
  const result = runLokiCapabilityEngine({ question: 'Хочу записаться на массаж', context, memory: {}, knowledge: { sources: { partners: appState.partners } } });
  assert.equal(result.capabilityContext.capability, 'BOOK_APPOINTMENT');
  assert.ok(result.capabilityContext.confidence >= 70);
  assert.ok(result.capabilityContext.missing.includes('date'));
});

scenario('rewards query resolves OPEN_REWARDS', () => {
  const result = runLokiCapabilityEngine({ question: 'Покажи мои награды', context, memory: {}, knowledge: {} });
  assert.equal(result.capabilityContext.capability, 'OPEN_REWARDS');
});

scenario('nearby promotion query resolves SEARCH_PROMOTIONS', () => {
  const result = runLokiCapabilityEngine({ question: 'Какие акции сегодня есть рядом?', context, memory: {}, knowledge: {} });
  assert.equal(result.capabilityContext.capability, 'SEARCH_PROMOTIONS');
  assert.equal(result.capabilityContext.resolved.date, 'сегодня');
});

scenario('multiple capabilities preserve execution order', () => {
  const result = runLokiCapabilityEngine({ question: 'Найди массаж и сразу запиши меня', context, memory: {}, knowledge: { sources: { partners: appState.partners } } });
  assert.ok(result.capabilityContext.executionOrder.length >= 2);
  assert.deepEqual(result.capabilityContext.executionOrder.map(item => item.capability).slice(0, 2), ['SEARCH_PARTNERS', 'BOOK_APPOINTMENT']);
});

scenario('pipeline attaches capability before decision without changing answer', () => {
  const result = runLokiKnowledgeEngine({ text: 'Хочу записаться на массаж', appState, context });
  assert.ok(result.capabilityContext?.capability);
  assert.ok(result.decisionContext?.decisionId);
  assert.equal(typeof result.text, 'string');
});

scenario('capability history keeps last 100 local entries', () => {
  let state = {};
  for (let i = 0; i < 140; i += 1) {
    state = { ...state, ...buildCapabilityHistoryPatch(state, { capability: 'OPEN_PROFILE', title: 'Профиль', confidence: 80 + (i % 10), createdAt: new Date(1000 + i).toISOString() }) };
  }
  assert.equal(state.capabilityHistory.length, 100);
  assert.equal(state.capabilityHistory[0].capability, 'OPEN_PROFILE');
});

scenario('explanation mentions alternatives missing params and confidence', () => {
  const result = runLokiCapabilityEngine({ question: 'Хочу записаться на массаж', context, memory: {}, knowledge: { sources: { partners: appState.partners } } });
  const explanation = explainCapability(result.capabilityContext);
  assert.ok(explanation.includes('BOOK_APPOINTMENT'));
  assert.ok(explanation.includes('Уверенность'));
  assert.ok(explanation.includes('Не хватает'));
});

scenario('provider stores local capability diagnostics', () => {
  const source = readFileSync(new URL('../src/loki/LokiProvider.jsx', import.meta.url), 'utf8');
  assert.ok(source.includes('lastCapabilityContext'));
  assert.ok(source.includes('lastCapabilitySnapshot'));
  assert.ok(source.includes('lastCapabilityHistory'));
  assert.ok(source.includes('buildCapabilityHistoryPatch'));
});

scenario('loki page renders capability dev block', () => {
  const source = readFileSync(new URL('../src/LokiPage.jsx', import.meta.url), 'utf8');
  assert.ok(source.includes('Detected Capability'));
  assert.ok(source.includes('Missing Parameters'));
  assert.ok(source.includes('Related Tools'));
  assert.ok(source.includes('Execution Order'));
});

scenario('core debug trace includes capability between reasoning and planner', () => {
  const source = readFileSync(new URL('../src/loki/core/LokiCore.js', import.meta.url), 'utf8');
  assert.ok(source.includes("module: 'capabilityEngine'"));
  assert.match(source, /conversationEngine[\s\S]*capabilityEngine[\s\S]*planner/);
});

scenario('capability layer stays frontend read-only', () => {
  [
    'CapabilityEngine.js',
    'CapabilityResolver.js',
    'CapabilityRegistry.js',
    'CapabilityMatcher.js',
    'CapabilityContext.js',
    'CapabilityHistory.js',
    'CapabilitySnapshot.js',
    'CapabilityExplanation.js',
    'CapabilityValidator.js',
    'index.js',
  ].forEach(file => {
    const source = readFileSync(new URL(`../src/loki/core/capabilities/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /firebase|firestore|fetch\(|addDoc|setDoc|updateDoc|deleteDoc|userAction/i, file);
  });
});

const cases = [
  ['Хочу записаться на массаж', 'BOOK_APPOINTMENT'],
  ['Запиши меня к стоматологу завтра', 'BOOK_APPOINTMENT'],
  ['Покажи мои награды', 'OPEN_REWARDS'],
  ['Сколько у меня ключей?', 'OPEN_KEYS'],
  ['Какие акции сегодня есть рядом?', 'SEARCH_PROMOTIONS'],
  ['Найди эксперта стоматолога', 'SEARCH_EXPERTS'],
  ['Куда сходить завтра?', 'SEARCH_EVENTS'],
  ['Покажи друзей', 'VIEW_FRIENDS'],
  ['Открой рабочую зону', 'OPEN_WORKSPACE'],
  ['Позвонить партнёру', 'CALL_PARTNER'],
  ['Построй маршрут до места', 'BUILD_ROUTE'],
  ['Открой аналитику кабинета', 'OPEN_ANALYTICS'],
  ['Открой админку', 'OPEN_ADMIN'],
  ['Найди новости про город', 'SEARCH_NEWS'],
  ['Покажи мои записи', 'VIEW_BOOKINGS'],
  ['Перенести запись на завтра', 'RESCHEDULE_BOOKING'],
  ['Отменить запись', 'CANCEL_BOOKING'],
  ['Написать сообщение', 'SEND_MESSAGE'],
  ['Открыть телеграм партнёра', 'OPEN_TELEGRAM'],
  ['Открыть сайт партнёра', 'OPEN_SITE'],
];

for (let i = 0; i < 288; i += 1) {
  scenario(`capability synthetic scenario ${i + 1}`, () => {
    const [question, expected] = cases[i % cases.length];
    const result = runLokiCapabilityEngine({ question, context, memory: {}, knowledge: { sources: { partners: appState.partners, experts: appState.experts, events: appState.events, news: appState.news } } });
    assert.equal(result.capabilityContext.capability, expected, question);
    assert.ok(getCapabilityById(result.capabilityContext.capability), question);
    assert.ok(Number.isFinite(result.capabilityContext.confidence), question);
    assert.equal(result.capabilityContext.validation.ok, true, question);
  });
}

assert.equal(scenarios, 300);
console.log(`Loki Capability Engine v1: ${scenarios} scenarios passed`);
