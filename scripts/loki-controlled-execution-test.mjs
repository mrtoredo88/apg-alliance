import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addControlledExecutionHistoryItem,
  buildControlledExecutionId,
  buildControlledExecutionHistoryPatch,
  explainControlledExecution,
  resolveControlledDispatch,
  resolveExecutionPolicy,
  runControlledExecutionEngine,
} from '../src/loki/core/controlledExecution/index.js';
import { runCapabilityExecutionBridge } from '../src/loki/core/execution/index.js';
import { runLokiKnowledgeEngine } from '../src/loki/core/knowledge/SmartAnswerPipeline.js';

const scenarios = [];
const scenario = (name, fn) => scenarios.push({ name, fn });

function capabilityContext(capability, overrides = {}) {
  return {
    capability,
    title: capability,
    confidence: overrides.confidence ?? 95,
    required: overrides.required || [],
    resolved: overrides.resolved || {},
    missing: overrides.missing || [],
    requiredRole: overrides.requiredRole || 'user',
    executionOrder: overrides.executionOrder || [{ order: 1, capability, resolvedParameters: overrides.resolved || {}, missingParameters: overrides.missing || [] }],
    createdAt: '2026-07-19T00:00:00.000Z',
  };
}

function executionFor(capability, options = {}) {
  return runCapabilityExecutionBridge({
    question: options.question || capability,
    capabilityContext: capabilityContext(capability, options),
    context: { actor: { role: options.role || 'user', permissions: options.permissions || [] } },
    knowledge: options.knowledge || {},
  }).executionContext;
}

const appState = {
  user: { id: 'u1', first_name: 'Ольга', role: 'user' },
  partners: [{ id: 'p1', name: 'SPA', type: 'partner', catalogPublished: true }],
  experts: [{ id: 'e1', name: 'Эксперт', type: 'expert', catalogPublished: true }],
  events: [{ id: 'ev1', title: 'Событие', type: 'event', status: 'published' }],
  news: [{ id: 'n1', title: 'Новость', type: 'news', status: 'published' }],
};

const appActions = {
  openPartner: () => {},
  openExperts: () => {},
  openEvents: () => {},
  openNewsFeed: () => {},
  openNews: () => {},
  openEvent: () => {},
  openPrize: () => {},
  openPartners: () => {},
  showProfile: () => {},
  openLoki: () => {},
  openSettings: () => {},
};

scenario('policy allows safe navigation automatically', () => {
  const policy = resolveExecutionPolicy('OPEN_PROFILE');
  assert.equal(policy.policy, 'AUTO');
  assert.equal(policy.autoAllowed, true);
  assert.equal(policy.confirmationRequired, false);
});

scenario('policy requires confirmation for booking', () => {
  const policy = resolveExecutionPolicy('BOOK_APPOINTMENT');
  assert.equal(policy.policy, 'CONFIRM');
  assert.equal(policy.autoAllowed, false);
  assert.equal(policy.confirmationRequired, true);
});

scenario('safe profile dispatch is ready and does not require confirmation', () => {
  const executionContext = executionFor('OPEN_PROFILE');
  const result = runControlledExecutionEngine({ question: 'открой профиль', executionContext, appState, appActions, context: { actor: { role: 'user' } } });
  assert.equal(result.controlledExecutionContext.executionReady, true);
  assert.equal(result.controlledExecutionContext.confirmation.required, false);
  assert.equal(result.controlledExecutionContext.dispatcher.action.type, 'showProfile');
});

scenario('booking without explicit confirmation is pending and not dispatched', () => {
  const executionContext = executionFor('BOOK_APPOINTMENT', { question: 'запиши завтра', resolved: { partnerId: 'p1', serviceId: 'массаж', date: 'завтра' } });
  const result = runControlledExecutionEngine({ question: 'запиши завтра', executionContext, appState, appActions, context: { actor: { role: 'user' } } });
  assert.equal(result.controlledExecutionContext.confirmation.required, true);
  assert.equal(result.controlledExecutionContext.confirmation.status, 'pending');
  assert.equal(result.controlledExecutionContext.executionReady, false);
  assert.equal(result.controlledExecutionContext.result.dispatch, null);
});

scenario('high confidence is not confirmation', () => {
  const executionContext = executionFor('BOOK_APPOINTMENT', { question: 'точно запиши завтра', resolved: { partnerId: 'p1', serviceId: 'массаж', date: 'завтра' }, confidence: 99 });
  const result = runControlledExecutionEngine({ question: 'точно запиши завтра', executionContext, appState, appActions, context: { actor: { role: 'user' } } });
  assert.equal(result.controlledExecutionContext.confirmation.status, 'pending');
  assert.equal(result.controlledExecutionContext.executionReady, false);
});

scenario('plain navigation button is not confirmation', () => {
  const executionContext = executionFor('BOOK_APPOINTMENT', { question: 'запиши завтра', resolved: { partnerId: 'p1', serviceId: 'массаж', date: 'завтра' } });
  const result = runControlledExecutionEngine({
    question: 'открыть',
    executionContext,
    confirmationInput: { status: 'confirmed', executionId: 'other-plan', source: 'navigation_button' },
    appState,
    appActions,
    context: { actor: { role: 'user' } },
  });
  assert.equal(result.controlledExecutionContext.confirmation.status, 'pending');
});

scenario('explicit confirmation must match execution id', () => {
  const executionContext = executionFor('BOOK_APPOINTMENT', { question: 'запиши завтра', resolved: { partnerId: 'p1', serviceId: 'массаж', date: 'завтра' } });
  const executionId = buildControlledExecutionId(executionContext);
  const result = runControlledExecutionEngine({
    question: 'подтверждаю',
    executionContext,
    confirmationInput: { status: 'confirmed', executionId, source: 'agentConfirmation' },
    appState,
    appActions,
    context: { actor: { role: 'user' } },
  });
  assert.equal(result.controlledExecutionContext.confirmation.status, 'confirmed');
  assert.equal(result.controlledExecutionContext.executionReady, true);
});

scenario('previous confirmation expires when plan changes', () => {
  const first = executionFor('BOOK_APPOINTMENT', { question: 'запиши завтра', resolved: { partnerId: 'p1', serviceId: 'массаж', date: 'завтра' } });
  const second = executionFor('BOOK_APPOINTMENT', { question: 'запиши сегодня', resolved: { partnerId: 'p1', serviceId: 'массаж', date: 'сегодня' } });
  const pending = runControlledExecutionEngine({ question: 'запиши завтра', executionContext: first, appState, appActions, context: { actor: { role: 'user' } } }).controlledExecutionContext;
  const changed = runControlledExecutionEngine({ question: 'да', executionContext: second, memory: { lastControlledExecutionContext: pending }, appState, appActions, context: { actor: { role: 'user' } } });
  assert.equal(changed.controlledExecutionContext.confirmation.status, 'expired');
  assert.equal(changed.controlledExecutionContext.executionReady, false);
});

scenario('missing parameters block execution', () => {
  const executionContext = executionFor('OPEN_PARTNER', { question: 'открой партнёра', missing: ['partnerId'] });
  const result = runControlledExecutionEngine({ question: 'открой партнёра', executionContext, appState, appActions, context: { actor: { role: 'user' } } });
  assert.equal(result.controlledExecutionContext.executionReady, false);
  assert.equal(result.controlledExecutionContext.guard.ok, false);
});

scenario('unavailable app action blocks at guard', () => {
  const executionContext = executionFor('OPEN_PROFILE');
  const result = runControlledExecutionEngine({ question: 'открой профиль', executionContext, appState, appActions: {}, context: { actor: { role: 'user' } } });
  assert.equal(result.controlledExecutionContext.executionReady, false);
  assert.equal(result.controlledExecutionContext.guard.ok, false);
});

scenario('history keeps last 100 items', () => {
  let history = [];
  for (let i = 0; i < 130; i += 1) history = addControlledExecutionHistoryItem(history, { id: `ce-${i}`, capability: 'OPEN_PROFILE', executionReady: true, policy: { policy: 'AUTO' }, result: { status: 'ready' } });
  assert.equal(history.length, 100);
  assert.equal(history[0].id, 'ce-129');
});

scenario('explanation mentions checks and dispatcher', () => {
  const executionContext = executionFor('OPEN_PROFILE');
  const result = runControlledExecutionEngine({ question: 'открой профиль', executionContext, appState, appActions, context: { actor: { role: 'user' } } });
  const explanation = explainControlledExecution(result.controlledExecutionContext);
  assert.match(explanation, /Policy/);
  assert.match(explanation, /Dispatcher/);
  assert.match(explanation, /Проверки/);
});

scenario('pipeline attaches controlled execution without changing text', () => {
  const result = runLokiKnowledgeEngine({ text: 'открой профиль', appState, context: { actor: { role: 'user' }, memory: {} } });
  assert.ok(result.controlledExecutionContext);
  assert.equal(result.controlledExecutionContext.capability, 'OPEN_PROFILE');
  assert.equal(typeof result.text, 'string');
});

scenario('provider and dev panel integration markers exist', () => {
  const provider = readFileSync(new URL('../src/loki/LokiProvider.jsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/LokiPage.jsx', import.meta.url), 'utf8');
  assert.match(provider, /lastControlledExecutionContext/);
  assert.match(provider, /dispatchControlledExecution/);
  assert.match(page, /Controlled Execution/);
  assert.match(page, /Execution Result/);
});

scenario('core trace contains controlled execution after execution bridge', () => {
  const source = readFileSync(new URL('../src/loki/core/LokiCore.js', import.meta.url), 'utf8');
  assert.match(source, /module: 'executionBridge'/);
  assert.match(source, /module: 'controlledExecution'/);
  assert.match(source, /executionBridge[\s\S]*controlledExecution[\s\S]*planner/);
});

scenario('controlled layer remains frontend read-only', () => {
  [
    'ControlledExecutionEngine.js',
    'ExecutionPolicy.js',
    'ExecutionGuard.js',
    'ExecutionDispatcher.js',
    'ExecutionPreview.js',
    'ExecutionResult.js',
    'ExecutionHistory.js',
    'ExecutionSnapshot.js',
    'ExecutionExplanation.js',
    'index.js',
  ].forEach(file => {
    const source = readFileSync(new URL(`../src/loki/core/controlledExecution/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /firebase|firestore|addDoc|setDoc|updateDoc|deleteDoc|fetch\(/i, file);
  });
});

const safeCases = [
  ['OPEN_PROFILE', {}, 'showProfile'],
  ['OPEN_PARTNER', { partnerId: 'p1' }, 'openPartner'],
  ['OPEN_EXPERT', { expertId: 'e1' }, 'openExperts'],
  ['OPEN_EVENT', { eventId: 'ev1' }, 'openEvent'],
  ['OPEN_NEWS', { newsId: 'n1' }, 'openNews'],
  ['OPEN_REWARDS', {}, 'openPrize'],
  ['OPEN_KEYS', {}, 'showProfile'],
  ['SEARCH_PARTNERS', { query: 'кофе' }, 'openPartners'],
  ['SEARCH_EVENTS', { query: 'дети' }, 'openEvents'],
  ['SEARCH_NEWS', { query: 'город' }, 'openNewsFeed'],
  ['SEARCH_PROMOTIONS', { query: 'скидки' }, 'openPartners'],
  ['SEARCH_EXPERTS', { query: 'стоматолог' }, 'openExperts'],
];

const confirmCases = ['BOOK_APPOINTMENT', 'SEND_MESSAGE', 'CANCEL_BOOKING', 'RESCHEDULE_BOOKING'];

let index = 0;
while (scenarios.length < 400) {
  if (index % 4 === 0) {
    const [capability, resolved, actionType] = safeCases[index % safeCases.length];
    scenario(`synthetic auto execution ${index}: ${capability}`, () => {
      const executionContext = executionFor(capability, { question: capability, resolved });
      const dispatch = resolveControlledDispatch(executionContext);
      const result = runControlledExecutionEngine({ question: capability, executionContext, appState, appActions, context: { actor: { role: 'user' } } });
      assert.equal(resolveExecutionPolicy(capability).policy, 'AUTO');
      assert.equal(dispatch.action?.type, actionType);
      assert.equal(result.controlledExecutionContext.confirmation.required, false);
      assert.equal(result.controlledExecutionContext.guard.ok, true);
      assert.equal(buildControlledExecutionHistoryPatch({}, result.controlledExecutionContext).controlledExecutionHistory.length, 1);
    });
  } else if (index % 4 === 1) {
    const capability = confirmCases[index % confirmCases.length];
    scenario(`synthetic confirmation pending ${index}: ${capability}`, () => {
      const executionContext = executionFor(capability, { question: capability, resolved: { partnerId: 'p1', serviceId: 'массаж', date: 'завтра', bookingId: 'b1', recipientId: 'u2', messageText: 'привет' } });
      const result = runControlledExecutionEngine({ question: capability, executionContext, appState, appActions, context: { actor: { role: 'user' } } });
      assert.equal(result.controlledExecutionContext.confirmation.required, true);
      assert.notEqual(result.controlledExecutionContext.confirmation.status, 'confirmed');
      assert.equal(result.controlledExecutionContext.result.dispatch, null);
    });
  } else if (index % 4 === 2) {
    scenario(`synthetic block missing params ${index}`, () => {
      const executionContext = executionFor('OPEN_PARTNER', { question: 'открой партнёра', missing: ['partnerId'] });
      const result = runControlledExecutionEngine({ question: 'открой партнёра', executionContext, appState, appActions, context: { actor: { role: 'user' } } });
      assert.equal(result.controlledExecutionContext.executionReady, false);
      assert.ok(result.controlledExecutionContext.guard.checks.some(item => item.id === 'required_parameters' && !item.ok));
    });
  } else {
    scenario(`synthetic one-time confirmation ${index}`, () => {
      const executionContext = executionFor('BOOK_APPOINTMENT', { question: 'запиши завтра', resolved: { partnerId: 'p1', serviceId: 'массаж', date: 'завтра' } });
      const executionId = buildControlledExecutionId(executionContext);
      const result = runControlledExecutionEngine({ question: 'да', executionContext, confirmationInput: { status: 'confirmed', executionId, source: 'agentConfirmation' }, appState, appActions, context: { actor: { role: 'user' } } });
      assert.equal(result.controlledExecutionContext.confirmation.status, 'confirmed');
      assert.equal(result.controlledExecutionContext.confirmation.executionId, executionId);
    });
  }
  index += 1;
}

for (const item of scenarios) {
  await item.fn();
}

console.log(`Loki Controlled Execution v1: ${scenarios.length} scenarios passed`);
