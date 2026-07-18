import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { runLokiKnowledgeEngine } from '../src/loki/core/knowledge/SmartAnswerPipeline.js';
import { runLokiConversationEngine } from '../src/loki/core/conversation/ConversationEngine.js';
import { buildConversationHistoryPatch, LOKI_CONVERSATION_EVENTS } from '../src/loki/core/conversation/ConversationHistory.js';
import { buildConversationSnapshot } from '../src/loki/core/conversation/ConversationSnapshot.js';
import { detectConversationReference, entitiesFromResult, resolveConversationReference } from '../src/loki/core/conversation/ConversationReferences.js';
import { AGENT_DECISIONS } from '../src/loki/core/agent/AgentDecision.js';

const now = Date.now();
const today = new Date(now).toISOString();
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
    { id: 'promo-dent', type: 'promotion', title: 'Скидка на консультацию стоматолога', description: 'Заканчивается завтра', partnerId: 'dent-main', expiresAt: tomorrow, createdAt: today, status: 'published' },
    { id: 'promo-spa', type: 'promotion', title: 'Массаж вечером выгоднее', description: 'Скидка сегодня вечером', partnerId: 'massage-spa', expiresAt: tomorrow, createdAt: today, status: 'published' },
  ],
  events: [
    { id: 'event-business', type: 'event', title: 'Нетворкинг предпринимателей', category: 'Бизнес', description: 'Завтра вечером', startAt: tomorrow, status: 'published' },
    { id: 'event-family', type: 'event', title: 'Семейный мастер-класс', category: 'Семья', description: 'Для детей и родителей', startAt: tomorrow, status: 'published' },
    { id: 'event-health', type: 'event', title: 'Лекция о здоровье', category: 'Здоровье', description: 'Советы экспертов', startAt: tomorrow, status: 'published' },
  ],
  news: [
    { id: 'news-1', type: 'news', title: 'Новые партнёры АПГ', summary: 'Свежие места города', publishedAt: today, status: 'published' },
  ],
  rewards: [
    { id: 'gift-1', type: 'gift', title: 'Кофе за ключи', description: 'Можно получить сейчас', cost: 5, active: true },
  ],
};

const baseContext = {
  actor: { role: 'user', permissions: [] },
  user: { id: 'user-1', keys: 31, role: 'user' },
  memory: {},
};

let scenarios = 0;
function scenario(name, fn) {
  const result = fn();
  scenarios += 1;
  assert.ok(name);
  return result;
}

function withConversation(result, extra = {}) {
  return {
    ...baseContext,
    memory: {
      ...extra,
      lastConversationContext: result.conversationContext,
      lastConversationSession: result.conversationContext?.session,
      lastReasoningContext: result.reasoningContext,
      lastAgentSession: result.agentContext?.session,
      lastWorkflowContext: result.workflowContext,
    },
  };
}

scenario('conversation creates local session from first answer', () => {
  const result = runLokiKnowledgeEngine({ text: 'Покажи стоматологов', appState, context: baseContext });
  assert.ok(result.conversationContext.session.conversationId);
  assert.ok(result.conversationContext.activeEntities.length >= 2);
  assert.ok(result.conversationContext.events.some(event => event.type === LOKI_CONVERSATION_EVENTS.CREATED));
});

scenario('conversation resolves ordinal reference to second entity', () => {
  const first = runLokiKnowledgeEngine({ text: 'Покажи стоматологов', appState, context: baseContext });
  const second = runLokiKnowledgeEngine({ text: 'А второй работает завтра?', appState, context: withConversation(first) });
  const expected = first.conversationContext.activeEntities[1];
  assert.equal(second.conversationContext.resolvedReference.entity.id, expected.id);
  assert.ok(second.conversationContext.effectiveQuestion.includes(expected.title));
});

scenario('conversation resolves last entity reference', () => {
  const first = runLokiKnowledgeEngine({ text: 'Покажи мероприятия', appState, context: baseContext });
  const second = runLokiKnowledgeEngine({ text: 'Открой последнее', appState, context: withConversation(first) });
  assert.equal(second.conversationContext.resolvedReference.entity.title, 'Лекция о здоровье');
});

scenario('conversation keeps topics during topic switch and return', () => {
  const events = runLokiKnowledgeEngine({ text: 'Покажи мероприятия', appState, context: baseContext });
  const partners = runLokiKnowledgeEngine({ text: 'Теперь покажи акции', appState, context: withConversation(events) });
  const back = runLokiKnowledgeEngine({ text: 'Вернёмся к мероприятиям, третье выглядит интересно', appState, context: withConversation(partners, { lastConversationSession: partners.conversationContext.session }) });
  const topics = back.conversationContext.activeTopics.map(topic => topic.id);
  assert.ok(topics.includes('events'));
  assert.ok(topics.includes('promotions'));
});

scenario('conversation asks clarification for ambiguous pronoun across entity types', () => {
  const session = {
    conversationId: 'conversation-test',
    activeTopics: [{ id: 'mixed', title: 'Разное', active: true }],
    activeEntities: [
      { id: 'event-business', type: 'event', title: 'Нетворкинг предпринимателей' },
      { id: 'dent-main', type: 'partner', title: 'Стоматология рядом' },
    ],
  };
  const result = runLokiKnowledgeEngine({ text: 'Он работает завтра?', appState, context: { ...baseContext, memory: { lastConversationSession: session } } });
  assert.equal(result.intent, 'conversation.clarify');
  assert.ok(result.text.includes('Уточните'));
});

scenario('conversation references module detects pronouns and ordinals', () => {
  assert.equal(detectConversationReference('А второй работает завтра?').ordinalIndex, 1);
  assert.equal(detectConversationReference('Он открыт?').pronoun, 'он');
  assert.equal(resolveConversationReference({
    reference: detectConversationReference('первый'),
    entities: [{ id: 'a', type: 'partner', title: 'A' }],
  }).entity.id, 'a');
});

scenario('conversation snapshot is local and compact', () => {
  const first = runLokiKnowledgeEngine({ text: 'Покажи акции', appState, context: baseContext });
  const snapshot = buildConversationSnapshot({ lastConversationSession: first.conversationContext.session });
  assert.equal(snapshot.source, 'local');
  assert.equal(snapshot.conversationId, first.conversationContext.session.conversationId);
  assert.ok(snapshot.activeEntities.length);
});

scenario('conversation history patch stores observability events locally', () => {
  const first = runLokiKnowledgeEngine({ text: 'Покажи акции', appState, context: baseContext });
  const patch = buildConversationHistoryPatch({}, first.conversationContext);
  assert.ok(patch.conversationHistory.length);
  assert.ok(patch.conversationHistory.every(event => event.type.startsWith('CONVERSATION_')));
});

scenario('conversation passes resolved context to planner and agent', () => {
  const first = runLokiKnowledgeEngine({ text: 'Хочу записаться на массаж рядом с домом', appState, context: baseContext });
  const confirm = runLokiKnowledgeEngine({ text: 'да', appState, context: withConversation(first) });
  assert.equal(confirm.agentContext.decision.type, AGENT_DECISIONS.CONTINUE_WORKFLOW);
  assert.equal(confirm.conversationContext.session.conversationId, first.conversationContext.session.conversationId);
});

scenario('conversation stores entities from result cards', () => {
  const entities = entitiesFromResult({
    cards: [
      { id: 'dent-main', type: 'partner', title: 'Стоматология рядом' },
      { id: 'dent-family', type: 'partner', title: 'Семейный стоматолог' },
    ],
  });
  assert.ok(entities.length);
  assert.ok(entities.every(entity => entity.id && entity.title));
});

scenario('debug trace includes conversation module', () => {
  const source = readFileSync(new URL('../src/loki/core/LokiCore.js', import.meta.url), 'utf8');
  assert.ok(source.includes("module: 'conversationEngine'"));
  assert.ok(source.includes('resolvedReference'));
  assert.ok(source.includes('conversationSnapshot'));
});

scenario('provider records conversation session and history', () => {
  const source = readFileSync(new URL('../src/loki/LokiProvider.jsx', import.meta.url), 'utf8');
  assert.ok(source.includes('buildConversationHistoryPatch'));
  assert.ok(source.includes('recordConversationContext'));
  assert.ok(source.includes('lastConversationSession'));
});

scenario('pipeline places conversation before planner and agent', () => {
  const source = readFileSync(new URL('../src/loki/core/knowledge/SmartAnswerPipeline.js', import.meta.url), 'utf8');
  assert.ok(source.indexOf('const conversationResult = runLokiConversationEngine') < source.indexOf('const plannerResult = runLokiPlanner'));
  assert.ok(source.indexOf('const conversationResult = runLokiConversationEngine') < source.indexOf('const continuationResult = runLokiAgentContinuation'));
});

scenario('conversation source files stay frontend-only', () => {
  [
    'ConversationEngine.js',
    'ConversationSession.js',
    'ConversationContext.js',
    'ConversationResolver.js',
    'ConversationReferences.js',
    'ConversationTopics.js',
    'ConversationHistory.js',
    'ConversationSnapshot.js',
    'ConversationValidator.js',
  ].forEach(file => {
    const source = readFileSync(new URL(`../src/loki/core/conversation/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /firebase|firestore|fetch\(|addDoc|setDoc|updateDoc|deleteDoc|userAction/i, file);
  });
});

scenario('conversation direct engine returns effective question for resolved entity', () => {
  const first = runLokiKnowledgeEngine({ text: 'Покажи мероприятия', appState, context: baseContext });
  const result = runLokiConversationEngine({
    question: 'третье выглядит интересно',
    intent: { id: 'context.card' },
    context: withConversation(first),
  });
  assert.ok(result.effectiveQuestion.includes('Лекция о здоровье'));
});

const followUps = [
  'А завтра?',
  'А поближе?',
  'А дешевле?',
  'А вечером?',
  'Есть ещё варианты?',
  'Открой первую',
  'Открой вторую',
  'Последняя подходит',
  'Там есть запись?',
  'А маршрут туда?',
];

for (let i = 0; i < 1800; i += 1) {
  scenario(`long conversation synthetic ${i + 1}`, () => {
    const seed = i % 3 === 0 ? 'Покажи стоматологов' : i % 3 === 1 ? 'Покажи мероприятия' : 'Покажи акции';
    const first = runLokiKnowledgeEngine({ text: seed, appState, context: baseContext });
    const followUp = followUps[i % followUps.length];
    const second = runLokiKnowledgeEngine({ text: followUp, appState, context: withConversation(first) });
    assert.ok(second.conversationContext);
    assert.ok(second.conversationContext.session.conversationId);
    assert.ok(second.conversationContext.activeTopics.length);
    assert.ok(second.conversationContext.activeEntities.length || second.intent === 'conversation.clarify');
  });
}

console.log(`Loki Conversation Engine v1 regression passed: ${scenarios} scenarios`);
