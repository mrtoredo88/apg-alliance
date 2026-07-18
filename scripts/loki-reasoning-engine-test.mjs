import assert from 'node:assert/strict';
import { detectLokiIntent } from '../src/loki/core/intent/IntentRouter.js';
import { buildLokiKnowledgeProvider } from '../src/loki/core/knowledge/KnowledgeProvider.js';
import { runLokiKnowledgeEngine } from '../src/loki/core/knowledge/SmartAnswerPipeline.js';
import { runReasoningEngine } from '../src/loki/core/reasoning/ReasoningEngine.js';

const now = Date.now();

function partner(id, patch = {}) {
  return {
    id,
    name: patch.name || `Партнёр ${id}`,
    category: patch.category || 'Красота',
    description: patch.description || 'Услуги для жителей Зеленограда',
    address: patch.address || 'Зеленоград',
    phone: patch.phone || '+7 999 000-00-00',
    workingHours: patch.workingHours || 'Пн-Вс 10:00-20:00',
    rating: patch.rating ?? 4.2,
    reviewsCount: patch.reviewsCount ?? 5,
    bookingUrl: patch.bookingUrl || '',
    offer: patch.offer || '',
    distanceKm: patch.distanceKm ?? 5,
    views: patch.views ?? 20,
    updatedAt: new Date(now - 5 * 86400000).toISOString(),
    catalogPublished: true,
    ...patch,
  };
}

const bestSalon = partner('salon-best', {
  name: 'Барбер Линия',
  category: 'Стрижки',
  description: 'Стрижки, барбер, укладка, парковка во дворе',
  workingHours: 'Ежедневно 09:00-22:00',
  rating: 4.9,
  reviewsCount: 64,
  bookingUrl: 'https://booking.example/barber',
  offer: 'Скидка 10% на первую стрижку',
  distanceKm: 0.7,
  views: 240,
  parking: 'Парковка во дворе',
});

const reviewSalon = partner('salon-reviews', {
  name: 'Стрижка Профи',
  category: 'Стрижки',
  workingHours: 'Пн-Сб 10:00-20:00',
  rating: 4.8,
  reviewsCount: 120,
  distanceKm: 2.4,
  views: 180,
});

const offerSalon = partner('salon-offer', {
  name: 'Салон Акция',
  category: 'Стрижки',
  workingHours: 'Пн-Вс 11:00-21:00',
  rating: 4.4,
  reviewsCount: 18,
  offer: 'Каждая третья стрижка дешевле',
  distanceKm: 1.8,
});

const weakSalon = partner('salon-weak', {
  name: 'Салон Без Данных',
  category: 'Стрижки',
  description: '',
  phone: '',
  workingHours: '',
  rating: 0,
  reviewsCount: 0,
  distanceKm: 0,
});

const manyPartners = Array.from({ length: 24 }, (_, index) => partner(`mass-${index}`, {
  name: `Кофейня ${index + 1}`,
  category: 'Кофейня',
  description: 'Кофе, завтраки, десерты',
  rating: 4 + (index % 8) / 10,
  reviewsCount: index * 2,
  distanceKm: 1 + index / 10,
}));

const appState = {
  activePanel: 'home',
  user: { id: 'user-1', first_name: 'Ольга' },
  userKeys: 18,
  favorites: ['salon-best'],
  partners: [bestSalon, reviewSalon, offerSalon, weakSalon, ...manyPartners],
  experts: [
    { id: 'expert-family', name: 'Анна Миронова', category: 'Психология', specialization: 'Семейный психолог', description: 'Консультации для родителей', rating: 4.8, reviewsCount: 20, catalogPublished: true },
  ],
  events: [
    { id: 'event-business', title: 'Нетворкинг предпринимателей', category: 'Бизнес', description: 'Встреча предпринимателей', startAt: new Date(now + 86400000).toISOString(), status: 'published' },
  ],
  news: [
    { id: 'news-apg', title: 'Новые партнёры АПГ', summary: 'В городе появились новые места', text: 'АПГ расширяет сеть', publishedAt: new Date(now).toISOString(), status: 'published' },
  ],
  rewards: [
    { id: 'gift-coffee', title: 'Кофе за ключи', description: 'Подарок за ключи', cost: 5, active: true },
  ],
  reviews: [
    { id: 'r1', partnerId: 'salon-best', rating: 5, text: 'Отличная стрижка' },
  ],
  analytics: { kpis: { profileViews: 300, newBookings: 17, newDialogs: 4, conversion: 8.2 } },
};

const knowledge = buildLokiKnowledgeProvider(appState);

const baseIntent = detectLokiIntent('где подстричься', knowledge);
const reasoned = runReasoningEngine({ question: 'где подстричься', intent: baseIntent, knowledge, context: { favorites: { ids: ['salon-best'] } } });
assert.equal(reasoned.intent, 'reasoning.search.partners');
assert.equal(reasoned.ranked[0].id, 'salon-best');
assert.ok(reasoned.confidence.value >= 80);
assert.ok(reasoned.suggestions.length >= 2);
assert.ok(reasoned.cards.length <= 5);
assert.match(reasoned.text, /Почему:/);
assert.match(reasoned.text, /Нашёл ещё/);

const followUp = runLokiKnowledgeEngine({
  text: 'Какая работает до 22?',
  appState,
  context: { memory: { lastReasoningContext: reasoned.reasoningContext } },
});
assert.equal(followUp.ranked[0].id, 'salon-best');
assert.ok(followUp.text.includes('работает до 22') || followUp.ranked[0].reasons.includes('работает до 22'));

const why = runLokiKnowledgeEngine({
  text: 'Почему именно этот?',
  appState,
  context: { memory: { lastReasoningContext: reasoned.reasoningContext } },
});
assert.equal(why.intent, 'reasoning.explain_choice');
assert.match(why.text, /потому что/);

const lowData = runReasoningEngine({
  question: 'где подстричься',
  intent: baseIntent,
  knowledge: buildLokiKnowledgeProvider({ partners: [weakSalon] }),
  context: {},
});
assert.ok(lowData.confidence.value < 80);
assert.match(lowData.text, /Не уверен полностью|Информации мало/);

const noData = runLokiKnowledgeEngine({ text: 'где сделать татуировку', appState: { partners: [], experts: [], events: [], news: [] }, context: {} });
assert.ok(!noData || !/не знаю/i.test(noData.text || ''));

const queryGroups = [
  { followUp: false, queries: ['где подстричься', 'где сделать стрижку', 'найди барбера', 'посоветуй салон стрижек', 'куда сходить на укладку'] },
  { followUp: true, queries: ['какая работает до 22', 'какой вариант открыт вечером', 'а где парковка', 'а где есть запись', 'а где акция'] },
  { followUp: true, queries: ['почему именно этот', 'почему выбрал первый', 'почему он лучше', 'почему именно этот вариант', 'почему такая рекомендация'] },
  { followUp: false, queries: ['найди кофейню', 'где кофе', 'покажи кофейни', 'куда за завтраком', 'где десерты'] },
  { followUp: false, queries: ['найди психолога', 'покажи эксперта', 'семейный психолог', 'консультация для родителей', 'какой специалист лучше'] },
  { followUp: false, queries: ['какие мероприятия', 'что завтра в афише', 'покажи бизнес встречу', 'куда сходить завтра', 'есть нетворкинг'] },
  { followUp: false, queries: ['какие подарки', 'что получить за ключи', 'покажи кофе за ключи', 'есть призы', 'награда за ключи'] },
  { followUp: false, queries: ['что нового', 'какие новости', 'новые партнёры', 'городские новости', 'публикации АПГ'] },
];

let checked = 0;
for (let i = 0; i < 25; i++) {
  for (const group of queryGroups) {
    const query = group.queries[i % group.queries.length];
    const context = group.followUp
      ? { memory: { lastReasoningContext: reasoned.reasoningContext } }
      : {};
    const result = runLokiKnowledgeEngine({ text: query, appState, context });
    assert.ok(result, query);
    assert.ok(result.text, query);
    assert.ok((result.cards || []).length <= 5, query);
    if (result.intent?.startsWith('reasoning.')) {
      assert.ok(result.confidence || result.intent === 'reasoning.explain_choice', query);
      assert.ok(result.reasoningContext || result.intent === 'reasoning.explain_choice', query);
    }
    checked++;
  }
}

assert.equal(checked, 200);
console.log(`Loki Reasoning Engine v1: ${checked} scenarios passed`);
