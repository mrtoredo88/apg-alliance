import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addExecutionHistoryItem,
  buildExecutionHistoryPatch,
  buildClarificationQuestion,
  explainExecution,
  getExecutionDefinition,
  getExecutionRegistry,
  resolveExecution,
  runCapabilityExecutionBridge,
  validateExecutionContext,
} from '../src/loki/core/execution/index.js';
import { getCapabilityRegistry } from '../src/loki/core/capabilities/index.js';
import { runLokiKnowledgeEngine } from '../src/loki/core/knowledge/SmartAnswerPipeline.js';

const scenarios = [];
const scenario = (name, fn) => scenarios.push({ name, fn });

function capabilityContext(capability, overrides = {}) {
  return {
    capability,
    title: capability,
    confidence: 90,
    required: overrides.required || [],
    resolved: overrides.resolved || {},
    missing: overrides.missing || [],
    executionOrder: overrides.executionOrder || [{ order: 1, capability, resolvedParameters: overrides.resolved || {}, missingParameters: overrides.missing || [] }],
    createdAt: '2026-07-19T00:00:00.000Z',
  };
}

const appState = {
  user: { id: 'u1', first_name: 'Виталий', role: 'user' },
  partners: [{ id: 'p1', name: 'Массаж АПГ', type: 'partner', category: 'здоровье' }],
  experts: [{ id: 'e1', name: 'Эксперт АПГ', type: 'expert' }],
  events: [{ id: 'ev1', title: 'Событие АПГ', type: 'event' }],
  news: [{ id: 'n1', title: 'Новость АПГ', type: 'news', text: 'Новость' }],
  promotions: [{ id: 'pr1', title: 'Акция АПГ', type: 'promotion' }],
  bookings: [],
  customTasks: [],
  notifications: [],
  activePanel: 'home',
};

scenario('registry covers every capability', () => {
  const registry = getExecutionRegistry();
  const missing = getCapabilityRegistry().filter(item => !getExecutionDefinition(item.id)).map(item => item.id);
  assert.equal(missing.length, 0);
  assert.ok(registry.length >= getCapabilityRegistry().length);
});

scenario('profile is ready navigation', () => {
  const result = runCapabilityExecutionBridge({ question: 'открой профиль', capabilityContext: capabilityContext('OPEN_PROFILE') });
  assert.equal(result.executionContext.capability, 'OPEN_PROFILE');
  assert.equal(result.executionContext.navigation.screen, 'profile');
  assert.equal(result.executionContext.ready, true);
  assert.equal(result.executionSnapshot.Ready, true);
});

scenario('booking missing date is not ready with one clarification', () => {
  const result = runCapabilityExecutionBridge({
    question: 'запиши меня на массаж',
    capabilityContext: capabilityContext('BOOK_APPOINTMENT', { resolved: { partnerId: 'p1', serviceId: 'массаж' }, missing: ['date'] }),
  });
  assert.equal(result.executionContext.ready, false);
  assert.deepEqual(result.executionContext.missing, ['date']);
  assert.equal(result.executionContext.clarificationQuestion, 'На какую дату вас записать?');
});

scenario('booking with all params maps to planner and workflow', () => {
  const result = runCapabilityExecutionBridge({
    question: 'запиши меня на массаж завтра',
    capabilityContext: capabilityContext('BOOK_APPOINTMENT', { resolved: { partnerId: 'p1', serviceId: 'массаж', date: 'завтра' } }),
  });
  assert.equal(result.executionContext.ready, true);
  assert.equal(result.executionContext.planner, 'BOOK_SERVICE_WITH_CONTEXT');
  assert.equal(result.executionContext.workflow, 'booking');
  assert.ok(result.executionContext.tools.includes('meeting.list'));
});

scenario('multiple capabilities keep order', () => {
  const result = runCapabilityExecutionBridge({
    question: 'найди массаж и сразу запиши меня завтра',
    capabilityContext: capabilityContext('SEARCH_PARTNERS', {
      resolved: { query: 'массаж', partnerId: 'p1', serviceId: 'массаж', date: 'завтра' },
      executionOrder: [
        { order: 1, capability: 'SEARCH_PARTNERS', resolvedParameters: { query: 'массаж' }, missingParameters: [] },
        { order: 2, capability: 'BOOK_APPOINTMENT', resolvedParameters: { partnerId: 'p1', serviceId: 'массаж', date: 'завтра' }, missingParameters: [] },
      ],
    }),
  });
  assert.deepEqual(result.executionContext.executionPlan.order, ['SEARCH_PARTNERS', 'BOOK_APPOINTMENT']);
  assert.equal(result.executionContext.executionOrder[1].workflowId, 'booking');
});

scenario('unknown capability does not execute', () => {
  const result = runCapabilityExecutionBridge({ question: 'сделай странное', capabilityContext: capabilityContext('UNKNOWN_CAPABILITY') });
  assert.equal(result.executionContext.ready, false);
  assert.equal(result.executionContext.validation.ok, false);
  assert.ok(result.executionContext.validation.errors.includes('capability_missing'));
});

scenario('history caps at 100', () => {
  let history = [];
  for (let i = 0; i < 120; i += 1) history = addExecutionHistoryItem(history, { id: `e${i}`, capability: 'OPEN_PROFILE', ready: true, createdAt: `2026-07-19T00:00:${String(i % 60).padStart(2, '0')}.000Z` });
  assert.equal(history.length, 100);
  assert.equal(history[0].id, 'e119');
});

scenario('explain mode mentions planner workflow tools and readiness', () => {
  const result = runCapabilityExecutionBridge({
    question: 'запиши меня на массаж завтра',
    capabilityContext: capabilityContext('BOOK_APPOINTMENT', { resolved: { partnerId: 'p1', serviceId: 'массаж', date: 'завтра' } }),
  });
  const text = explainExecution(result.executionContext);
  assert.match(text, /Planner/);
  assert.match(text, /Workflow/);
  assert.match(text, /Tools/);
  assert.match(text, /ready/);
});

scenario('knowledge pipeline attaches execution without changing text', () => {
  const result = runLokiKnowledgeEngine({ text: 'открой профиль', appState });
  assert.ok(result.executionContext);
  assert.equal(result.executionContext.capability, 'OPEN_PROFILE');
  assert.equal(typeof result.text, 'string');
});

scenario('core trace includes execution after capability', () => {
  const source = readFileSync(new URL('../src/loki/core/LokiCore.js', import.meta.url), 'utf8');
  assert.match(source, /module: 'capabilityEngine'/);
  assert.match(source, /module: 'executionBridge'/);
  assert.match(source, /capabilityEngine[\s\S]*executionBridge[\s\S]*planner/);
});

scenario('provider and page integration markers exist', () => {
  const provider = readFileSync(new URL('../src/loki/LokiProvider.jsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/LokiPage.jsx', import.meta.url), 'utf8');
  assert.match(provider, /lastExecutionContext/);
  assert.match(provider, /buildExecutionHistoryPatch/);
  assert.match(page, /renderExecutionBlock/);
  assert.match(page, /Execution Ready/);
});

scenario('read-only contract keeps restricted files untouched by imports', () => {
  const registry = readFileSync(new URL('../src/loki/core/execution/ExecutionRegistry.js', import.meta.url), 'utf8');
  const bridge = readFileSync(new URL('../src/loki/core/execution/CapabilityExecutionBridge.js', import.meta.url), 'utf8');
  const joined = `${registry}\n${bridge}`;
  assert.doesNotMatch(joined, /firebase|firestore|updateDoc|addDoc|fetch\(/);
  assert.doesNotMatch(joined, /executeLokiAction|runLokiPlanner|runLokiWorkflowEngine|runLokiToolLayer|runLokiActionCenter/);
});

const syntheticCapabilities = getExecutionRegistry().map(item => item.capability);
const syntheticQueries = [
  'открой профиль',
  'покажи записи',
  'найди партнёра',
  'построй маршрут',
  'открой workspace',
  'покажи новости',
  'найди акции рядом',
  'открой событие',
  'открой эксперта',
  'покажи подарки',
  'открой диалог',
  'позвонить партнёру',
];

let index = 0;
while (scenarios.length < 300) {
  const capability = syntheticCapabilities[index % syntheticCapabilities.length];
  const query = syntheticQueries[index % syntheticQueries.length];
  scenario(`synthetic execution route ${index + 1}: ${capability}`, () => {
    const definition = getExecutionDefinition(capability);
    const resolved = {};
    for (const key of definition.requiredParameters || []) {
      resolved[key] = key === 'query' ? query : `${key}-value`;
    }
    const result = runCapabilityExecutionBridge({ question: query, capabilityContext: capabilityContext(capability, { resolved }) });
    assert.equal(result.executionContext.capability, capability);
    assert.equal(result.executionContext.validation.ok, true);
    assert.equal(result.executionContext.ready, true);
    assert.equal(validateExecutionContext(result.executionContext).ok, true);
    assert.equal(buildExecutionHistoryPatch({}, result.executionContext).executionHistory.length, 1);
    if (definition.navigation) assert.equal(result.executionSnapshot.Navigation, definition.navigation.screen);
    if (definition.requiredParameters?.length) assert.deepEqual(result.executionContext.missing, []);
  });
  index += 1;
}

assert.equal(buildClarificationQuestion('BOOK_APPOINTMENT', ['date']), 'На какую дату вас записать?');

for (const item of scenarios) {
  await item.fn();
}

console.log(`Loki Capability Execution Bridge v1: ${scenarios.length} scenarios passed`);
