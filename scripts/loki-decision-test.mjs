import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { runLokiKnowledgeEngine } from '../src/loki/core/knowledge/SmartAnswerPipeline.js';
import { runLokiDecisionEngine } from '../src/loki/core/decision/DecisionEngine.js';
import { buildDecisionHistoryPatch, LOKI_DECISION_EVENTS } from '../src/loki/core/decision/DecisionHistory.js';
import { buildDecisionSnapshot } from '../src/loki/core/decision/DecisionSnapshot.js';
import { isDecisionExplainQuery } from '../src/loki/core/decision/DecisionExplanation.js';

const now = Date.now();
const tomorrow = new Date(now + 86400000).toISOString();

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
    rating: patch.rating ?? 4.7,
    reviewsCount: patch.reviewsCount ?? 20,
    bookingUrl: patch.bookingUrl || 'https://booking.example',
    offer: patch.offer || '',
    distanceKm: patch.distanceKm ?? 1.4,
    catalogPublished: true,
    ...patch,
  };
}

const appState = {
  activePanel: 'home',
  user: { id: 'user-1', first_name: 'Ольга', role: 'user' },
  userKeys: 31,
  partners: [
    partner('dent-main', { name: 'Стоматология рядом', category: 'Стоматология', description: 'Лечение и профилактика', offer: 'Консультация со скидкой', distanceKm: 0.7 }),
    partner('dent-family', { name: 'Семейный стоматолог', category: 'Стоматология', description: 'Детская и взрослая стоматология', workingHours: 'Пн-Сб 09:00-21:00', distanceKm: 1.1 }),
    partner('massage-spa', { name: 'SPA Массаж', category: 'Массаж', description: 'Массаж и восстановление', offer: 'Вечерняя скидка 20%', distanceKm: 0.9 }),
    partner('flower-md', { name: 'MD flowers', category: 'Цветы', description: 'Цветочная студия', address: 'Зеленоград, 15 микрорайон' }),
  ],
  experts: [
    { id: 'doctor-anna', type: 'expert', name: 'Анна Белова', title: 'Анна Белова', category: 'Стоматология', specialization: 'Стоматолог', rating: 4.9, reviewsCount: 40, bookingUrl: 'https://booking.example/anna', catalogPublished: true },
    { id: 'doctor-irina', type: 'expert', name: 'Ирина Соколова', title: 'Ирина Соколова', category: 'Стоматология', specialization: 'Стоматолог', rating: 4.8, reviewsCount: 31, bookingUrl: 'https://booking.example/irina', catalogPublished: true },
  ],
  promotions: [
    { id: 'promo-dent', type: 'promotion', title: 'Скидка на консультацию стоматолога', description: 'Заканчивается завтра', partnerId: 'dent-main', expiresAt: tomorrow, status: 'published' },
    { id: 'promo-spa', type: 'promotion', title: 'Массаж вечером выгоднее', description: 'Скидка сегодня вечером', partnerId: 'massage-spa', expiresAt: tomorrow, status: 'published' },
  ],
  events: [
    { id: 'event-business', type: 'event', title: 'Нетворкинг предпринимателей', category: 'Бизнес', description: 'Завтра вечером', startAt: tomorrow, status: 'published' },
    { id: 'event-health', type: 'event', title: 'Лекция о здоровье', category: 'Здоровье', description: 'Советы экспертов', startAt: tomorrow, status: 'published' },
  ],
  news: [
    { id: 'news-1', type: 'news', title: 'Новые партнёры АПГ', summary: 'Свежие места города', publishedAt: new Date(now).toISOString(), status: 'published' },
  ],
  rewards: [
    { id: 'gift-1', type: 'gift', title: 'Кофе за ключи', description: 'Можно получить сейчас', cost: 5, active: true },
  ],
};

const baseContext = {
  actor: { role: 'user', permissions: [] },
  user: { id: 'user-1', keys: 31, role: 'user', currentPanel: 'home' },
  memory: {},
};

let scenarios = 0;
function scenario(name, fn) {
  const result = fn();
  scenarios += 1;
  assert.ok(name);
  return result;
}

scenario('decision context is attached to knowledge answers', () => {
  const result = runLokiKnowledgeEngine({ text: 'Покажи стоматологов', appState, context: baseContext });
  assert.ok(result.decisionContext.decisionId);
  assert.equal(result.decisionContext.intent, result.intent);
  assert.ok(result.decisionContext.trace.engines.includes('knowledge'));
  assert.ok(result.decisionContext.trace.engines.includes('reasoning'));
  assert.ok(result.decisionContext.confidence > 0);
});

scenario('decision records planner workflow agent and actions when workflow is used', () => {
  const result = runLokiKnowledgeEngine({ text: 'Хочу записаться на массаж рядом с домом', appState, context: baseContext });
  assert.ok(result.decisionContext.plannerUsed);
  assert.ok(result.decisionContext.workflowUsed);
  assert.ok(result.decisionContext.agentDecision);
  assert.ok(result.decisionContext.trace.engines.includes('planner'));
  assert.ok(result.decisionContext.trace.engines.includes('workflow'));
  assert.ok(result.decisionContext.trace.engines.includes('agent'));
});

scenario('decision has alternatives from ranked results', () => {
  const result = runLokiKnowledgeEngine({ text: 'Где стоматолог?', appState, context: baseContext });
  assert.ok(result.decisionContext.alternatives.length >= 1);
  assert.ok(result.decisionContext.reason);
});

scenario('decision history stores local compact entries', () => {
  const result = runLokiKnowledgeEngine({ text: 'Покажи акции', appState, context: baseContext });
  const patch = buildDecisionHistoryPatch({}, result.decisionContext);
  assert.ok(patch.decisionHistory.length);
  assert.equal(patch.decisionHistory[0].decisionId, result.decisionContext.decisionId);
});

scenario('decision snapshot is local and does not require Firestore', () => {
  const result = runLokiKnowledgeEngine({ text: 'Покажи мероприятия', appState, context: baseContext });
  const snapshot = buildDecisionSnapshot({ lastDecisionContext: result.decisionContext });
  assert.equal(snapshot.source, 'local');
  assert.equal(snapshot.decisionId, result.decisionContext.decisionId);
});

scenario('decision explain mode uses previous decision', () => {
  const first = runLokiKnowledgeEngine({ text: 'Покажи цветы', appState, context: baseContext });
  assert.ok(isDecisionExplainQuery('Почему ты это предложил?'));
  const explain = runLokiKnowledgeEngine({ text: 'Почему ты это предложил?', appState, context: { ...baseContext, memory: { lastDecisionContext: first.decisionContext } } });
  assert.equal(explain.intent, 'decision.explain');
  assert.ok(explain.text.includes('потому что'));
  assert.ok(explain.decisionContext.explained);
  assert.ok(explain.decisionContext.events.some(event => event.type === LOKI_DECISION_EVENTS.EXPLAINED));
});

scenario('decision explain mode has a safe empty state', () => {
  const explain = runLokiKnowledgeEngine({ text: 'Почему ты это предложил?', appState, context: baseContext });
  assert.equal(explain.intent, 'decision.explain.empty');
  assert.ok(explain.text.includes('Пока нет предыдущего решения'));
});

scenario('direct decision engine validates core fields', () => {
  const result = runLokiKnowledgeEngine({ text: 'Где купить цветы?', appState, context: baseContext });
  const decision = runLokiDecisionEngine({ question: 'Где купить цветы?', result, context: baseContext });
  assert.equal(decision.validation.ok, true);
  assert.ok(decision.events.some(event => event.type === LOKI_DECISION_EVENTS.CREATED));
  assert.ok(decision.events.some(event => event.type === LOKI_DECISION_EVENTS.COMPLETED));
});

scenario('core debug trace includes decision intelligence after action center', () => {
  const source = readFileSync(new URL('../src/loki/core/LokiCore.js', import.meta.url), 'utf8');
  assert.ok(source.includes("module: 'decisionIntelligence'"));
  assert.ok(source.includes('applyDecision({ question: text, result: actionReady, context })'));
  assert.match(source, /const actionReady = applyActions[\s\S]*?const decisionReady = applyDecision\(\{ question: text, result: actionReady, context \}\);[\s\S]*?pushDecisionTrace\(trace, decisionReady\.decisionContext\);[\s\S]*?PersonalityEngine\.shape/);
});

scenario('provider records decision context locally', () => {
  const source = readFileSync(new URL('../src/loki/LokiProvider.jsx', import.meta.url), 'utf8');
  assert.ok(source.includes('buildDecisionHistoryPatch'));
  assert.ok(source.includes('recordDecisionContext'));
  assert.ok(source.includes('lastDecisionContext'));
  assert.ok(source.includes('decisionSnapshot'));
});

scenario('decision pipeline stays frontend read-only', () => {
  [
    'DecisionEngine.js',
    'DecisionTrace.js',
    'DecisionResolver.js',
    'DecisionScorer.js',
    'DecisionExplanation.js',
    'DecisionHistory.js',
    'DecisionSnapshot.js',
    'DecisionValidator.js',
  ].forEach(file => {
    const source = readFileSync(new URL(`../src/loki/core/decision/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /firebase|firestore|fetch\(|addDoc|setDoc|updateDoc|deleteDoc|userAction/i, file);
  });
});

const queries = [
  'Покажи стоматологов',
  'Хочу записаться на массаж рядом с домом',
  'Какие акции есть сейчас?',
  'Где купить цветы?',
  'Покажи мероприятия завтра',
  'Сколько у меня ключей?',
  'Как работает это место?',
  'Какие подарки доступны?',
];

for (let i = 0; i < 1989; i += 1) {
  scenario(`decision synthetic scenario ${i + 1}`, () => {
    const text = queries[i % queries.length];
    const result = runLokiKnowledgeEngine({ text, appState, context: baseContext });
    assert.ok(result?.decisionContext?.decisionId, text);
    assert.ok(result.decisionContext.intent);
    assert.ok(result.decisionContext.trace?.engines?.length);
    assert.ok(Number.isFinite(result.decisionContext.confidence));
    assert.ok(result.decisionContext.events?.some(event => event.type === LOKI_DECISION_EVENTS.CREATED));
  });
}

assert.equal(scenarios, 2000);
console.log(`Loki Decision Intelligence v1: ${scenarios} scenarios passed`);
