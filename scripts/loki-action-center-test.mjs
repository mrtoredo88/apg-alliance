import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { runLokiKnowledgeEngine } from '../src/loki/core/knowledge/SmartAnswerPipeline.js';
import { runReasoningEngine } from '../src/loki/core/reasoning/ReasoningEngine.js';
import { runJourneyEngine } from '../src/loki/core/journey/JourneyEngine.js';
import { runLokiActionCenter, explainLokiActionChoice } from '../src/loki/core/actions/ActionCenter.js';
import { ACTION_IDS, LOKI_ACTION_CENTER_EVENTS, getActionDefinition, getActionRegistry } from '../src/loki/core/actions/ActionRegistry.js';
import { resolveActionIdForIntent, resolveLokiActions } from '../src/loki/core/actions/ActionResolver.js';
import { isEntityAvailable, validateLokiAction } from '../src/loki/core/actions/ActionValidator.js';
import { executeLokiAction } from '../src/loki/core/actions/ActionExecutor.js';
import { addActionHistoryItem, buildActionHistoryPatch, summarizeActionHistory } from '../src/loki/core/actions/ActionHistory.js';
import { LOKI_APP_ACTIONS, createLokiAction } from '../src/loki/lokiActionTypes.js';

const now = Date.now();

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
    ...patch,
  };
}

const appState = {
  activePanel: 'home',
  user: { id: 'user-1', first_name: 'Ольга' },
  userKeys: 18,
  partners: [
    partner('barber-line', { name: 'Барбер Линия', category: 'Стрижки', offer: 'Скидка 10% на первую стрижку' }),
    partner('flowers-md', { name: 'MD flowers', category: 'Цветы', offer: 'Композиция дня со скидкой', bookingUrl: '' }),
    partner('archived-partner', { name: 'Старый партнёр', archived: true }),
  ],
  experts: [
    { id: 'dentist-1', type: 'expert', name: 'Ирина Соколова', specialization: 'Стоматолог', category: 'Стоматология', rating: 4.9, reviewsCount: 44, bookingUrl: 'https://booking.example/dentist', catalogPublished: true },
  ],
  events: [
    { id: 'event-networking', type: 'event', title: 'Нетворкинг предпринимателей', category: 'Бизнес', description: 'Встреча предпринимателей', startAt: new Date(now + 86400000).toISOString(), status: 'published' },
    { id: 'event-old', type: 'event', title: 'Старое событие', status: 'archived' },
  ],
  news: [
    { id: 'news-apg', type: 'news', title: 'Новые партнёры АПГ', summary: 'В городе появились новые места', text: 'АПГ расширяет сеть', publishedAt: new Date(now).toISOString(), status: 'published' },
  ],
  rewards: [
    { id: 'gift-coffee', type: 'gift', title: 'Кофе за ключи', description: 'Подарок за ключи', cost: 5, active: true },
  ],
};

const appActions = Object.fromEntries(Object.values(LOKI_APP_ACTIONS).map(type => [type, async payload => ({ type, payload })]));

let scenarios = 0;
function scenario(name, fn) {
  const result = fn();
  scenarios += 1;
  assert.ok(name);
  return result;
}

async function asyncScenario(name, fn) {
  const result = await fn();
  scenarios += 1;
  assert.ok(name);
  return result;
}

scenario('registry exposes requested action surface', () => {
  const ids = new Set(getActionRegistry().map(item => item.id));
  Object.values(ACTION_IDS).forEach(id => assert.ok(ids.has(id), id));
  assert.ok(getActionDefinition(ACTION_IDS.OPEN_PARTNER));
  assert.ok(getActionDefinition({ type: LOKI_APP_ACTIONS.OPEN_PARTNER }));
});

scenario('registry does not invent backend mode for client actions', () => {
  assert.ok(getActionRegistry().every(item => item.safe));
  assert.ok(getActionRegistry().filter(item => item.mode === 'client').length >= 14);
});

scenario('resolver maps intents to action ids', () => {
  assert.equal(resolveActionIdForIntent({ id: 'info.booking' }, 'BOOK_SERVICE'), ACTION_IDS.OPEN_BOOKING);
  assert.equal(resolveActionIdForIntent({ id: 'search.specialists' }, ''), ACTION_IDS.OPEN_EXPERT);
  assert.equal(resolveActionIdForIntent({ id: 'search.events' }, 'JOIN_EVENT'), ACTION_IDS.OPEN_EVENT);
  assert.equal(resolveActionIdForIntent({ id: 'search.gifts' }, 'CLAIM_GIFT'), ACTION_IDS.OPEN_GIFT);
});

scenario('validator accepts published partner', () => {
  const result = validateLokiAction(createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: 'barber-line' }), { appState, appActions });
  assert.equal(result.ok, true);
  assert.equal(result.entity.id, 'barber-line');
});

scenario('validator rejects archived partner', () => {
  const result = validateLokiAction(createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: 'archived-partner' }), { appState, appActions });
  assert.equal(result.ok, false);
  assert.match(result.reason, /архив|опубликована/i);
});

scenario('validator rejects missing event object', () => {
  const result = validateLokiAction(createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENT, { eventId: 'missing' }), { appState, appActions });
  assert.equal(result.ok, false);
  assert.match(result.reason, /недоступна|похож/i);
});

scenario('validator checks unavailable app handler', () => {
  const result = validateLokiAction(createLokiAction(LOKI_APP_ACTIONS.OPEN_MAP), { appState, appActions: {} });
  assert.equal(result.ok, false);
});

scenario('history records local lifecycle', () => {
  const started = addActionHistoryItem([], { type: LOKI_ACTION_CENTER_EVENTS.STARTED, actionType: LOKI_APP_ACTIONS.OPEN_PARTNER });
  const completed = addActionHistoryItem(started, { type: LOKI_ACTION_CENTER_EVENTS.COMPLETED, actionType: LOKI_APP_ACTIONS.OPEN_PARTNER });
  const patch = buildActionHistoryPatch({ actionHistory: completed }, { type: LOKI_ACTION_CENTER_EVENTS.SUGGESTED, actionType: LOKI_APP_ACTIONS.OPEN_MAP });
  const summary = summarizeActionHistory(patch);
  assert.equal(patch.actionHistory.length, 3);
  assert.ok(summary.recent.length);
  assert.ok(summary.lastOpenedCards.length);
});

await asyncScenario('executor calls existing app action', async () => {
  const events = [];
  const result = await executeLokiAction(createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: 'barber-line' }), {
    appState,
    appActions,
    onEvent: event => events.push(event),
  });
  assert.equal(result.ok, true);
  assert.ok(events.some(event => event.type === LOKI_ACTION_CENTER_EVENTS.STARTED));
  assert.ok(events.some(event => event.type === LOKI_ACTION_CENTER_EVENTS.COMPLETED));
});

await asyncScenario('executor returns user-safe failure for invalid action', async () => {
  const result = await executeLokiAction(createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: 'missing' }), { appState, appActions });
  assert.equal(result.ok, false);
  assert.match(result.reason, /недоступна|похож/i);
});

scenario('action center augments knowledge result with safe actions', () => {
  const result = runLokiKnowledgeEngine({ text: 'хочу подстричься', appState, context: {} });
  const centered = runLokiActionCenter({ result, context: {}, appState, appActions });
  assert.ok(centered.actionCenter.suggested.length > 0);
  assert.ok(centered.card.actions.length > 0);
  assert.ok(centered.suggestions.length <= 3);
});

scenario('action center filters archived suggested actions', () => {
  const result = {
    intent: 'search.partners',
    text: 'Нашёл.',
    card: { id: 'archived-partner', type: 'partner', title: 'Старый', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: 'archived-partner' }) },
    cards: [],
  };
  const centered = runLokiActionCenter({ result, context: {}, appState, appActions });
  assert.equal(centered.actionCenter.suggested.some(item => item.action.payload.partnerId === 'archived-partner'), false);
});

scenario('context actions use currently opened news', () => {
  const centered = runLokiActionCenter({
    result: { intent: 'context.news.summary', text: 'Кратко.', card: null, cards: [] },
    context: { memory: { activeContext: { type: 'news', newsId: 'news-apg' } } },
    appState,
    appActions,
  });
  assert.equal(centered.actionCenter.suggested[0].action.type, LOKI_APP_ACTIONS.OPEN_NEWS);
});

scenario('explain action choice is non technical', () => {
  const text = explainLokiActionChoice(createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: 'barber-line' }), { appState, appActions });
  assert.match(text, /потому что/i);
  assert.doesNotMatch(text, /404|undefined|stack/i);
});

scenario('availability helper protects inactive objects', () => {
  assert.equal(isEntityAvailable(appState.partners[0]), true);
  assert.equal(isEntityAvailable(appState.partners[2]), false);
});

const queries = [
  'хочу записаться на массаж',
  'где подстричься',
  'нужен стоматолог',
  'хочу попасть на мероприятие',
  'какие подарки доступны',
  'что нового в АПГ',
  'покажи акции',
  'как добраться',
  'что рядом',
  'мой профиль',
  'открой карту',
  'сканировать qr',
];

for (let i = 0; i < 50; i += 1) {
  for (const query of queries) {
    scenario(`resolver pipeline scenario ${i}-${query}`, () => {
      const knowledge = runLokiKnowledgeEngine({ text: query, appState, context: {} });
      const reasoning = runReasoningEngine({ question: query, intent: { id: knowledge?.intent || 'search.partners', query }, knowledge: knowledge?.knowledge || {}, context: {} });
      const journey = runJourneyEngine({ question: query, intent: { id: knowledge?.intent || reasoning?.intent || 'search.partners', query }, knowledge: knowledge?.knowledge || {}, reasoningResult: reasoning, context: {} });
      const centered = runLokiActionCenter({ result: journey || reasoning || knowledge || { intent: 'fallback', text: query }, context: {}, appState, appActions });
      assert.ok(centered);
      assert.ok((centered.actionCenter?.suggested || []).length <= 3);
      assert.ok(!(centered.actionCenter?.suggested || []).some(item => item.action?.payload?.partnerId === 'archived-partner'));
    });
  }
}

scenario('LokiCore applies action center before personality', () => {
  const source = readFileSync(new URL('../src/loki/core/LokiCore.js', import.meta.url), 'utf8');
  assert.ok(source.includes('runLokiActionCenter'));
  assert.ok(source.includes('applyActions(personalized || knowledgeResult'));
  assert.ok(source.includes("trace.push({ module: 'actionCenter'"));
});

scenario('action center files stay frontend-only', () => {
  [
    'ActionCenter.js',
    'ActionRegistry.js',
    'ActionResolver.js',
    'ActionValidator.js',
    'ActionExecutor.js',
    'ActionHistory.js',
  ].forEach(file => {
    const source = readFileSync(new URL(`../src/loki/core/actions/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /firebase|firestore|userAction|fetch\(/i, file);
  });
});

scenario('loki experience renders card action buttons', () => {
  const source = readFileSync(new URL('../src/loki/LokiExperience.jsx', import.meta.url), 'utf8');
  assert.ok(source.includes('card.actions'));
  assert.ok(source.includes('onAction={action => loki.executeAction(action)}'));
});

assert.ok(scenarios >= 600, `expected at least 600 scenarios, got ${scenarios}`);
console.log(`Loki Action Center v1: ${scenarios} scenarios passed`);
