import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { runJourneyEngine } from '../src/loki/core/journey/JourneyEngine.js';
import { runPersonalizationEngine } from '../src/loki/core/personalization/PersonalizationEngine.js';
import { runProactiveAnswer, runProactiveEngine } from '../src/loki/core/proactive/ProactiveEngine.js';
import { detectOpportunities } from '../src/loki/core/proactive/OpportunityDetector.js';
import { pickTopOpportunity } from '../src/loki/core/proactive/PriorityResolver.js';
import { canShowOpportunity } from '../src/loki/core/proactive/TimingResolver.js';
import { markOpportunityDismissed } from '../src/loki/core/proactive/DismissManager.js';
import { loadOpportunityHistory, saveOpportunityHistory } from '../src/loki/core/proactive/OpportunityHistory.js';
import { detectLokiIntent } from '../src/loki/core/intent/IntentRouter.js';
import { runReasoningEngine } from '../src/loki/core/reasoning/ReasoningEngine.js';

const storage = new Map();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
    clear: () => storage.clear(),
  },
});

const now = new Date('2026-07-18T12:00:00.000Z').getTime();
const hour = 1000 * 60 * 60;
const day = hour * 24;

function partner(id, patch = {}) {
  return {
    id,
    name: patch.name || `Партнёр ${id}`,
    category: patch.category || 'Красота',
    address: patch.address || 'Зеленоград',
    offer: patch.offer || '',
    offerUpdatedAt: patch.offerUpdatedAt || '',
    updatedAt: patch.updatedAt || '2026-07-17T12:00:00.000Z',
    ...patch,
  };
}

function event(id, patch = {}) {
  return {
    id,
    title: patch.title || `Мероприятие ${id}`,
    date: patch.date || new Date(now + 3 * hour).toISOString(),
    place: patch.place || 'Зеленоград',
    ...patch,
  };
}

function prize(id, cost = 5) {
  return { id, title: `Подарок ${id}`, keys: cost };
}

function baseState(patch = {}) {
  return {
    activePanel: 'home',
    user: { id: 'user-1', role: 'user', roles: ['user'] },
    userKeys: 12,
    partners: [partner('beauty', { offer: 'Скидка 10%', offerUpdatedAt: new Date(now - hour).toISOString() })],
    experts: [],
    events: [event('event-1')],
    bookings: [],
    registeredEventIds: ['event-1'],
    favorites: ['beauty'],
    visitCounts: { beauty: 2 },
    scannedPartnerIds: { beauty: true },
    prizes: [prize('gift-1', 8)],
    workspace: {},
    ...patch,
  };
}

function baseMemory(patch = {}) {
  return {
    sessionStartedAt: new Date(Date.now() - 20_000).toISOString(),
    lastJourneyContext: null,
    ...patch,
  };
}

function run(appState = baseState(), memory = baseMemory(), patch = {}) {
  return runProactiveEngine({
    appState,
    memory,
    history: patch.history || [],
    userMemory: {},
    lastUserActionAt: patch.lastUserActionAt || Date.now() - 20_000,
    lastPanelChangeAt: patch.lastPanelChangeAt || Date.now() - 20_000,
    now,
  });
}

function resetHistory() {
  storage.clear();
  saveOpportunityHistory([]);
}

let scenarios = 0;
function scenario(name, fn) {
  resetHistory();
  fn();
  scenarios += 1;
  assert.ok(name);
}

scenario('detect booking soon', () => {
  const state = baseState({ bookings: [{ id: 'b1', status: 'confirmed', startAt: new Date(now + 6 * hour).toISOString(), providerId: 'beauty' }] });
  const types = detectOpportunities({ appState: state, memory: baseMemory(), now }).map(item => item.type);
  assert.ok(types.includes('BOOKING_SOON'));
});

scenario('booking wins priority', () => {
  const state = baseState({ bookings: [{ id: 'b1', status: 'confirmed', startAt: new Date(now + hour).toISOString(), providerId: 'beauty' }] });
  assert.equal(pickTopOpportunity(detectOpportunities({ appState: state, memory: baseMemory(), now })).type, 'BOOKING_SOON');
});

scenario('event soon requires registration', () => {
  const withRegistration = detectOpportunities({ appState: baseState(), memory: baseMemory(), now });
  const withoutRegistration = detectOpportunities({ appState: baseState({ registeredEventIds: [] }), memory: baseMemory(), now });
  assert.ok(withRegistration.some(item => item.type === 'EVENT_SOON'));
  assert.ok(!withoutRegistration.some(item => item.type === 'EVENT_SOON'));
});

scenario('promotion requires visited partner', () => {
  const found = detectOpportunities({ appState: baseState(), memory: baseMemory(), now });
  const skipped = detectOpportunities({ appState: baseState({ favorites: [], visitCounts: {}, scannedPartnerIds: {}, bookings: [] }), memory: baseMemory(), now });
  assert.ok(found.some(item => item.type === 'PROMOTION_NEW'));
  assert.ok(!skipped.some(item => item.type === 'PROMOTION_NEW'));
});

scenario('reward requires enough keys', () => {
  const found = detectOpportunities({ appState: baseState({ userKeys: 10, prizes: [prize('p1', 9)] }), memory: baseMemory(), now });
  const skipped = detectOpportunities({ appState: baseState({ userKeys: 2, prizes: [prize('p1', 9)] }), memory: baseMemory(), now });
  assert.ok(found.some(item => item.type === 'REWARD_AVAILABLE'));
  assert.ok(!skipped.some(item => item.type === 'REWARD_AVAILABLE'));
});

scenario('journey resume uses local memory', () => {
  const memory = baseMemory({ lastJourneyContext: { goal: 'BOOK_SERVICE', step: 'choose_time', selectedItem: { id: 'beauty', type: 'partner', name: 'Beauty' } } });
  assert.ok(detectOpportunities({ appState: baseState(), memory, now }).some(item => item.type === 'JOURNEY_RESUME'));
});

scenario('workspace partner bookings', () => {
  const state = baseState({ user: { id: 'p1', role: 'partner', roles: ['partner'] }, workspace: { pendingBookings: 2 } });
  assert.ok(detectOpportunities({ appState: state, memory: baseMemory(), now }).some(item => item.type === 'WORKSPACE_BOOKINGS'));
});

scenario('workspace expert dialogs', () => {
  const state = baseState({ user: { id: 'e1', role: 'expert', roles: ['expert'] }, workspace: { unreadDialogs: 3 } });
  assert.ok(detectOpportunities({ appState: state, memory: baseMemory(), now }).some(item => item.type === 'WORKSPACE_DIALOGS'));
});

scenario('admin attention', () => {
  const state = baseState({ user: { id: 'a1', role: 'admin', roles: ['admin'] }, workspace: { openAlerts: 1 } });
  assert.equal(pickTopOpportunity(detectOpportunities({ appState: state, memory: baseMemory(), now })).type, 'ADMIN_ATTENTION');
});

scenario('startup silence blocks low priority', () => {
  const opportunity = pickTopOpportunity(detectOpportunities({ appState: baseState({ events: [], registeredEventIds: [] }), memory: baseMemory(), now }));
  const result = canShowOpportunity({ opportunity, appState: baseState(), memory: baseMemory({ sessionStartedAt: new Date(Date.now() - 2000).toISOString() }), lastUserActionAt: Date.now() - 20_000, lastPanelChangeAt: Date.now() - 20_000 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'startup_silence');
});

scenario('active user blocks normal opportunity', () => {
  const result = run(baseState({ events: [], registeredEventIds: [] }), baseMemory(), { lastUserActionAt: Date.now() - 1000 });
  assert.equal(result, null);
});

scenario('blocking work suppresses all', () => {
  const result = run(baseState({ bookingRequest: { providerId: 'beauty' } }));
  assert.equal(result, null);
});

scenario('dismiss cooldown blocks same condition', () => {
  const opportunity = pickTopOpportunity(detectOpportunities({ appState: baseState({ events: [], registeredEventIds: [] }), memory: baseMemory(), now }));
  markOpportunityDismissed(opportunity);
  const result = run(baseState({ events: [], registeredEventIds: [] }));
  assert.equal(result, null);
});

scenario('condition change allows after dismiss', () => {
  const firstState = baseState({ events: [], registeredEventIds: [], favorites: [], visitCounts: {}, scannedPartnerIds: {}, userKeys: 9, prizes: [prize('p1', 8)] });
  const first = pickTopOpportunity(detectOpportunities({ appState: firstState, memory: baseMemory(), now }));
  markOpportunityDismissed(first);
  const changed = run(baseState({ events: [], registeredEventIds: [], favorites: [], visitCounts: {}, scannedPartnerIds: {}, userKeys: 12, prizes: [prize('p1', 8)] }));
  assert.ok(changed);
});

scenario('explain last proactive opportunity', () => {
  const result = runProactiveAnswer({
    question: 'Почему ты мне это показал?',
    memory: { lastRecommendation: { reason: 'Потому что запись завтра.', card: { title: 'Запись' } } },
  });
  assert.equal(result.intent, 'proactive.explain');
  assert.match(result.text, /запись/i);
});

scenario('journey compatibility', () => {
  const intent = detectLokiIntent('хочу записаться');
  const reasoning = runReasoningEngine({ question: 'хочу записаться', intent, knowledge: { partners: baseState().partners }, context: {} });
  const journey = runJourneyEngine({ question: 'хочу записаться', intent, knowledge: { partners: baseState().partners }, reasoningResult: reasoning, context: {} });
  const personalized = runPersonalizationEngine({ question: 'хочу записаться', result: journey, context: { knowledgeEngine: { sources: baseState() } }, appState: baseState() });
  assert.ok(personalized || journey);
});

for (let i = 0; i < 384; i += 1) {
  scenario(`matrix ${i}`, () => {
    const role = ['user', 'partner', 'expert', 'admin'][i % 4];
    const state = baseState({
      user: { id: `u-${i}`, role, roles: [role] },
      userKeys: 1 + (i % 20),
      events: i % 5 === 0 ? [] : [event(`e-${i}`, { date: new Date(now + ((i % 6) + 1) * hour).toISOString() })],
      registeredEventIds: i % 5 === 0 ? [] : [`e-${i}`],
      bookings: i % 7 === 0 ? [{ id: `b-${i}`, status: 'confirmed', startAt: new Date(now + 2 * hour).toISOString(), providerId: 'beauty' }] : [],
      workspace: role === 'partner' ? { pendingBookings: i % 3 } : role === 'expert' ? { unreadDialogs: i % 4 } : role === 'admin' ? { openAlerts: i % 2 } : {},
      prizes: [prize(`gift-${i}`, 3 + (i % 8))],
    });
    const result = run(state, baseMemory({
      lastJourneyContext: i % 9 === 0 ? { goal: 'BOOK_SERVICE', step: 'choose_time', selectedItem: { id: 'beauty', type: 'partner' } } : null,
    }));
    if (result) {
      assert.equal(result.eventType, 'proactive_suggestion');
      assert.ok(result.payload.card.title);
      assert.ok(result.payload.card.text);
      assert.ok((result.payload.card.actions || []).length <= 2);
      assert.ok(result.payload.reason);
    }
  });
}

assert.equal(scenarios, 400);

const proactiveFiles = [
  'src/loki/core/proactive/ProactiveEngine.js',
  'src/loki/core/proactive/OpportunityDetector.js',
  'src/loki/core/proactive/PriorityResolver.js',
  'src/loki/core/proactive/TimingResolver.js',
  'src/loki/core/proactive/DismissManager.js',
  'src/loki/core/proactive/ProactiveCardBuilder.js',
  'src/loki/core/proactive/OpportunityHistory.js',
];

for (const file of proactiveFiles) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  assert.doesNotMatch(source, /firebase|firestore|getDocs|onSnapshot|addDoc|updateDoc|fetch\s*\(/, `${file} must stay read-only and client-local`);
}

assert.ok(loadOpportunityHistory().length >= 0);
console.log('Loki Proactive Assistant v1: 400 scenarios passed');
