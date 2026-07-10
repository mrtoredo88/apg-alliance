import { LOKI_APP_ACTIONS, createLokiAction } from './lokiActionTypes.js';
import { makeResultCard, normalizeText, toMillis } from './core/lokiCoreUtils.js';
import { buildLearningSnapshot, scoreItemByLearning } from './LokiLearning.js';
import { buildInterestProfile, scoreItemForInterests } from '../interestEngine.js';

export { buildInterestProfile };

const SCENARIOS = [
  {
    id: 'evening',
    title: 'Куда сходить вечером',
    words: ['вечер', 'вечером', 'после работы', 'погулять'],
    partnerWords: ['кафе', 'кофе', 'ужин', 'ресторан', 'баня', 'спа', 'массаж'],
    eventWords: ['вечер', 'встреча', 'концерт', 'мастер'],
  },
  {
    id: 'kids',
    title: 'Выходной с детьми',
    words: ['дети', 'ребенок', 'ребёнок', 'семья', 'семейный', 'выходной'],
    partnerWords: ['дет', 'сем', 'кафе', 'праздник'],
    eventWords: ['дет', 'сем', 'мастер', 'выходн'],
  },
  {
    id: 'beauty-day',
    title: 'Красота за один день',
    words: ['красота', 'маникюр', 'ногти', 'салон', 'уход', 'педикюр'],
    partnerWords: ['красот', 'маникюр', 'педикюр', 'салон', 'массаж', 'спа'],
    eventWords: ['красот', 'уход'],
  },
  {
    id: 'coffee-route',
    title: 'Маршрут по кофейням',
    words: ['кофе', 'кофейня', 'капучино', 'завтрак'],
    partnerWords: ['кофе', 'кафе', 'капучино', 'завтрак'],
    eventWords: ['кофе', 'завтрак'],
  },
  {
    id: 'sport',
    title: 'Для спортсменов',
    words: ['спорт', 'фитнес', 'тренировка', 'активность'],
    partnerWords: ['спорт', 'фитнес', 'йога', 'трен'],
    eventWords: ['спорт', 'трен', 'актив'],
  },
  {
    id: 'auto',
    title: 'Для автомобилистов',
    words: ['авто', 'машина', 'автомобиль', 'сервис'],
    partnerWords: ['авто', 'машин', 'сервис', 'мойка', 'шиномонтаж'],
    eventWords: ['авто'],
  },
  {
    id: 'business',
    title: 'Для предпринимателей',
    words: ['бизнес', 'предприниматель', 'деловая', 'нетворкинг'],
    partnerWords: ['бизнес', 'услуг', 'кофе'],
    eventWords: ['бизнес', 'нетворкинг', 'встреч'],
  },
];

function hasOffer(item = {}) {
  return Boolean(item.offer || item.promo || item.discount || item.specialOffer || item.actionText);
}

function itemText(item = {}) {
  return normalizeText([
    item.name,
    item.title,
    item.category,
    item.categoryLabel,
    item.specialization,
    item.description,
    item.offer,
    item.address,
    item.tags?.join?.(' '),
  ].filter(Boolean).join(' '));
}

function textMatches(item, words = []) {
  const text = itemText(item);
  return words.some(word => text.includes(normalizeText(word)));
}

function freshnessScore(item = {}) {
  const ms = toMillis(item.createdAt ?? item.updatedAt ?? item.publishedAt ?? item.date);
  if (!ms) return 0;
  const days = Math.max(0, (Date.now() - ms) / 86400000);
  return days < 2 ? 4 : days < 7 ? 2 : days < 21 ? 0.7 : 0;
}

function upcomingScore(item = {}) {
  const ms = toMillis(item.startAt ?? item.startsAt ?? item.date ?? item.eventDate);
  if (!ms) return 0;
  const diff = ms - Date.now();
  if (diff < -86400000) return -10;
  if (diff < 1000 * 60 * 60 * 3) return 5;
  if (diff < 1000 * 60 * 60 * 24 * 3) return 3;
  return 1;
}

function rankPartners(partners = [], learning = {}, interestProfile = null) {
  return partners
    .map(item => ({
      item,
      score: scoreItemByLearning(item, learning) + scoreItemForInterests(item, interestProfile, 'partner') * 0.35 + freshnessScore(item) + (hasOffer(item) ? 3 : 0) + (item.featured ? 1.5 : 0) + Number(item.viewCount || 0) / 100,
    }))
    .sort((a, b) => b.score - a.score);
}

function rankEvents(events = [], learning = {}, interestProfile = null) {
  return events
    .map(item => ({ item, score: scoreItemByLearning(item, learning) + scoreItemForInterests(item, interestProfile, 'event') * 0.35 + upcomingScore(item) + (item.featured ? 1 : 0) }))
    .filter(row => row.score > -1)
    .sort((a, b) => b.score - a.score);
}

function rankNews(news = [], learning = {}, interestProfile = null) {
  return news
    .map(item => ({ item, score: scoreItemByLearning(item, learning) + scoreItemForInterests(item, interestProfile, 'news') * 0.35 + freshnessScore(item) + Number(item.priority || 0) / 2 }))
    .sort((a, b) => b.score - a.score);
}

function rankExperts(experts = [], learning = {}, interestProfile = null) {
  return experts
    .map(item => ({ item, score: scoreItemByLearning(item, learning) + scoreItemForInterests(item, interestProfile, 'expert') * 0.35 + freshnessScore(item) + Number(item.avgRating || 0) + (item.verified ? 1 : 0) }))
    .sort((a, b) => b.score - a.score);
}

function recommendationCard(item, type) {
  const action = type === 'partner'
    ? createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: item.id })
    : type === 'event'
      ? createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENT, { eventId: item.id })
      : type === 'news'
        ? createLokiAction(LOKI_APP_ACTIONS.OPEN_NEWS, { newsId: item.id })
        : type === 'expert'
          ? createLokiAction(LOKI_APP_ACTIONS.OPEN_EXPERTS)
          : createLokiAction(LOKI_APP_ACTIONS.OPEN_PRIZE);
  return makeResultCard(item, type, action);
}

export function buildRecommendationFeed({ appState = {}, memory = {}, userMemory = {}, limit = 12 } = {}) {
  const learning = buildLearningSnapshot({ appState, memory, userMemory });
  const interestProfile = buildInterestProfile({ profile: appState.interestProfile, appState, memory, userMemory });
  const rows = [
    ...rankPartners(appState.partners, learning, interestProfile).slice(0, 5).map(row => ({ ...row, type: 'partner', reason: hasOffer(row.item) ? 'Есть актуальное предложение.' : 'Похоже на твои интересы.' })),
    ...rankEvents(appState.events, learning, interestProfile).slice(0, 4).map(row => ({ ...row, type: 'event', reason: 'Подходит по времени и интересам.' })),
    ...rankExperts(appState.experts, learning, interestProfile).slice(0, 4).map(row => ({ ...row, type: 'expert', reason: 'Эксперт может быть полезен по твоим интересам.' })),
    ...rankNews(appState.news, learning, interestProfile).slice(0, 4).map(row => ({ ...row, type: 'news', reason: 'Свежий материал в ленте АПГ.' })),
    ...(appState.userKeys > 0 ? (appState.prizes ?? []).slice(0, 2).map(item => ({ item, type: 'prize', score: 2, reason: 'Можно проверить, хватает ли ключей.' })) : []),
  ]
    .filter(row => row.item?.id)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(row => ({
      ...recommendationCard(row.item, row.type),
      reason: row.reason,
      score: Math.round(row.score * 10) / 10,
    }));
  return rows;
}

export function buildScenarioCollections({ appState = {}, memory = {}, userMemory = {} } = {}) {
  const learning = buildLearningSnapshot({ appState, memory, userMemory });
  const interestProfile = buildInterestProfile({ profile: appState.interestProfile, appState, memory, userMemory });
  return SCENARIOS.map(scenario => {
    const partners = rankPartners(appState.partners, learning, interestProfile)
      .filter(row => textMatches(row.item, scenario.partnerWords))
      .slice(0, 2)
      .map(row => recommendationCard(row.item, 'partner'));
    const events = rankEvents(appState.events, learning, interestProfile)
      .filter(row => textMatches(row.item, scenario.eventWords))
      .slice(0, 1)
      .map(row => recommendationCard(row.item, 'event'));
    const cards = [...partners, ...events].slice(0, 3);
    return {
      id: scenario.id,
      title: scenario.title,
      triggerWords: scenario.words,
      text: cards.length ? `Собрал ${cards.length} варианта из актуальных данных АПГ.` : 'Пока мало данных, но подборка готова к наполнению.',
      cards,
    };
  });
}

export function findScenarioForQuery(query, collections = []) {
  const text = normalizeText(query);
  return collections.find(collection => collection.triggerWords?.some(word => text.includes(normalizeText(word)))) ?? null;
}

export function buildEventCompanion({ event = null, appState = {}, memory = {}, userMemory = {} } = {}) {
  if (!event) return [];
  const learning = buildLearningSnapshot({ appState, memory, userMemory });
  const interestProfile = buildInterestProfile({ profile: appState.interestProfile, appState, memory, userMemory });
  const eventText = itemText(event);
  const partners = rankPartners(appState.partners, learning, interestProfile)
    .filter(row => eventText && itemText(row.item).split(/\s+/).some(word => word.length > 4 && eventText.includes(word)))
    .slice(0, 2)
    .map(row => ({ ...recommendationCard(row.item, 'partner'), reason: 'Может дополнить мероприятие.' }));
  const events = rankEvents(appState.events, learning, interestProfile)
    .filter(row => row.item.id !== event.id)
    .slice(0, 2)
    .map(row => ({ ...recommendationCard(row.item, 'event'), reason: 'Похожее мероприятие.' }));
  return [...partners, ...events].slice(0, 4);
}

export function buildRoleAssistantTips({ role = 'partner', appState = {} } = {}) {
  if (role === 'expert') {
    return [
      'Обновить описание профиля простым языком: чем помогаете и кому.',
      'Создать публикацию с полезным советом для жителей.',
      'Запланировать мероприятие или консультационный день.',
      'Проверить, какие вопросы пользователи чаще задают Локи.',
    ];
  }
  return [
    'Добавить короткую акцию с понятным сроком действия.',
    'Опубликовать новость партнёра с фото и конкретной выгодой.',
    'Проверить карточку: часы работы, телефон, маршрут и соцсети.',
    `Сейчас в АПГ ${appState.partners?.length || 0} партнёров. Выделиться поможет свежая акция или событие.`,
  ];
}
