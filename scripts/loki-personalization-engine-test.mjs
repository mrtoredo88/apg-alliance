import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { detectLokiIntent } from '../src/loki/core/intent/IntentRouter.js';
import { buildLokiKnowledgeProvider } from '../src/loki/core/knowledge/KnowledgeProvider.js';
import { runLokiKnowledgeEngine } from '../src/loki/core/knowledge/SmartAnswerPipeline.js';
import { runReasoningEngine } from '../src/loki/core/reasoning/ReasoningEngine.js';
import { runJourneyEngine } from '../src/loki/core/journey/JourneyEngine.js';
import { runPersonalizationEngine } from '../src/loki/core/personalization/PersonalizationEngine.js';
import { buildPersonalUserContext } from '../src/loki/core/personalization/UserContextBuilder.js';
import { resolvePreferences } from '../src/loki/core/personalization/PreferenceResolver.js';
import { analyzeUserProfile } from '../src/loki/core/personalization/UserProfileAnalyzer.js';

const now = Date.now();

function partner(id, patch = {}) {
  return {
    id,
    name: patch.name || `Партнёр ${id}`,
    category: patch.category || 'Красота',
    description: patch.description || 'Услуги для жителей Зеленограда',
    address: patch.address || 'Зеленоград',
    phone: patch.phone || '+7 999 000-00-00',
    rating: patch.rating ?? 4.7,
    reviewsCount: patch.reviewsCount ?? 20,
    bookingUrl: patch.bookingUrl || 'https://booking.example',
    catalogPublished: true,
    ...patch,
  };
}

const barber = partner('barber-line', {
  name: 'Барбер Линия',
  category: 'Стрижки',
  description: 'Стрижки, укладка, парковка, онлайн-запись',
  offer: 'Скидка 10%',
});

const massage = partner('massage-home', {
  name: 'Массаж Дом',
  category: 'Массаж',
  description: 'Массаж спины и восстановление',
  reviewsCount: 42,
});

const flowers = partner('flowers-md', {
  name: 'MD flowers',
  category: 'Цветы',
  description: 'Букеты и доставка',
  bookingUrl: '',
});

const baseState = {
  activePanel: 'home',
  user: { id: 'user-new', first_name: 'Новый', role: 'user' },
  userKeys: 0,
  favorites: [],
  partners: [barber, massage, flowers],
  experts: [
    { id: 'expert-dentist', name: 'Ирина Соколова', category: 'Стоматология', specialization: 'Стоматолог', description: 'Консультация и лечение', rating: 4.9, reviewsCount: 44, bookingUrl: 'https://booking.example/dentist', catalogPublished: true },
    { id: 'expert-psy', name: 'Анна Миронова', category: 'Психология', specialization: 'Семейный психолог', description: 'Консультации', rating: 4.8, reviewsCount: 20, catalogPublished: true },
  ],
  events: [
    { id: 'event-networking', title: 'Нетворкинг предпринимателей', category: 'Бизнес', startAt: new Date(now + 86400000).toISOString(), status: 'published' },
  ],
  news: [
    { id: 'news-apg', title: 'Новые партнёры АПГ', summary: 'Новости города', publishedAt: new Date(now).toISOString(), status: 'published' },
  ],
  rewards: [
    { id: 'gift-coffee', title: 'Кофе за ключи', description: 'Подарок за ключи', cost: 5, active: true },
  ],
};

const experiencedState = {
  ...baseState,
  user: { id: 'user-pro', first_name: 'Ольга', role: 'user', level: 9, keys: 18, city: 'Зеленоград', achievements: ['regular'] },
  userKeys: 18,
  favorites: ['massage-home', 'expert-dentist'],
  bookings: [
    { id: 'booking-1', providerId: 'massage-home', providerName: 'Массаж Дом', serviceTitle: 'Массаж спины', category: 'Массаж', startAt: new Date(now - 86400000 * 3).toISOString(), status: 'completed' },
    { id: 'booking-2', providerId: 'massage-home', providerName: 'Массаж Дом', serviceTitle: 'Массаж', category: 'Массаж', startAt: new Date(now - 86400000 * 9).toISOString(), status: 'completed' },
    { id: 'booking-3', providerId: 'barber-line', providerName: 'Барбер Линия', serviceTitle: 'Стрижка', category: 'Стрижки', startAt: new Date(now + 86400000).toISOString(), status: 'confirmed' },
  ],
  visits: [
    { id: 'visit-1', partnerId: 'massage-home', title: 'Массаж Дом', category: 'Массаж', completedAt: new Date(now - 86400000 * 4).toISOString() },
  ],
  reviews: [
    { id: 'review-1', partnerId: 'massage-home', rating: 5, text: 'Отлично' },
  ],
  analytics: { kpis: { profileViews: 120, newBookings: 7, newDialogs: 3 } },
};

const partnerState = {
  ...experiencedState,
  user: { ...experiencedState.user, id: 'partner-user', role: 'partner' },
};

function runPipeline(text, appState = experiencedState, memory = {}) {
  const knowledge = buildLokiKnowledgeProvider(appState);
  const context = {
    actor: { role: appState.user?.role || 'user' },
    user: { ...appState.user, keys: appState.user?.keys ?? appState.userKeys, favorites: appState.favorites },
    apg: { partners: appState.partners || [], experts: appState.experts || [], events: appState.events || [], news: appState.news || [] },
    knowledgeEngine: knowledge,
    memory,
  };
  const intent = detectLokiIntent(text, knowledge);
  const reasoning = runReasoningEngine({ question: text, intent, knowledge, context });
  const journey = runJourneyEngine({ question: text, intent, knowledge, reasoningResult: reasoning, context });
  const base = journey || reasoning || runLokiKnowledgeEngine({ text, appState, context });
  return runPersonalizationEngine({ question: text, result: base, context, appState });
}

const emptyKnowledge = buildLokiKnowledgeProvider(baseState);
const emptyContext = { actor: { role: 'user' }, user: { ...baseState.user, keys: baseState.userKeys, favorites: baseState.favorites }, knowledgeEngine: emptyKnowledge, memory: {} };
const emptyUserContext = buildPersonalUserContext({ context: emptyContext, appState: baseState });
assert.equal(resolvePreferences(emptyUserContext).hasEnoughData, false);
const emptyResult = runPipeline('где подстричься', baseState);
assert.equal(emptyResult.personalizationContext.enabled, false);

const fullKnowledge = buildLokiKnowledgeProvider(experiencedState);
const fullContext = { actor: { role: 'user' }, user: { ...experiencedState.user, keys: experiencedState.userKeys, favorites: experiencedState.favorites }, knowledgeEngine: fullKnowledge, memory: {} };
const userContext = buildPersonalUserContext({ context: fullContext, appState: experiencedState });
const preferences = resolvePreferences(userContext);
const analysis = analyzeUserProfile(userContext);
assert.equal(preferences.hasEnoughData, true);
assert.equal(analysis.experience, 'experienced');
assert.ok(preferences.categories.some(item => item.value.includes('массаж')));

const personalized = runPipeline('где массаж', experiencedState);
assert.equal(personalized.personalizationContext.enabled, true);
assert.ok(personalized.text.includes('С учётом') || personalized.text.includes('Коротко'));
assert.ok((personalized.suggestions || []).length <= 3);

const journeyPersonalized = runPipeline('хочу записаться на массаж', experiencedState);
assert.ok(journeyPersonalized.intent.startsWith('journey.') || journeyPersonalized.intent.startsWith('reasoning.'));
assert.equal(journeyPersonalized.personalizationContext.enabled, true);
const massageReasoningMemory = runReasoningEngine({
  question: 'где массаж',
  intent: detectLokiIntent('где массаж', buildLokiKnowledgeProvider(experiencedState)),
  knowledge: buildLokiKnowledgeProvider(experiencedState),
  context: fullContext,
})?.reasoningContext;

const privacy = runPersonalizationEngine({ question: 'Что ты знаешь обо мне?', result: null, context: fullContext, appState: experiencedState });
assert.equal(privacy.intent, 'personalization.explain');
assert.match(privacy.text, /Я использую/);
assert.doesNotMatch(privacy.text, /email|парол|token|телефон/i);

const directResult = runPipeline('где массаж', experiencedState);
assert.ok(directResult.personalizationContext?.enabled);

const roleKnowledge = buildLokiKnowledgeProvider(partnerState);
const roleContext = { actor: { role: 'partner' }, user: { ...partnerState.user, keys: partnerState.userKeys, favorites: partnerState.favorites }, knowledgeEngine: roleKnowledge, memory: {} };
const rolePersonal = runPersonalizationEngine({
  question: 'что с workspace аналитикой',
  result: runLokiKnowledgeEngine({ text: 'что с workspace аналитикой', appState: partnerState, context: roleContext }),
  context: roleContext,
  appState: partnerState,
});
assert.equal(rolePersonal.personalizationContext.enabled, true);
assert.ok(rolePersonal.personalizationContext.experience);

const sourceFiles = [
  'src/loki/core/personalization/PersonalizationEngine.js',
  'src/loki/core/personalization/UserContextBuilder.js',
  'src/loki/core/personalization/PreferenceResolver.js',
  'src/loki/core/personalization/RecommendationAdjuster.js',
  'src/loki/core/personalization/ExplanationBuilder.js',
  'src/loki/core/personalization/UserProfileAnalyzer.js',
];
for (const file of sourceFiles) {
  const source = readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /firebase|firestore|getDocs|onSnapshot|addDoc|updateDoc|fetch\(/i, file);
}

const groups = [
  { state: baseState, queries: ['где подстричься', 'найди стоматолога', 'какие подарки', 'куда сходить завтра', 'что нового'] },
  { state: experiencedState, queries: ['где массаж', 'хочу записаться на массаж', 'почему рекомендуешь именно это', 'какие акции', 'что получить за ключи'] },
  { state: partnerState, queries: ['что с workspace аналитикой', 'покажи заявки', 'найди партнёра', 'как пользоваться приложением', 'что ты знаешь обо мне'] },
  { state: { ...experiencedState, user: { ...experiencedState.user, role: 'admin' } }, queries: ['где массаж', 'какие мероприятия', 'что ты знаешь обо мне', 'покажи эксперта', 'какие новости'] },
  { state: { ...experiencedState, user: { ...experiencedState.user, level: 1 }, userKeys: 2 }, queries: ['где цветы', 'какие подарки', 'хочу акцию', 'как записаться', 'что дальше'] },
  { state: { ...experiencedState, favorites: ['barber-line'], bookings: [], visits: [] }, memory: { lastReasoningContext: massageReasoningMemory, lastJourneyContext: journeyPersonalized.journeyContext }, queries: ['где стрижка', 'хочу подстричься', 'почему именно этот', 'продолжим', 'готово'] },
  { state: { ...experiencedState, events: [] }, queries: ['какие мероприятия', 'куда сходить', 'что нового', 'где кофе', 'что ты знаешь обо мне'] },
  { state: { ...experiencedState, rewards: [] }, queries: ['какие подарки', 'что получить за ключи', 'где массаж', 'как добраться', 'какой телефон'] },
  { state: { ...experiencedState, analytics: null }, queries: ['workspace аналитика', 'мой профиль', 'сколько ключей', 'какие отзывы', 'где цветы'] },
  { state: experiencedState, memory: { lastJourneyContext: journeyPersonalized.journeyContext }, queries: ['что мы уже сделали', 'продолжим', 'есть запись завтра', 'что дальше', 'готово'] },
];

let checked = 0;
for (let i = 0; i < 30; i++) {
  for (const group of groups) {
    const query = group.queries[i % group.queries.length];
    const result = runPipeline(query, group.state, group.memory || {});
    assert.ok(result, query);
    assert.ok(result.text, query);
    assert.ok((result.cards || []).length <= 5, query);
    assert.ok(result.personalizationContext || result.intent === 'personalization.explain', query);
    if (result.personalizationContext?.enabled) {
      assert.ok(result.personalizationContext.privacy === 'loaded_app_state_only' || result.personalizationContext.privacyExplained, query);
      assert.ok((result.suggestions || []).length <= 3, query);
    }
    checked++;
  }
}

assert.equal(checked, 300);
console.log(`Loki Personalization Engine v1: ${checked} scenarios passed`);
