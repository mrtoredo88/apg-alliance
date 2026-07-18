import assert from 'node:assert/strict';
import { detectLokiIntent } from '../src/loki/core/intent/IntentRouter.js';
import { buildLokiKnowledgeProvider } from '../src/loki/core/knowledge/KnowledgeProvider.js';
import { runLokiKnowledgeEngine } from '../src/loki/core/knowledge/SmartAnswerPipeline.js';
import { runReasoningEngine } from '../src/loki/core/reasoning/ReasoningEngine.js';
import { runJourneyEngine } from '../src/loki/core/journey/JourneyEngine.js';
import { detectJourneyGoal, JOURNEY_GOALS } from '../src/loki/core/journey/GoalDetector.js';
import { createJourneyPlan } from '../src/loki/core/journey/JourneyPlanner.js';

const now = Date.now();

function partner(id, patch = {}) {
  return {
    id,
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
    catalogPublished: true,
    ...patch,
  };
}

const barber = partner('barber-line', {
  name: 'Барбер Линия',
  category: 'Стрижки',
  description: 'Стрижки, укладка, парковка, запись онлайн',
  offer: 'Скидка 10% на первую стрижку',
  locations: [
    { id: 'barber-main', title: 'Центральный', address: 'Зеленоград, корпус 100', phone: '+7 999 111-11-11', workingHours: '09:00-22:00', isMain: true },
    { id: 'barber-north', title: 'Северный', address: 'Зеленоград, корпус 900', phone: '+7 999 222-22-22', workingHours: '10:00-21:00' },
  ],
});

const flowers = partner('flowers-md', {
  name: 'MD flowers',
  category: 'Цветы',
  description: 'Букеты, доставка, открытки',
  offer: 'Композиция дня со скидкой',
  bookingUrl: '',
});

const appState = {
  activePanel: 'home',
  user: { id: 'user-1', first_name: 'Ольга' },
  userKeys: 18,
  partners: [
    barber,
    flowers,
    partner('coffee-house', { name: 'Кофейня 22', category: 'Кофейня', description: 'Кофе и завтраки до 22:00' }),
  ],
  experts: [
    { id: 'dentist-1', name: 'Ирина Соколова', type: 'expert', category: 'Стоматология', specialization: 'Стоматолог', description: 'Консультация и лечение', rating: 4.9, reviewsCount: 44, bookingUrl: 'https://booking.example/dentist', catalogPublished: true },
    { id: 'psy-1', name: 'Анна Миронова', type: 'expert', category: 'Психология', specialization: 'Семейный психолог', description: 'Консультации для родителей', rating: 4.8, reviewsCount: 20, catalogPublished: true },
  ],
  events: [
    { id: 'event-networking', title: 'Нетворкинг предпринимателей', category: 'Бизнес', description: 'Встреча предпринимателей', startAt: new Date(now + 86400000).toISOString(), status: 'published' },
  ],
  news: [
    { id: 'news-apg', title: 'Новые партнёры АПГ', summary: 'В городе появились новые места', text: 'АПГ расширяет сеть', publishedAt: new Date(now).toISOString(), status: 'published' },
  ],
  rewards: [
    { id: 'gift-coffee', title: 'Кофе за ключи', description: 'Подарок за ключи', cost: 5, active: true },
  ],
  reviews: [
    { id: 'review-1', partnerId: 'barber-line', rating: 5, text: 'Отлично' },
  ],
};

const knowledge = buildLokiKnowledgeProvider(appState);

const goalCases = [
  ['хочу подстричься', JOURNEY_GOALS.BOOK_SERVICE],
  ['нужен стоматолог', JOURNEY_GOALS.FIND_EXPERT],
  ['хочу попасть на мероприятие', JOURNEY_GOALS.JOIN_EVENT],
  ['где купить цветы', JOURNEY_GOALS.FIND_PARTNER],
  ['покажи акции', JOURNEY_GOALS.GET_PROMOTION],
  ['хочу подарок за ключи', JOURNEY_GOALS.CLAIM_GIFT],
  ['как позвонить партнёру', JOURNEY_GOALS.CONTACT_PARTNER],
  ['построй маршрут', JOURNEY_GOALS.NAVIGATE],
  ['объясни как работает АПГ', JOURNEY_GOALS.LEARN],
];

for (const [query, expectedGoal] of goalCases) {
  const intent = detectLokiIntent(query, knowledge);
  assert.equal(detectJourneyGoal({ query, intent }).id, expectedGoal, query);
  assert.ok(createJourneyPlan(expectedGoal, barber).length >= 2, query);
}

const bookIntent = detectLokiIntent('где подстричься', knowledge);
const reasoning = runReasoningEngine({ question: 'где подстричься', intent: bookIntent, knowledge, context: {} });
const journey = runJourneyEngine({ question: 'хочу подстричься', intent: bookIntent, knowledge, reasoningResult: reasoning, context: {} });
assert.equal(journey.intent, 'journey.book_service');
assert.equal(journey.journey.goal, JOURNEY_GOALS.BOOK_SERVICE);
assert.ok(journey.journeyContext.steps.length >= 5);
assert.ok(journey.journeyContext.currentStep);
assert.ok(journey.suggestions.length > 0 && journey.suggestions.length <= 3);
assert.ok(journey.suggestions.every(item => item.action?.type || item.href));
assert.match(journey.text, /Следующее действие:/);

const summary = runLokiKnowledgeEngine({
  text: 'Что мы уже сделали?',
  appState,
  context: { memory: { lastJourneyContext: journey.journeyContext } },
});
assert.equal(summary.intent, 'journey.summary');
assert.match(summary.text, /Следующий шаг:/);

const recovery = runLokiKnowledgeEngine({
  text: 'Продолжим?',
  appState,
  context: { memory: { lastJourneyContext: journey.journeyContext } },
});
assert.equal(recovery.intent, 'journey.recovery');
assert.match(recovery.text, /Мы остановились/);

const completion = runLokiKnowledgeEngine({
  text: 'готово, я записалась',
  appState,
  context: { memory: { lastJourneyContext: journey.journeyContext } },
});
assert.equal(completion.intent, 'journey.completed');
assert.equal(completion.journeyContext.status, 'completed');

const followUp = runLokiKnowledgeEngine({
  text: 'Есть запись завтра?',
  appState,
  context: { memory: { lastJourneyContext: journey.journeyContext, lastReasoningContext: reasoning.reasoningContext } },
});
assert.ok(followUp.intent.startsWith('journey.'));
assert.ok(followUp.journeyContext);
assert.ok(followUp.text.includes('Следующее действие'));

const scenarioGroups = [
  { goal: JOURNEY_GOALS.BOOK_SERVICE, queries: ['хочу подстричься', 'запиши меня на стрижку', 'есть запись завтра', 'хочу на массаж', 'нужно забронировать услугу'] },
  { goal: JOURNEY_GOALS.FIND_PARTNER, queries: ['где купить цветы', 'найди кофейню', 'покажи салон', 'где магазин', 'куда сходить за завтраком'] },
  { goal: JOURNEY_GOALS.FIND_EXPERT, queries: ['нужен стоматолог', 'покажи психолога', 'найди специалиста', 'какой эксперт лучше', 'нужна консультация'] },
  { goal: JOURNEY_GOALS.JOIN_EVENT, queries: ['хочу попасть на мероприятие', 'куда сходить завтра', 'покажи нетворкинг', 'что в афише', 'зарегистрироваться на событие'] },
  { goal: JOURNEY_GOALS.GET_PROMOTION, queries: ['какие акции', 'где скидки', 'покажи выгодное предложение', 'есть промо', 'хочу акцию'] },
  { goal: JOURNEY_GOALS.CLAIM_GIFT, queries: ['какие подарки', 'что получить за ключи', 'хочу приз', 'покажи награды', 'как забрать подарок'] },
  { goal: JOURNEY_GOALS.CONTACT_PARTNER, queries: ['как позвонить партнёру', 'хочу связаться', 'дай телефон', 'написать в telegram', 'есть whatsapp'] },
  { goal: JOURNEY_GOALS.NAVIGATE, queries: ['построй маршрут', 'как добраться', 'покажи на карте', 'где находится', 'адрес салона'] },
  { goal: JOURNEY_GOALS.LEARN, queries: ['объясни как работает АПГ', 'расскажи про ключи', 'что такое партнёры', 'как пользоваться приложением', 'зачем нужны подарки'] },
  { goal: JOURNEY_GOALS.BOOK_SERVICE, queries: ['Какой лучше?', 'А где парковка?', 'Почему именно этот?', 'Что дальше?', 'Продолжим?'], memory: true },
];

let checked = 0;
for (let i = 0; i < 25; i++) {
  for (const group of scenarioGroups) {
    const query = group.queries[i % group.queries.length];
    const context = group.memory ? { memory: { lastJourneyContext: journey.journeyContext, lastReasoningContext: reasoning.reasoningContext } } : {};
    const result = runLokiKnowledgeEngine({ text: query, appState, context });
    assert.ok(result, query);
    assert.ok(result.text, query);
    assert.ok((result.cards || []).length <= 5, query);
    if (result.intent?.startsWith('journey.')) {
      assert.ok(result.journeyContext || result.intent === 'journey.summary' || result.intent === 'journey.recovery', query);
      assert.ok((result.suggestions || []).length <= 3, query);
      assert.ok(result.intent === 'journey.completed' || result.text.includes('Следующий шаг') || result.text.includes('Следующее действие') || result.text.includes('остановились'), query);
    }
    checked++;
  }
}

assert.equal(checked, 250);
console.log(`Loki Journey Engine v1: ${checked} scenarios passed`);
