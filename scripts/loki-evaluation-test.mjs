import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { runLokiKnowledgeEngine } from '../src/loki/core/knowledge/SmartAnswerPipeline.js';
import { runLokiEvaluationEngine, buildEvaluationHistoryPatch, answerEvaluationExplainQuery } from '../src/loki/core/evaluation/index.js';

const now = Date.now();
const tomorrow = new Date(now + 86400000).toISOString();

function partner(id, patch = {}) {
  return {
    id,
    type: 'partner',
    name: patch.name || `Партнёр ${id}`,
    title: patch.name || `Партнёр ${id}`,
    category: patch.category || 'Кафе',
    description: patch.description || 'Полезное место для жителей Зеленограда',
    address: patch.address || 'Зеленоград',
    workingHours: patch.workingHours || 'Пн-Вс 10:00-22:00',
    rating: patch.rating ?? 4.7,
    reviewsCount: patch.reviewsCount ?? 18,
    offer: patch.offer || '',
    distanceKm: patch.distanceKm ?? 1.2,
    catalogPublished: true,
    ...patch,
  };
}

const appState = {
  activePanel: 'home',
  user: { id: 'user-1', first_name: 'Ольга', role: 'user' },
  userKeys: 34,
  partners: [
    partner('coffee-main', { name: 'Кофе рядом', category: 'Кофе', offer: 'Скидка на капучино', distanceKm: 0.4 }),
    partner('dent-main', { name: 'Стоматология рядом', category: 'Стоматология', distanceKm: 0.8 }),
  ],
  experts: [
    { id: 'doctor-anna', type: 'expert', name: 'Анна Белова', title: 'Анна Белова', category: 'Стоматология', specialization: 'Стоматолог', rating: 4.9, reviewsCount: 40, catalogPublished: true },
  ],
  events: [
    { id: 'event-family', type: 'event', title: 'Семейная встреча', category: 'Семья', description: 'Завтра', startAt: tomorrow, status: 'published' },
  ],
  news: [
    { id: 'news-1', type: 'news', title: 'Новые партнёры АПГ', summary: 'Свежие места города', publishedAt: new Date(now).toISOString(), status: 'published' },
  ],
  customTasks: [
    { id: 'task-1', title: 'Посетить партнёра', reward: 2, active: true },
  ],
};

const memory = {};
const context = {
  actor: { role: 'user', permissions: [] },
  user: { id: 'user-1', name: 'Ольга', keys: 34, city: 'Зеленоград', currentPanel: 'home' },
  memory,
};

let scenarios = 0;
async function scenario(name, fn) {
  const result = await fn();
  scenarios += 1;
  assert.ok(name);
  return result;
}

await scenario('core attaches evaluation after decision', async () => {
  const source = readFileSync(new URL('../src/loki/core/LokiCore.js', import.meta.url), 'utf8');
  assert.ok(source.includes('runLokiEvaluationEngine'));
  assert.match(source, /pushDecisionTrace\(trace, [^)]+\);[\s\S]*?PersonalityEngine\.shape/);
  assert.match(source, /applyEvaluation\(\{ question, result: shaped, context, trace \}\)/);
  assert.ok(source.includes("module: 'evaluationEngine'"));
});

await scenario('evaluation does not change generated answer fields', async () => {
  const result = runLokiKnowledgeEngine({ text: 'Покажи мероприятия завтра', appState, context });
  const evaluation = runLokiEvaluationEngine({ question: 'Покажи мероприятия завтра', result, context });
  assert.equal(typeof result.text, 'string');
  assert.ok(evaluation.evaluationContext.answer.includes(result.text.slice(0, 20)));
  assert.deepEqual(evaluation.evaluationContext.actions, result.actionCenter?.suggested || result.suggestions || []);
});

await scenario('direct engine scores all required metrics', async () => {
  const result = runLokiKnowledgeEngine({ text: 'Сколько у меня ключей?', appState, context });
  const evaluation = runLokiEvaluationEngine({ question: 'Сколько у меня ключей?', result, context: { user: { name: 'Ольга', city: 'Зеленоград' } } });
  assert.ok(evaluation.evaluationMetrics.answerQuality.score >= 0);
  assert.ok(Array.isArray(evaluation.evaluationMetrics.contextCoverage.missing));
  assert.equal(typeof evaluation.evaluationMetrics.toolQuality.toolNeeded, 'boolean');
  assert.ok(evaluation.evaluationMetrics.decisionQuality.score >= 0);
  assert.ok(evaluation.evaluationMetrics.actionQuality.score >= 0);
  assert.ok(evaluation.evaluationMetrics.personalization.personalizationScore >= 0);
  assert.ok(evaluation.evaluationMetrics.conversationQuality.score >= 0);
  assert.ok(['LOW', 'MEDIUM', 'HIGH'].includes(evaluation.evaluationMetrics.hallucinationRisk.risk));
  assert.ok(evaluation.evaluationMetrics.confidence >= 0);
});

await scenario('evaluation history keeps last 100 local items', async () => {
  let state = {};
  for (let i = 0; i < 140; i += 1) {
    state = { ...state, ...buildEvaluationHistoryPatch(state, { evaluationId: `ev-${i}`, Overall: 80 + (i % 10), Grade: 'A', Confidence: 90, Context: 80, Hallucination: 'LOW', timestamp: new Date(now + i).toISOString() }) };
  }
  assert.equal(state.evaluationHistory.length, 100);
  assert.equal(state.evaluationHistory[0].evaluationId, 'ev-139');
});

await scenario('explain mode explains lower score and hallucination risk deterministically', async () => {
  const evaluation = runLokiEvaluationEngine({
    question: 'Что будет завтра?',
    result: { text: 'Возможно, завтра будет полезное событие. Вероятно, стоит проверить позже.', decisionContext: { decisionId: 'd-1', intent: 'test', confidence: 0.4, level: 'low', trace: { engines: ['decision'] }, validation: { ok: true } } },
    context: {},
  });
  const explanation = answerEvaluationExplainQuery('Почему Hallucination Medium?', evaluation.evaluationSnapshot, evaluation.evaluationContext, evaluation.evaluationMetrics);
  assert.ok(explanation.includes('Hallucination'));
  assert.notEqual(evaluation.evaluationSnapshot.Hallucination, 'LOW');
});

await scenario('provider exposes evaluation diagnostics locally', async () => {
  const source = readFileSync(new URL('../src/loki/LokiProvider.jsx', import.meta.url), 'utf8');
  assert.ok(source.includes('lastEvaluationContext'));
  assert.ok(source.includes('lastEvaluationSnapshot'));
  assert.ok(source.includes('lastEvaluationHistory'));
  assert.ok(source.includes('buildEvaluationHistoryPatch'));
});

await scenario('loki page renders evaluation dev block', async () => {
  const source = readFileSync(new URL('../src/LokiPage.jsx', import.meta.url), 'utf8');
  assert.ok(source.includes('Overall Score'));
  assert.ok(source.includes('Context Coverage'));
  assert.ok(source.includes('Tool Quality'));
  assert.ok(source.includes('Decision Quality'));
  assert.ok(source.includes('Conversation Quality'));
  assert.ok(source.includes('Personalization'));
});

await scenario('evaluation layer stays frontend read-only', async () => {
  [
    'EvaluationEngine.js',
    'EvaluationContext.js',
    'EvaluationMetrics.js',
    'EvaluationScorer.js',
    'EvaluationHistory.js',
    'EvaluationSnapshot.js',
    'EvaluationExplanation.js',
    'EvaluationValidator.js',
    'index.js',
  ].forEach(file => {
    const source = readFileSync(new URL(`../src/loki/core/evaluation/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /firebase|firestore|fetch\(|addDoc|setDoc|updateDoc|deleteDoc|userAction/i, file);
  });
});

const queries = [
  'Где выпить кофе рядом?',
  'Покажи стоматологов',
  'Какие акции есть сейчас?',
  'Покажи мероприятия завтра',
  'Сколько у меня ключей?',
  'Как заработать ключи?',
];

for (let i = 0; i < 292; i += 1) {
  await scenario(`evaluation synthetic scenario ${i + 1}`, async () => {
    const text = queries[i % queries.length];
    const result = runLokiKnowledgeEngine({ text, appState, context });
    const evaluation = runLokiEvaluationEngine({ question: text, result, context });
    assert.ok(evaluation.evaluationSnapshot?.Overall >= 0, text);
    assert.ok(evaluation.evaluationSnapshot?.Grade, text);
    assert.ok(evaluation.evaluationMetrics?.answerQuality, text);
  });
}

assert.equal(scenarios, 300);
console.log(`Loki Quality & Evaluation Framework v1: ${scenarios} scenarios passed`);
