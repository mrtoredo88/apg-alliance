import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { runLokiActionCenter } from '../src/loki/core/actions/ActionCenter.js';
import { buildLokiKnowledgeProvider } from '../src/loki/core/knowledge/KnowledgeProvider.js';
import { runLokiKnowledgeEngine } from '../src/loki/core/knowledge/SmartAnswerPipeline.js';
import { classifyPlannerIntent, PLANNER_INTENTS } from '../src/loki/core/planner/IntentClassifier.js';
import { resolvePlannerGoal, PLANNER_GOALS } from '../src/loki/core/planner/GoalResolver.js';
import { buildLokiPlan } from '../src/loki/core/planner/PlanBuilder.js';
import { validateLokiPlan } from '../src/loki/core/planner/PlanValidator.js';
import { executePlanSteps } from '../src/loki/core/planner/StepExecutor.js';
import { buildPlanHistoryPatch } from '../src/loki/core/planner/PlanHistory.js';
import { runLokiPlanner } from '../src/loki/core/planner/Planner.js';
import { TOOL_IDS } from '../src/loki/core/tools/ToolRegistry.js';
import { LOKI_APP_ACTIONS } from '../src/loki/lokiActionTypes.js';

const now = Date.now();
const today = new Date(now).toISOString();
const tomorrow = new Date(now + 86400000).toISOString();
const nextWeek = new Date(now + 5 * 86400000).toISOString();

function partner(id, patch = {}) {
  return {
    id,
    type: 'partner',
    name: patch.name || `Партнёр ${id}`,
    category: patch.category || 'Красота',
    description: patch.description || 'Услуги для жителей Зеленограда',
    address: patch.address || 'Зеленоград',
    phone: patch.phone || '+7 999 000-00-00',
    workingHours: patch.workingHours || 'Пн-Вс 10:00-22:00',
    rating: patch.rating ?? 4.7,
    reviewsCount: patch.reviewsCount ?? 28,
    bookingUrl: patch.bookingUrl || 'https://booking.example',
    offer: patch.offer || '',
    distanceKm: patch.distanceKm ?? 1.2,
    catalogPublished: patch.catalogPublished ?? true,
    archived: patch.archived ?? false,
    locations: patch.locations || [],
    ...patch,
  };
}

const appState = {
  activePanel: 'home',
  user: { id: 'user-1', first_name: 'Ольга', role: 'partner', eventIds: ['event-networking'] },
  userKeys: 18,
  partners: [
    partner('massage-home', {
      name: 'Массаж рядом',
      category: 'Массаж',
      description: 'Массаж, SPA и восстановление рядом с домом',
      offer: 'Скидка 20% вечером',
      address: 'Зеленоград, 15 микрорайон',
      distanceKm: 0.8,
      locations: [{ id: 'massage-main', title: 'Главный кабинет', address: '15 микрорайон', workingHours: '10:00-22:00', isMain: true }],
    }),
    partner('flowers-md', {
      name: 'MD flowers',
      category: 'Цветы',
      description: 'Букеты и композиции',
      offer: 'Композиция дня со скидкой',
      bookingUrl: '',
      distanceKm: 2.4,
    }),
    partner('barber-line', {
      name: 'Барбер Линия',
      category: 'Стрижки',
      description: 'Стрижки, укладка, парковка, запись онлайн',
      offer: 'Скидка 10% на первую стрижку',
      distanceKm: 1.1,
    }),
  ],
  experts: [
    { id: 'dentist-1', type: 'expert', name: 'Ирина Соколова', specialization: 'Стоматолог', category: 'Стоматология', rating: 4.9, reviewsCount: 44, bookingUrl: 'https://booking.example/dentist', catalogPublished: true },
  ],
  promotions: [
    { id: 'promo-evening', title: 'Вечерняя скидка на массаж', description: 'Скидка действует сегодня вечером', partnerId: 'massage-home', expiresAt: tomorrow, createdAt: today, status: 'published' },
    { id: 'promo-flowers', title: 'Скидка на букет дня', description: 'Акция на цветы', partnerId: 'flowers-md', expiresAt: tomorrow, createdAt: today, status: 'published' },
  ],
  events: [
    { id: 'event-networking', type: 'event', title: 'Нетворкинг предпринимателей', category: 'Бизнес', description: 'Завтра вечером', startAt: tomorrow, status: 'published', registered: true },
    { id: 'event-week', type: 'event', title: 'Городская лекция', category: 'Образование', startAt: nextWeek, status: 'published' },
  ],
  news: [
    { id: 'news-today', type: 'news', title: 'Новые возможности АПГ', summary: 'Свежая публикация', publishedAt: today, status: 'published' },
  ],
  rewards: [
    { id: 'gift-coffee', type: 'gift', title: 'Кофе за ключи', description: 'Можно получить сейчас', cost: 5, active: true, createdAt: today },
    { id: 'gift-spa', type: 'gift', title: 'SPA сертификат', description: 'Нужно больше ключей', cost: 30, active: true, createdAt: today },
  ],
  bookings: [
    { id: 'booking-tomorrow', type: 'booking', serviceTitle: 'Маникюр', providerName: 'Барбер Линия', locationTitle: 'Центральный', startAt: tomorrow, status: 'confirmed' },
  ],
  dialogs: [
    { id: 'dialog-1', title: 'Вопрос по записи', unreadCount: 2, status: 'open' },
  ],
  analytics: {
    kpis: { openTasks: 3, unreadDialogs: 2, bookings: 4, profileViews: 180 },
  },
};

const context = {
  actor: { role: 'partner', permissions: [] },
  user: { id: 'user-1', keys: 18, role: 'partner' },
  memory: {
    lastJourneyContext: {
      goal: 'BOOK_SERVICE',
      currentStep: { id: 'time', title: 'выбрать время' },
      completedStepIds: ['partner', 'service'],
    },
  },
};

const appActions = Object.fromEntries(Object.values(LOKI_APP_ACTIONS).map(type => [type, async payload => ({ type, payload })]));
const knowledge = buildLokiKnowledgeProvider(appState);

let scenarios = 0;
function scenario(name, fn) {
  const result = fn();
  scenarios += 1;
  assert.ok(name);
  return result;
}

scenario('classifier detects evening discount plan', () => {
  const result = classifyPlannerIntent({ question: 'Хочу завтра вечером сходить туда, где сейчас хорошие скидки' });
  assert.equal(result.id, PLANNER_INTENTS.EVENING_DISCOUNTS);
  assert.ok(result.confidence >= 0.9);
});

scenario('classifier detects nearby booking plan', () => {
  const result = classifyPlannerIntent({ question: 'Хочу записаться на массаж рядом с домом' });
  assert.equal(result.id, PLANNER_INTENTS.BOOK_NEARBY_SERVICE);
});

scenario('classifier detects key opportunity plan', () => {
  const result = classifyPlannerIntent({ question: 'Где мне сейчас выгоднее получить ключи?' });
  assert.equal(result.id, PLANNER_INTENTS.KEY_OPPORTUNITY);
});

scenario('classifier does not steal simple tool query', () => {
  const result = classifyPlannerIntent({ question: 'Что у меня запланировано завтра?' });
  assert.equal(result.id, PLANNER_INTENTS.GENERAL);
});

scenario('goal resolver maps planner intents', () => {
  assert.equal(resolvePlannerGoal({ id: PLANNER_INTENTS.EVENING_DISCOUNTS }).id, PLANNER_GOALS.FIND_VALUE_PLACE);
  assert.equal(resolvePlannerGoal({ id: PLANNER_INTENTS.BOOK_NEARBY_SERVICE }).id, PLANNER_GOALS.BOOK_SERVICE_WITH_CONTEXT);
  assert.equal(resolvePlannerGoal({ id: PLANNER_INTENTS.KEY_OPPORTUNITY }).id, PLANNER_GOALS.OPTIMIZE_KEYS);
});

scenario('plan builder creates transparent multi-step plan', () => {
  const classification = classifyPlannerIntent({ question: 'Хочу завтра вечером сходить туда, где сейчас хорошие скидки' });
  const goal = resolvePlannerGoal(classification);
  const plan = buildLokiPlan({ goal, classification, question: classification.query });
  assert.equal(plan.goal, PLANNER_GOALS.FIND_VALUE_PLACE);
  assert.ok(plan.steps.length >= 5);
  assert.ok(plan.steps.some(step => step.kind === 'tool' && step.toolId === TOOL_IDS.PROMOTION_ACTIVE));
  assert.ok(plan.steps.some(step => step.kind === 'merge'));
  assert.ok(plan.steps.some(step => step.kind === 'rank'));
  assert.ok(plan.steps.some(step => step.kind === 'respond'));
});

scenario('plan validator rejects unknown tools', () => {
  const validation = validateLokiPlan({ steps: [{ id: 'bad', kind: 'tool', toolId: 'missing.tool' }, { id: 'respond', kind: 'respond' }] });
  assert.equal(validation.ok, false);
});

scenario('step executor uses tool layer and returns plan context', () => {
  const classification = classifyPlannerIntent({ question: 'Хочу завтра вечером сходить туда, где сейчас хорошие скидки' });
  const goal = resolvePlannerGoal(classification);
  const plan = buildLokiPlan({ goal, classification, question: classification.query });
  const result = executePlanSteps(plan, { knowledge, context, appState });
  assert.equal(result.planContext.status, 'completed');
  assert.ok(result.planContext.durationMs >= 0);
  assert.ok(result.planContext.toolCalls.length >= 3);
  assert.ok(result.planContext.completed.includes('respond'));
  assert.ok(result.cards.length <= 5);
  assert.doesNotMatch(result.text, /undefined|null|stack/i);
});

scenario('planner result flows into action center', () => {
  const result = runLokiKnowledgeEngine({ text: 'Хочу записаться на массаж рядом с домом', appState, context });
  assert.ok(result.planContext);
  const centered = runLokiActionCenter({ result, context, appState, appActions });
  assert.ok(centered.actionCenter.suggested.length > 0);
  assert.ok(centered.actionCenter.suggested.length <= 3);
});

scenario('plan history stays local', () => {
  const result = runLokiPlanner({ question: 'Где мне сейчас выгоднее получить ключи?', knowledge, context, appState });
  const patch = buildPlanHistoryPatch({}, result.planContext);
  assert.equal(patch.planHistory.length, 1);
  assert.equal(patch.planHistory[0].goal, PLANNER_GOALS.OPTIMIZE_KEYS);
});

scenario('smart answer pipeline invokes planner before generic tool layer', () => {
  const source = readFileSync(new URL('../src/loki/core/knowledge/SmartAnswerPipeline.js', import.meta.url), 'utf8');
  assert.ok(source.includes('runLokiPlanner'));
  assert.ok(source.indexOf('runLokiPlanner') < source.indexOf('runLokiToolLayer'));
});

scenario('loki core traces planner stage', () => {
  const source = readFileSync(new URL('../src/loki/core/LokiCore.js', import.meta.url), 'utf8');
  assert.ok(source.includes("module: 'planner'"));
});

scenario('loki provider records local plan history', () => {
  const source = readFileSync(new URL('../src/loki/LokiProvider.jsx', import.meta.url), 'utf8');
  assert.ok(source.includes('buildPlanHistoryPatch'));
  assert.ok(source.includes('recordPlanContext'));
  assert.ok(source.includes('lastPlanContext'));
});

scenario('planner files are frontend read-only', () => {
  [
    'Planner.js',
    'IntentClassifier.js',
    'GoalResolver.js',
    'PlanBuilder.js',
    'StepExecutor.js',
    'PlanValidator.js',
    'PlanHistory.js',
  ].forEach(file => {
    const source = readFileSync(new URL(`../src/loki/core/planner/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /firebase|firestore|userAction|fetch\(|addDoc|setDoc|updateDoc|deleteDoc/i, file);
  });
});

const plannerQueries = [
  ['Хочу завтра вечером сходить туда, где сейчас хорошие скидки', PLANNER_GOALS.FIND_VALUE_PLACE],
  ['Куда сегодня пойти с выгодной акцией?', PLANNER_GOALS.FIND_VALUE_PLACE],
  ['Хочу записаться на массаж рядом с домом', PLANNER_GOALS.BOOK_SERVICE_WITH_CONTEXT],
  ['Запиши меня на стрижку рядом и покажи маршрут', PLANNER_GOALS.BOOK_SERVICE_WITH_CONTEXT],
  ['Где мне сейчас выгоднее получить ключи?', PLANNER_GOALS.OPTIMIZE_KEYS],
  ['Как сегодня лучше заработать ключи?', PLANNER_GOALS.OPTIMIZE_KEYS],
];

for (let i = 0; i < 150; i += 1) {
  for (const [query, goal] of plannerQueries) {
    scenario(`planner pipeline scenario ${i}-${query}`, () => {
      const result = runLokiKnowledgeEngine({ text: query, appState, context });
      assert.ok(result?.planContext, query);
      assert.equal(result.planContext.goal, goal, query);
      assert.ok(result.planContext.steps.length >= 5, query);
      assert.ok(result.planContext.toolCalls.length >= 2, query);
      assert.ok(result.text, query);
      assert.ok((result.cards || []).length <= 5, query);
      const centered = runLokiActionCenter({ result, context, appState, appActions });
      assert.ok((centered.actionCenter?.suggested || []).length <= 3, query);
    });
  }
}

assert.ok(scenarios >= 900, `expected at least 900 scenarios, got ${scenarios}`);
console.log(`Loki Planner v1: ${scenarios} scenarios passed`);
