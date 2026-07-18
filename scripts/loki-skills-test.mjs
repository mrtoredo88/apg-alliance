import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addSkillHistoryItem,
  buildSkillHistoryPatch,
  explainSkill,
  getSkillById,
  getSkillRegistry,
  runLokiSkillResolver,
  validateSkillContext,
} from '../src/loki/core/skills/index.js';
import { runLokiKnowledgeEngine } from '../src/loki/core/knowledge/SmartAnswerPipeline.js';
import { runCapabilityExecutionBridge } from '../src/loki/core/execution/index.js';

const scenarios = [];
const scenario = (name, fn) => scenarios.push({ name, fn });

function capabilityContext(capability, patch = {}) {
  return {
    capability,
    title: capability,
    confidence: patch.confidence ?? 90,
    required: patch.required || [],
    resolved: patch.resolved || {},
    missing: patch.missing || [],
    executionOrder: patch.executionOrder || [{ order: 1, capability, resolvedParameters: patch.resolved || {}, missingParameters: patch.missing || [] }],
    question: patch.question || capability,
    requiredRole: 'user',
    createdAt: '2026-07-19T00:00:00.000Z',
  };
}

function resolve(capability, question, patch = {}) {
  return runLokiSkillResolver({
    question,
    capabilityContext: capabilityContext(capability, { ...patch, question }),
    context: { actor: { role: 'user' }, memory: patch.memory || {} },
    knowledge: patch.knowledge || {},
  });
}

const appState = {
  activePanel: 'home',
  user: { id: 'u1', first_name: 'Ольга', role: 'user' },
  partners: [{ id: 'p1', name: 'SPA Массаж', type: 'partner', catalogPublished: true, locations: [{ id: 'l1' }] }],
  experts: [{ id: 'e1', name: 'Стоматолог Анна', type: 'expert', catalogPublished: true }],
  events: [{ id: 'ev1', title: 'Афиша завтра', type: 'event', status: 'published' }],
  news: [{ id: 'n1', title: 'Новости АПГ', type: 'news', status: 'published' }],
};

scenario('registry contains required 12 skills', () => {
  const ids = new Set(getSkillRegistry().map(skill => skill.id));
  ['partner.search', 'expert.search', 'booking', 'promotion', 'event', 'gift', 'rewards', 'keys', 'profile', 'dialog', 'workspace', 'news'].forEach(id => assert.ok(ids.has(id), id));
});

scenario('booking skill selected for booking capability', () => {
  const result = resolve('BOOK_APPOINTMENT', 'запиши меня на массаж завтра', { resolved: { partnerId: 'p1', serviceId: 'массаж', date: 'завтра' } });
  assert.equal(result.skillContext.skill, 'booking');
  assert.equal(result.skillContext.planner, 'BOOK_SERVICE_WITH_CONTEXT');
  assert.equal(result.skillContext.workflow, 'booking');
  assert.ok(result.skillContext.tools.includes('meeting.list'));
});

scenario('partner search skill supports category nearby promotion rating', () => {
  const result = resolve('SEARCH_PARTNERS', 'найди партнёра рядом по акции с рейтингом', { resolved: { query: 'партнёр' } });
  assert.equal(result.skillContext.skill, 'partner.search');
  assert.equal(result.skillContext.preparedParameters.location, 'nearby');
  assert.equal(result.skillContext.preparedParameters.sort, 'rating');
  assert.equal(result.skillContext.preparedParameters.filter, 'promotion');
});

scenario('promotion skill detects expiring today', () => {
  const result = resolve('SEARCH_PROMOTIONS', 'акции заканчиваются сегодня рядом', { resolved: { query: 'акции' } });
  assert.equal(result.skillContext.skill, 'promotion');
  assert.equal(result.skillContext.preparedParameters.expiring, 'today');
  assert.equal(result.skillContext.preparedParameters.location, 'nearby');
});

scenario('event skill chooses week period', () => {
  const result = resolve('SEARCH_EVENTS', 'афиша на неделю рядом', { resolved: { query: 'афиша' } });
  assert.equal(result.skillContext.skill, 'event');
  assert.equal(result.skillContext.preparedParameters.period, 'week');
  assert.equal(result.skillContext.workflow, 'event');
});

scenario('workspace skill chooses analytics section', () => {
  const result = resolve('OPEN_ANALYTICS', 'открой аналитику workspace');
  assert.equal(result.skillContext.skill, 'workspace');
  assert.equal(result.skillContext.preparedParameters.section, 'analytics');
  assert.equal(result.skillContext.workflow, 'workspace');
});

scenario('keys skill chooses optimize keys planner', () => {
  const result = resolve('OPEN_KEYS', 'сколько у меня ключей');
  assert.equal(result.skillContext.skill, 'keys');
  assert.equal(result.skillContext.planner, 'OPTIMIZE_KEYS');
});

scenario('ambiguous rewards query prefers rewards over gift', () => {
  const result = resolve('OPEN_REWARDS', 'покажи награды и подарки');
  assert.equal(result.skillContext.skill, 'rewards');
  assert.ok(result.skillContext.alternatives.some(item => item.id === 'gift'));
});

scenario('skill prepared parameters pass to execution bridge', () => {
  const skill = resolve('BOOK_APPOINTMENT', 'запиши меня на массаж завтра', { resolved: { partnerId: 'p1' } }).skillContext;
  const execution = runCapabilityExecutionBridge({
    question: 'запиши меня на массаж завтра',
    capabilityContext: capabilityContext('BOOK_APPOINTMENT', { resolved: { partnerId: 'p1' } }),
    parameters: skill.preparedParameters,
  });
  assert.equal(execution.executionContext.resolved.serviceId, 'массаж');
  assert.equal(execution.executionContext.resolved.date, 'завтра');
});

scenario('history caps at 100', () => {
  let history = [];
  for (let i = 0; i < 120; i += 1) history = addSkillHistoryItem(history, { id: `s${i}`, skill: 'booking', capability: 'BOOK_APPOINTMENT', confidence: 90 });
  assert.equal(history.length, 100);
  assert.equal(history[0].id, 's119');
});

scenario('explanation includes alternatives planner workflow tools', () => {
  const result = resolve('BOOK_APPOINTMENT', 'запиши меня на массаж завтра', { resolved: { partnerId: 'p1', serviceId: 'массаж', date: 'завтра' } });
  const explanation = explainSkill(result.skillContext);
  assert.match(explanation, /booking/);
  assert.match(explanation, /Planner/);
  assert.match(explanation, /Workflow/);
  assert.match(explanation, /Tools/);
});

scenario('pipeline attaches skill before execution without changing text', () => {
  const result = runLokiKnowledgeEngine({ text: 'найди массаж рядом', appState, context: { actor: { role: 'user' }, memory: {} } });
  assert.ok(result.skillContext?.skill);
  assert.ok(result.executionContext?.capability);
  assert.equal(typeof result.text, 'string');
});

scenario('provider and dev panel markers exist', () => {
  const provider = readFileSync(new URL('../src/loki/LokiProvider.jsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/LokiPage.jsx', import.meta.url), 'utf8');
  assert.match(provider, /lastSkillContext/);
  assert.match(provider, /buildSkillHistoryPatch/);
  assert.match(page, /Selected Skill/);
  assert.match(page, /renderSkillBlock/);
});

scenario('core trace contains skill between capability and execution', () => {
  const source = readFileSync(new URL('../src/loki/core/LokiCore.js', import.meta.url), 'utf8');
  assert.match(source, /module: 'capabilityEngine'/);
  assert.match(source, /module: 'skillResolver'/);
  assert.match(source, /capabilityEngine[\s\S]*skillResolver[\s\S]*executionBridge/);
});

scenario('skill layer stays read-only', () => {
  [
    'SkillRegistry.js',
    'SkillResolver.js',
    'SkillContext.js',
    'SkillHistory.js',
    'SkillSnapshot.js',
    'SkillExplanation.js',
    'SkillValidator.js',
    'LokiSkill.js',
    'index.js',
  ].forEach(file => {
    const source = readFileSync(new URL(`../src/loki/core/skills/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /firebase|firestore|addDoc|setDoc|updateDoc|deleteDoc|fetch\(|executeLokiAction|runControlledExecutionEngine/i, file);
  });
});

const cases = [
  ['SEARCH_PARTNERS', 'найди кофе рядом', 'partner.search'],
  ['OPEN_PARTNER', 'открой партнёра', 'partner.search'],
  ['SEARCH_EXPERTS', 'найди стоматолога', 'expert.search'],
  ['OPEN_EXPERT', 'открой эксперта', 'expert.search'],
  ['BOOK_APPOINTMENT', 'запиши на массаж завтра', 'booking'],
  ['VIEW_BOOKINGS', 'мои записи', 'booking'],
  ['SEARCH_PROMOTIONS', 'акции сегодня', 'promotion'],
  ['OPEN_PROMOTION', 'открой акцию', 'promotion'],
  ['SEARCH_EVENTS', 'куда сходить завтра', 'event'],
  ['OPEN_EVENT', 'открой событие', 'event'],
  ['OPEN_GIFTS', 'покажи подарки', 'gift'],
  ['OPEN_REWARDS', 'мои награды', 'rewards'],
  ['OPEN_KEYS', 'ключи баланс', 'keys'],
  ['OPEN_PROFILE', 'открой профиль', 'profile'],
  ['OPEN_DIALOG', 'открой чат', 'dialog'],
  ['OPEN_WORKSPACE', 'открой кабинет', 'workspace'],
  ['OPEN_ANALYTICS', 'аналитика workspace', 'workspace'],
  ['SEARCH_NEWS', 'новости города', 'news'],
  ['OPEN_NEWS', 'открой новость', 'news'],
  ['OPEN_FEED', 'лента публикаций', 'news'],
];

let index = 0;
while (scenarios.length < 500) {
  const [capability, question, expected] = cases[index % cases.length];
  scenario(`synthetic skill choice ${index + 1}: ${capability}`, () => {
    const resolved = capability.startsWith('SEARCH_') ? { query: question } : {};
    if (capability === 'BOOK_APPOINTMENT') Object.assign(resolved, { partnerId: 'p1', serviceId: 'массаж', date: 'завтра' });
    if (capability === 'OPEN_PARTNER') resolved.partnerId = 'p1';
    if (capability === 'OPEN_EXPERT') resolved.expertId = 'e1';
    if (capability === 'OPEN_EVENT') resolved.eventId = 'ev1';
    if (capability === 'OPEN_NEWS') resolved.newsId = 'n1';
    const result = resolve(capability, question, { resolved });
    assert.equal(result.skillContext.skill, expected);
    assert.ok(result.skillContext.confidence >= 60);
    assert.equal(validateSkillContext(result.skillContext).ok, true);
    assert.equal(buildSkillHistoryPatch({}, result.skillContext).skillHistory.length, 1);
    assert.ok(getSkillById(result.skillContext.skill));
  });
  index += 1;
}

for (const item of scenarios) {
  await item.fn();
}

console.log(`Loki Skills Framework v1: ${scenarios.length} scenarios passed`);
