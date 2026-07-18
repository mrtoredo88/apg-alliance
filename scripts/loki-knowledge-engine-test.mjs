import assert from 'node:assert/strict';
import { buildLokiKnowledgeProvider, searchKnowledge } from '../src/loki/core/knowledge/KnowledgeProvider.js';
import { detectLokiIntent } from '../src/loki/core/intent/IntentRouter.js';
import { runLokiKnowledgeEngine } from '../src/loki/core/knowledge/SmartAnswerPipeline.js';

const partner = {
  id: 'partner-beauty',
  name: 'Салон Сияние',
  category: 'Красота',
  description: 'Маникюр, брови, укладки и уход',
  address: 'Зеленоград, 15 микрорайон',
  phone: '+7 999 111-22-33',
  telegramUrl: 'https://t.me/beauty',
  websiteUrl: 'https://beauty.example',
  offer: 'Скидка 15% на первое посещение',
  bookingUrl: 'https://booking.example/beauty',
  catalogPublished: true,
  locations: [
    { id: 'central', title: 'Центральный салон', address: 'Зеленоград, 15 микрорайон', phone: '+7 999 111-22-33', workingHours: 'Пн-Пт 10:00-21:00', isMain: true },
    { id: 'andreevka', title: 'Андреевка', address: 'Андреевка, Центральная 4', phone: '+7 999 222-33-44', workingHours: 'Ежедневно 11:00-20:00' },
  ],
};

const expert = {
  id: 'expert-psy',
  name: 'Анна Миронова',
  category: 'Психология',
  specialization: 'Семейный психолог',
  description: 'Консультации для родителей и подростков',
  services: ['Консультация', 'Диагностика'],
  phone: '+7 999 555-11-00',
  catalogPublished: true,
};

const event = {
  id: 'event-networking',
  title: 'Большой нетворкинг АПГ',
  category: 'Бизнес',
  description: 'Встреча предпринимателей Зеленограда',
  address: 'Культурный центр',
  startAt: new Date(Date.now() + 86400000).toISOString(),
  status: 'published',
};

const news = {
  id: 'news-city',
  title: 'Новые участники АПГ',
  category: 'apg',
  summary: 'В городе появились новые партнёры и полезные возможности.',
  text: 'АПГ расширяет партнёрскую сеть и добавляет новые городские сценарии.',
  publishedAt: new Date().toISOString(),
  status: 'published',
};

const gift = {
  id: 'gift-coffee',
  title: 'Кофе за ключи',
  description: 'Подарок можно получить за накопленные ключи.',
  cost: 5,
  active: true,
};

const appState = {
  activePanel: 'home',
  user: { id: 'user-1', first_name: 'Ольга', role: 'user' },
  userKeys: 12,
  favorites: ['partner-beauty'],
  partners: [partner],
  experts: [expert],
  events: [event],
  news: [news],
  rewards: [gift],
  reviews: [
    { id: 'review-1', partnerId: 'partner-beauty', rating: 5, text: 'Очень аккуратный маникюр', authorName: 'Мария' },
    { id: 'review-2', expertId: 'expert-psy', rating: 4, text: 'Полезная консультация', authorName: 'Ирина' },
  ],
  bookings: [
    { id: 'booking-1', providerId: 'partner-beauty', providerName: 'Салон Сияние', serviceTitle: 'Маникюр', locationId: 'central', locationTitle: 'Центральный салон', startAt: new Date(Date.now() + 7200000).toISOString(), status: 'confirmed' },
  ],
  dialogs: [
    { id: 'dialog-1', context: { title: 'Вопрос по записи', type: 'booking' }, lastMessage: { text: 'Можно перенести запись?' }, status: 'open' },
  ],
  analytics: {
    kpis: {
      profileViews: 120,
      newBookings: 8,
      newDialogs: 3,
      conversion: 6.7,
    },
  },
  customTasks: [{ id: 'task-1', title: 'Посетить партнёра' }],
  notifications: [{ id: 'n1', title: 'Новая акция' }],
};

const knowledge = buildLokiKnowledgeProvider(appState);
assert.equal(knowledge.counts.partners, 1);
assert.equal(knowledge.counts.locations, 2);
assert.equal(knowledge.counts.promotions, 1);
assert.equal(knowledge.counts.gifts, 1);
assert.equal(searchKnowledge(knowledge, 'Андреевка', ['location'], 1)[0].id, 'andreevka');
assert.equal(detectLokiIntent('где находится филиал в андреевке', knowledge).id, 'search.locations');

const directCases = [
  ['где сделать маникюр', 'search.partners'],
  ['какие есть филиалы', 'search.locations'],
  ['какие акции сейчас', 'search.promotions'],
  ['что подарить за ключи', 'search.gifts'],
  ['найди семейного психолога', 'search.specialists'],
  ['какие мероприятия завтра', 'search.events'],
  ['что нового в АПГ', 'news.question'],
  ['какой телефон салона', 'info.contacts'],
  ['когда работает салон', 'info.hours'],
  ['как записаться', 'info.booking'],
  ['что с workspace аналитикой', 'workspace.question'],
  ['сколько у меня ключей', 'profile.question'],
  ['какие отзывы', 'reviews.question'],
];

for (const [query, expectedIntent] of directCases) {
  const result = runLokiKnowledgeEngine({ text: query, appState });
  const expected = expectedIntent.startsWith('search.') || expectedIntent === 'news.question'
    ? `reasoning.${expectedIntent}`
    : expectedIntent;
  assert.equal(result?.intent, expected, query);
  assert.ok(result.text, query);
}

const questions = [
  'где сделать маникюр', 'найди салон красоты', 'покажи партнёров по красоте', 'куда сходить за бровями', 'есть студия в 15 микрорайоне',
  'где находится Андреевка', 'какие филиалы у партнёра', 'покажи адрес центрального салона', 'найди филиал в Зеленограде', 'какие локации доступны',
  'когда работает салон', 'какой график у филиала', 'открыто ли сегодня', 'часы работы центрального салона', 'до скольки работает Андреевка',
  'какой телефон', 'как позвонить партнёру', 'есть telegram', 'какой сайт у салона', 'контакты филиала',
  'можно записаться', 'как записаться на маникюр', 'есть свободная запись', 'покажи запись', 'что с моей бронью',
  'какие акции', 'есть скидки', 'что выгодного сейчас', 'покажи промо', 'какое предложение у салона',
  'какие подарки', 'что получить за ключи', 'есть призы', 'покажи розыгрыши', 'сколько стоит подарок',
  'найди психолога', 'какие есть специалисты', 'покажи экспертов', 'кто консультирует родителей', 'услуги эксперта',
  'какие мероприятия', 'куда сходить завтра', 'что в афише', 'есть бизнес встреча', 'покажи нетворкинг',
  'что нового', 'какие новости', 'покажи публикации', 'что в городской ленте', 'есть статья про АПГ',
  'какие отзывы', 'какой рейтинг', 'что пишут люди', 'есть отзывы филиала', 'мнения клиентов',
  'сколько у меня ключей', 'мой профиль', 'мои избранные', 'мои данные', 'мой прогресс',
  'workspace аналитика', 'что в кабинете', 'сколько заявок', 'сколько диалогов', 'конверсия workspace',
  'подскажи по этой карточке', 'расскажи про текущий объект', 'что здесь важно', 'что можно сделать тут', 'какие данные есть на экране',
  'найди место рядом', 'посоветуй куда сходить', 'хочу услугу', 'подбери место', 'что есть в АПГ',
  'ищу адрес', 'маршрут до филиала', 'как добраться', 'где центральный офис', 'филиал центральный',
  'анна миронова', 'семейный психолог', 'консультация для родителей', 'эксперт по подросткам', 'диагностика',
  'большой нетворкинг', 'встреча предпринимателей', 'мероприятие бизнес', 'регистрация на событие', 'события завтра',
  'кофе за ключи', 'подарок кофе', 'награда за ключи', 'приз кофе', 'получить подарок',
  'новые участники', 'новая сеть партнёров', 'городские возможности', 'статья АПГ', 'публикация про партнёров',
];

assert.equal(questions.length, 100);

let answered = 0;
for (const query of questions) {
  const result = runLokiKnowledgeEngine({ text: query, appState });
  if (result?.text && !/не знаю/i.test(result.text)) answered++;
}

assert.ok(answered >= 92, `Expected at least 92 answered questions, got ${answered}`);

console.log(`Loki Knowledge Engine v1: ${answered}/100 questions answered from APG data`);
