import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { runLokiActionCenter } from '../src/loki/core/actions/ActionCenter.js';
import { runLokiKnowledgeEngine } from '../src/loki/core/knowledge/SmartAnswerPipeline.js';
import { runLokiPlanner } from '../src/loki/core/planner/Planner.js';
import { TOOL_IDS } from '../src/loki/core/tools/ToolRegistry.js';
import { LOKI_APP_ACTIONS } from '../src/loki/lokiActionTypes.js';
import {
  buildWorkflowHistoryPatch,
  buildWorkflowPlan,
  buildWorkflowSnapshot,
  getWorkflowDefinition,
  getWorkflowRegistry,
  LOKI_WORKFLOW_EVENTS,
  resolveWorkflow,
  runLokiWorkflowEngine,
  runWorkflowPlan,
  validateWorkflowDefinition,
  validateWorkflowRun,
  WORKFLOW_STATES,
} from '../src/loki/core/workflows/index.js';
import { buildLokiKnowledgeProvider } from '../src/loki/core/knowledge/KnowledgeProvider.js';

const now = Date.now();
const today = new Date(now).toISOString();
const tomorrow = new Date(now + 86400000).toISOString();

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
  user: { id: 'user-1', first_name: 'Ольга', role: 'partner', eventIds: ['event-networking'], referralCode: 'tg_1670282567' },
  userKeys: 24,
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
    partner('family-cafe', {
      name: 'Семейное кафе',
      category: 'Кафе',
      description: 'Кафе и завтраки рядом',
      offer: 'Скидка на завтрак',
      distanceKm: 1.4,
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
  user: { id: 'user-1', keys: 24, role: 'partner' },
  memory: {},
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

scenario('registry exposes declarative workflow set', () => {
  const ids = getWorkflowRegistry().map(item => item.id);
  assert.deepEqual(ids, ['booking', 'event', 'journey', 'partner', 'gift', 'workspace', 'referral']);
  getWorkflowRegistry().forEach(workflow => {
    assert.equal(workflow.declarative, true);
    assert.equal(workflow.readOnly, true);
    assert.ok(workflow.steps.length >= 4);
  });
});

scenario('workflow validator checks tools and actions', () => {
  assert.equal(validateWorkflowDefinition(getWorkflowDefinition('booking'), { actor: context.actor }).ok, true);
  assert.equal(validateWorkflowDefinition({ id: 'bad', steps: [{ id: 'bad-tool', title: 'Bad', kind: 'tool', toolId: 'missing.tool' }] }).ok, false);
  assert.equal(validateWorkflowDefinition({ id: 'bad-action', steps: [{ id: 'bad-action', title: 'Bad', kind: 'user_action', actionId: 'MISSING' }] }).ok, false);
});

scenario('resolver selects booking after planner', () => {
  const plannerResult = runLokiPlanner({ question: 'Хочу записаться на массаж рядом с домом', knowledge, context, appState });
  const resolution = resolveWorkflow({ question: 'Хочу записаться на массаж рядом с домом', plannerResult, context });
  assert.equal(resolution.workflow.id, 'booking');
});

scenario('resolver selects event by event keywords', () => {
  const question = 'Куда завтра вечером сходить на мероприятие со скидкой';
  const plannerResult = runLokiPlanner({ question, knowledge, context, appState });
  assert.equal(resolveWorkflow({ question, plannerResult, context }).workflow.id, 'event');
});

scenario('resolver selects referral over generic key optimization', () => {
  const question = 'Где мне сейчас выгоднее получить ключи через приглашение друзей';
  const plannerResult = runLokiPlanner({ question, knowledge, context, appState });
  assert.equal(resolveWorkflow({ question, plannerResult, context }).workflow.id, 'referral');
});

scenario('workflow planner emits transparent step contract', () => {
  const workflow = getWorkflowDefinition('booking');
  const plannerResult = runLokiPlanner({ question: 'Хочу записаться на массаж рядом с домом', knowledge, context, appState });
  const plan = buildWorkflowPlan({ workflow, question: 'Хочу записаться на массаж рядом с домом', plannerResult });
  assert.ok(plan.id.startsWith('workflow-booking-'));
  assert.ok(plan.steps.every(step => step.id && step.title && step.status && Array.isArray(step.dependencies)));
  assert.ok(plan.steps.some(step => step.tool === TOOL_IDS.PARTNER_FIND));
  assert.ok(plan.steps.some(step => step.kind === 'user_action'));
});

scenario('workflow runner executes tools and waits for user action', () => {
  const workflow = getWorkflowDefinition('booking');
  const plannerResult = runLokiPlanner({ question: 'Хочу записаться на массаж рядом с домом', knowledge, context, appState });
  const plan = buildWorkflowPlan({ workflow, question: 'Хочу записаться на массаж рядом с домом', plannerResult });
  const validation = validateWorkflowRun({ ...plan, workflow }, { actor: context.actor });
  assert.equal(validation.ok, true);
  const run = runWorkflowPlan(plan, { workflow, knowledge, context, appState });
  assert.equal(run.status, WORKFLOW_STATES.WAITING_USER);
  assert.ok(run.toolResults.length >= 3);
  assert.equal(run.progress.currentStep.id, 'choose-time');
  assert.ok(run.events.some(event => event.type === LOKI_WORKFLOW_EVENTS.WAITING_USER));
});

scenario('workflow engine plugs into smart answer pipeline', () => {
  const result = runLokiKnowledgeEngine({ text: 'Хочу записаться на массаж рядом с домом', appState, context });
  assert.equal(result.workflowContext.workflowId, 'booking');
  assert.equal(result.workflowContext.status, WORKFLOW_STATES.WAITING_USER);
  assert.ok(result.text.includes('подтвердите') || result.text.includes('Следующий шаг'));
  assert.ok(result.planContext);
  assert.ok(result.toolContext.workflowEvents.length >= 3);
});

scenario('workflow result flows into action center', () => {
  const result = runLokiKnowledgeEngine({ text: 'Хочу записаться на массаж рядом с домом', appState, context });
  const centered = runLokiActionCenter({ result, context, appState, appActions });
  assert.ok(centered.actionCenter.suggested.length > 0);
  assert.ok(centered.actionCenter.suggested.length <= 3);
});

scenario('workflow snapshot is local and avoids repeated completed steps', () => {
  const first = runLokiKnowledgeEngine({ text: 'Хочу записаться на массаж рядом с домом', appState, context });
  const snapshot = buildWorkflowSnapshot({ lastWorkflowContext: first.workflowContext });
  const second = runLokiKnowledgeEngine({ text: 'Хочу записаться на массаж рядом с домом', appState, context: { ...context, memory: { workflowSnapshot: snapshot, lastWorkflowContext: first.workflowContext } } });
  assert.equal(snapshot.active.workflowId, 'booking');
  assert.ok(second.workflowContext.steps.some(step => step.status === 'skipped'));
});

scenario('workflow history stores compact local entries', () => {
  const result = runLokiKnowledgeEngine({ text: 'Где мне сейчас выгоднее получить подарок за ключи', appState, context });
  const patch = buildWorkflowHistoryPatch({}, result.workflowContext);
  assert.equal(patch.workflowHistory.length, 1);
  assert.equal(patch.workflowHistory[0].workflowId, 'gift');
});

scenario('debug trace includes workflow engine contract', () => {
  const source = readFileSync(new URL('../src/loki/core/LokiCore.js', import.meta.url), 'utf8');
  assert.ok(source.includes("module: 'workflowEngine'"));
  assert.ok(source.includes('expectedUserActions'));
});

scenario('provider records local workflow history', () => {
  const source = readFileSync(new URL('../src/loki/LokiProvider.jsx', import.meta.url), 'utf8');
  assert.ok(source.includes('buildWorkflowHistoryPatch'));
  assert.ok(source.includes('recordWorkflowContext'));
  assert.ok(source.includes('lastWorkflowContext'));
});

scenario('pipeline order keeps workflow after planner and before generic tool layer', () => {
  const source = readFileSync(new URL('../src/loki/core/knowledge/SmartAnswerPipeline.js', import.meta.url), 'utf8');
  assert.ok(source.indexOf('const plannerResult = runLokiPlanner') < source.indexOf('const workflowResult = runLokiWorkflowEngine'));
  assert.ok(source.indexOf('const workflowResult = runLokiWorkflowEngine') < source.indexOf('const toolResult = runLokiToolLayer'));
});

scenario('workflow files are frontend read-only', () => {
  [
    'WorkflowEngine.js',
    'WorkflowRegistry.js',
    'WorkflowResolver.js',
    'WorkflowPlanner.js',
    'WorkflowRunner.js',
    'WorkflowProgress.js',
    'WorkflowState.js',
    'WorkflowValidator.js',
    'WorkflowHistory.js',
    'WorkflowSnapshot.js',
  ].forEach(file => {
    const source = readFileSync(new URL(`../src/loki/core/workflows/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /firebase|firestore|addDoc|setDoc|updateDoc|deleteDoc|userAction\(|fetch\(/i, file);
  });
});

scenario('workflow declarations do not contain business writes', () => {
  [
    'BookingWorkflow.js',
    'EventWorkflow.js',
    'ReferralWorkflow.js',
    'JourneyWorkflow.js',
    'PartnerWorkflow.js',
    'GiftWorkflow.js',
    'WorkspaceWorkflow.js',
  ].forEach(file => {
    const source = readFileSync(new URL(`../src/loki/core/workflows/workflows/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /increment\(|serverTimestamp|firebase|firestore|fetch\(|addDoc|setDoc|updateDoc|deleteDoc/i, file);
  });
});

scenario('documentation mentions Workflow Engine v1', () => {
  const source = readFileSync(new URL('../.ai/21_LOKI_CORE_V2.md', import.meta.url), 'utf8');
  assert.ok(source.includes('Workflow Engine v1') || source.includes('Workflow v1'));
});

const queryMatrix = [
  ['booking', 'Хочу записаться на массаж рядом с домом'],
  ['event', 'Куда завтра вечером сходить на мероприятие со скидкой'],
  ['journey', 'Где мне сейчас выгоднее получить ключи'],
  ['gift', 'Где мне сейчас выгоднее получить подарок за ключи'],
  ['workspace', 'Workspace: разбери что важно по задачам диалогам и записям'],
  ['partner', 'Куда сегодня пойти с выгодной акцией в кафе'],
  ['referral', 'Где мне сейчас выгоднее получить ключи через приглашение друзей'],
];

for (let i = 0; i < 1200; i += 1) {
  const [expected, question] = queryMatrix[i % queryMatrix.length];
  scenario(`workflow scenario ${i + 1}: ${expected}`, () => {
    const result = runLokiKnowledgeEngine({ text: `${question} #${i}`, appState, context });
    assert.equal(result.workflowContext.workflowId, expected);
    assert.ok([WORKFLOW_STATES.WAITING_USER, WORKFLOW_STATES.COMPLETED].includes(result.workflowContext.status));
    assert.ok(result.workflowContext.steps.length >= 4);
    assert.ok(result.workflowContext.events.some(event => event.type === LOKI_WORKFLOW_EVENTS.SELECTED));
    assert.ok(result.workflowContext.expectedUserActions.length <= 3);
    assert.doesNotMatch(result.text, /undefined|null|stack/i);
  });
}

console.log(`Loki Workflow Engine v1 regression passed: ${scenarios} scenarios`);
