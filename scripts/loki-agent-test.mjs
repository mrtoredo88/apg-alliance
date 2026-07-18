import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { runLokiActionCenter } from '../src/loki/core/actions/ActionCenter.js';
import { validateAgentSafety } from '../src/loki/core/agent/AgentSafety.js';
import { detectAgentConfirmation } from '../src/loki/core/agent/AgentConfirmation.js';
import { buildAgentHistoryPatch, LOKI_AGENT_EVENTS } from '../src/loki/core/agent/AgentHistory.js';
import { buildAgentSnapshot } from '../src/loki/core/agent/AgentSnapshot.js';
import { resolveAgentContinuation } from '../src/loki/core/agent/AgentContinuation.js';
import { AGENT_DECISIONS } from '../src/loki/core/agent/AgentDecision.js';
import { runLokiAgentEngine, runLokiAgentContinuation } from '../src/loki/core/agent/AgentEngine.js';
import { runLokiKnowledgeEngine } from '../src/loki/core/knowledge/SmartAnswerPipeline.js';
import { buildLokiKnowledgeProvider } from '../src/loki/core/knowledge/KnowledgeProvider.js';
import { runLokiPlanner } from '../src/loki/core/planner/Planner.js';
import { runLokiWorkflowEngine } from '../src/loki/core/workflows/WorkflowEngine.js';
import { LOKI_APP_ACTIONS, createLokiAction } from '../src/loki/lokiActionTypes.js';

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
    }),
    partner('flowers-md', { name: 'MD flowers', category: 'Цветы', description: 'Букеты', offer: 'Композиция дня со скидкой' }),
    partner('family-cafe', { name: 'Семейное кафе', category: 'Кафе', description: 'Завтраки рядом', offer: 'Скидка на завтрак' }),
  ],
  experts: [
    { id: 'dentist-1', type: 'expert', name: 'Ирина Соколова', specialization: 'Стоматолог', category: 'Стоматология', rating: 4.9, reviewsCount: 44, bookingUrl: 'https://booking.example/dentist', catalogPublished: true },
  ],
  promotions: [
    { id: 'promo-evening', title: 'Вечерняя скидка на массаж', description: 'Скидка действует сегодня вечером', partnerId: 'massage-home', expiresAt: tomorrow, createdAt: today, status: 'published' },
  ],
  events: [
    { id: 'event-networking', type: 'event', title: 'Нетворкинг предпринимателей', category: 'Бизнес', description: 'Завтра вечером', startAt: tomorrow, status: 'published', registered: true },
  ],
  news: [
    { id: 'news-today', type: 'news', title: 'Новые возможности АПГ', summary: 'Свежая публикация', publishedAt: today, status: 'published' },
  ],
  rewards: [
    { id: 'gift-coffee', type: 'gift', title: 'Кофе за ключи', description: 'Можно получить сейчас', cost: 5, active: true, createdAt: today },
  ],
  bookings: [
    { id: 'booking-tomorrow', type: 'booking', serviceTitle: 'Маникюр', providerName: 'Барбер Линия', locationTitle: 'Центральный', startAt: tomorrow, status: 'confirmed' },
  ],
  dialogs: [{ id: 'dialog-1', title: 'Вопрос по записи', unreadCount: 2, status: 'open' }],
  analytics: { kpis: { openTasks: 3, unreadDialogs: 2, bookings: 4, profileViews: 180 } },
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

scenario('agent requests confirmation for workflow user step', () => {
  const result = runLokiKnowledgeEngine({ text: 'Хочу записаться на массаж рядом с домом', appState, context });
  assert.equal(result.agentContext.decision.type, AGENT_DECISIONS.ASK_CONFIRMATION);
  assert.equal(result.agentContext.session.waitingForUser, true);
  assert.ok(result.agentContext.session.pendingConfirmation);
  assert.ok(result.text.includes('подтвердите'));
  assert.ok(result.agentContext.events.some(event => event.type === LOKI_AGENT_EVENTS.CONFIRMATION_REQUESTED));
});

scenario('agent continues active workflow on yes without planner result', () => {
  const first = runLokiKnowledgeEngine({ text: 'Хочу записаться на массаж рядом с домом', appState, context });
  const second = runLokiKnowledgeEngine({
    text: 'да',
    appState,
    context: { ...context, memory: { lastAgentSession: first.agentContext.session, lastWorkflowContext: first.workflowContext } },
  });
  assert.equal(second.agentContext.decision.type, AGENT_DECISIONS.CONTINUE_WORKFLOW);
  assert.equal(second.agentContext.session.waitingForUser, false);
  assert.equal(second.planContext, undefined);
  assert.ok(second.text.includes('Подтверждение принято'));
});

scenario('agent cancels active workflow on user cancellation', () => {
  const first = runLokiKnowledgeEngine({ text: 'Хочу записаться на массаж рядом с домом', appState, context });
  const second = runLokiKnowledgeEngine({
    text: 'отмена',
    appState,
    context: { ...context, memory: { lastAgentSession: first.agentContext.session, lastWorkflowContext: first.workflowContext } },
  });
  assert.equal(second.agentContext.decision.type, AGENT_DECISIONS.FINISH);
  assert.equal(second.agentContext.session.waitingForUser, false);
  assert.ok(second.agentContext.events.some(event => event.type === LOKI_AGENT_EVENTS.FINISHED));
});

scenario('agent marks tool result as RUN_TOOL', () => {
  const result = runLokiKnowledgeEngine({ text: 'Сколько у меня ключей?', appState, context });
  assert.equal(result.agentContext.decision.type, AGENT_DECISIONS.RUN_TOOL);
});

scenario('confirmation detector understands yes and cancel', () => {
  assert.equal(detectAgentConfirmation('да').type, 'confirm');
  assert.equal(detectAgentConfirmation('отмена').type, 'cancel');
  assert.equal(detectAgentConfirmation('покажи кафе').type, 'none');
});

scenario('agent snapshot keeps only local session summary', () => {
  const first = runLokiKnowledgeEngine({ text: 'Хочу записаться на массаж рядом с домом', appState, context });
  const snapshot = buildAgentSnapshot({ lastAgentSession: first.agentContext.session });
  assert.equal(snapshot.source, 'local');
  assert.equal(snapshot.session.waitingForUser, true);
  assert.equal(snapshot.session.currentWorkflow.workflowId, 'booking');
});

scenario('continuation resolver reads active agent session', () => {
  const first = runLokiKnowledgeEngine({ text: 'Хочу записаться на массаж рядом с домом', appState, context });
  const snapshot = buildAgentSnapshot({ lastAgentSession: first.agentContext.session });
  const continuation = resolveAgentContinuation({ question: 'да', snapshot });
  assert.equal(continuation.type, 'confirm');
  assert.equal(continuation.workflowContext.workflowId, 'booking');
});

scenario('agent history records decisions locally', () => {
  const first = runLokiKnowledgeEngine({ text: 'Хочу записаться на массаж рядом с домом', appState, context });
  const patch = buildAgentHistoryPatch({}, first.agentContext);
  assert.equal(patch.agentHistory.length, 1);
  assert.equal(patch.agentHistory[0].decision, AGENT_DECISIONS.ASK_CONFIRMATION);
});

scenario('agent safety blocks unavailable concrete action', () => {
  const safety = validateAgentSafety({
    decision: {
      pendingAction: { action: createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: 'missing' }) },
      requiresConfirmation: false,
    },
    context,
    appState,
  });
  assert.equal(safety.ok, false);
  assert.ok(safety.reason);
});

scenario('agent safety accepts existing concrete action', () => {
  const safety = validateAgentSafety({
    decision: {
      pendingAction: { action: createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: 'massage-home' }) },
      requiresConfirmation: false,
    },
    context,
    appState,
  });
  assert.equal(safety.ok, true);
});

scenario('agent engine wraps workflow result without changing workflow engine', () => {
  const question = 'Хочу записаться на массаж рядом с домом';
  const plannerResult = runLokiPlanner({ question, knowledge, context, appState });
  const workflowResult = runLokiWorkflowEngine({ question, plannerResult, knowledge, context, appState });
  const agentResult = runLokiAgentEngine({ question, result: workflowResult, context, appState });
  assert.equal(agentResult.workflowContext.workflowId, 'booking');
  assert.equal(agentResult.agentContext.decision.type, AGENT_DECISIONS.ASK_CONFIRMATION);
});

scenario('action center still receives agent-shaped result', () => {
  const result = runLokiKnowledgeEngine({ text: 'Хочу записаться на массаж рядом с домом', appState, context });
  const centered = runLokiActionCenter({ result, context, appState, appActions });
  assert.ok(centered.actionCenter.suggested.length <= 3);
});

scenario('debug trace includes agent mode', () => {
  const source = readFileSync(new URL('../src/loki/core/LokiCore.js', import.meta.url), 'utf8');
  assert.ok(source.includes("module: 'agentMode'"));
  assert.ok(source.includes('waitingForUser'));
  assert.ok(source.includes('confirmation'));
});

scenario('provider records local agent history', () => {
  const source = readFileSync(new URL('../src/loki/LokiProvider.jsx', import.meta.url), 'utf8');
  assert.ok(source.includes('buildAgentHistoryPatch'));
  assert.ok(source.includes('recordAgentContext'));
  assert.ok(source.includes('lastAgentSession'));
});

scenario('pipeline keeps agent after workflow and before generic tool fallback', () => {
  const source = readFileSync(new URL('../src/loki/core/knowledge/SmartAnswerPipeline.js', import.meta.url), 'utf8');
  assert.ok(source.indexOf('const workflowResult = runLokiWorkflowEngine') < source.indexOf('runLokiAgentEngine({ question, result: workflowResult'));
  assert.ok(source.indexOf('const continuationResult = runLokiAgentContinuation') < source.indexOf('const plannerResult = runLokiPlanner'));
});

scenario('agent files are frontend local orchestration only', () => {
  [
    'AgentEngine.js',
    'AgentResolver.js',
    'AgentContext.js',
    'AgentDecision.js',
    'AgentExecutor.js',
    'AgentSession.js',
    'AgentContinuation.js',
    'AgentConfirmation.js',
    'AgentSafety.js',
    'AgentHistory.js',
    'AgentSnapshot.js',
  ].forEach(file => {
    const source = readFileSync(new URL(`../src/loki/core/agent/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /firebase|firestore|addDoc|setDoc|updateDoc|deleteDoc|userAction\(|fetch\(/i, file);
  });
});

scenario('agent does not contain domain workflow declarations', () => {
  [
    'AgentEngine.js',
    'AgentResolver.js',
    'AgentContext.js',
    'AgentDecision.js',
    'AgentExecutor.js',
    'AgentSession.js',
    'AgentContinuation.js',
    'AgentConfirmation.js',
    'AgentSafety.js',
    'AgentHistory.js',
    'AgentSnapshot.js',
  ].forEach(file => {
    const source = readFileSync(new URL(`../src/loki/core/agent/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /BookingWorkflow|EventWorkflow|GiftWorkflow|PartnerWorkflow|ReferralWorkflow|WorkspaceWorkflow/i, file);
  });
});

scenario('documentation mentions Agent Mode v1', () => {
  const source = readFileSync(new URL('../.ai/21_LOKI_CORE_V2.md', import.meta.url), 'utf8');
  assert.ok(source.includes('Agent Mode v1') || source.includes('Agent Mode'));
});

const workflowQueries = [
  'Хочу записаться на массаж рядом с домом',
  'Куда завтра вечером сходить на мероприятие со скидкой',
  'Где мне сейчас выгоднее получить ключи',
  'Где мне сейчас выгоднее получить подарок за ключи',
  'Workspace: разбери что важно по задачам диалогам и записям',
  'Куда сегодня пойти с выгодной акцией в кафе',
  'Где мне сейчас выгоднее получить ключи через приглашение друзей',
];

for (let i = 0; i < 1500; i += 1) {
  scenario(`agent scenario ${i + 1}`, () => {
    const question = workflowQueries[i % workflowQueries.length];
    const result = runLokiKnowledgeEngine({ text: `${question} #${i}`, appState, context });
    assert.ok(result.agentContext);
    assert.ok([AGENT_DECISIONS.ASK_CONFIRMATION, AGENT_DECISIONS.START_WORKFLOW, AGENT_DECISIONS.RUN_TOOL, AGENT_DECISIONS.RESPOND].includes(result.agentContext.decision.type));
    assert.ok(result.agentContext.session.sessionId);
    assert.ok(result.agentContext.events.some(event => event.type === LOKI_AGENT_EVENTS.DECISION || event.type === LOKI_AGENT_EVENTS.CONFIRMATION_REQUESTED));
    assert.doesNotMatch(result.text, /undefined|null|stack/i);
    if (result.agentContext.session.waitingForUser) {
      const next = runLokiKnowledgeEngine({
        text: i % 2 ? 'да' : 'отмена',
        appState,
        context: { ...context, memory: { lastAgentSession: result.agentContext.session, lastWorkflowContext: result.workflowContext } },
      });
      assert.ok([AGENT_DECISIONS.CONTINUE_WORKFLOW, AGENT_DECISIONS.FINISH].includes(next.agentContext.decision.type));
      assert.equal(next.planContext, undefined);
    }
  });
}

console.log(`Loki Agent Mode v1 regression passed: ${scenarios} scenarios`);
