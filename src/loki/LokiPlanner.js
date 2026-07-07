import { LOKI_APP_ACTIONS, createLokiAction } from './lokiActionTypes.js';
import { makeResultCard, toMillis } from './core/lokiCoreUtils.js';
import { scoreItemByLearning } from './LokiLearning.js';

function nowHour(now = new Date()) {
  return now.getHours();
}

function hasOffer(item = {}) {
  return Boolean(item.offer || item.promo || item.discount || item.specialOffer || item.actionText);
}

function eventTime(event = {}) {
  return toMillis(event.date ?? event.startAt ?? event.startsAt ?? event.createdAt);
}

function partnerScore(partner, learning) {
  return (partner.featured ? 2 : 0) + (hasOffer(partner) ? 2 : 0) + scoreItemByLearning(partner, learning);
}

function eventScore(event, learning, now = Date.now()) {
  const ms = eventTime(event);
  const soonBonus = ms > now && ms - now < 1000 * 60 * 60 * 8 ? 4 : 0;
  return soonBonus + (event.featured ? 1 : 0) + scoreItemByLearning(event, learning);
}

function pickMealPartner(partners, learning, now = new Date()) {
  const hour = nowHour(now);
  const mealWords = hour < 12
    ? ['завтрак', 'кофе', 'кофейн', 'кафе']
    : hour < 18
      ? ['обед', 'кафе', 'поесть', 'ресторан']
      : ['ужин', 'ресторан', 'кафе', 'пицца'];
  return partners
    .map(partner => {
      const text = [partner.name, partner.category, partner.description, partner.offer, partner.promo].filter(Boolean).join(' ').toLowerCase();
      const mealBonus = mealWords.some(word => text.includes(word)) ? 4 : 0;
      return { item: partner, score: mealBonus + partnerScore(partner, learning) };
    })
    .sort((a, b) => b.score - a.score)[0]?.item ?? null;
}

function pickBestEvent(events, learning, now = Date.now()) {
  return events
    .filter(event => {
      const ms = eventTime(event);
      return !ms || ms >= now - 1000 * 60 * 60 * 4;
    })
    .map(event => ({ item: event, score: eventScore(event, learning, now) }))
    .sort((a, b) => b.score - a.score)[0]?.item ?? null;
}

function pickDiscoveryPartner(partners, learning, excludeId) {
  return partners
    .filter(partner => partner.id !== excludeId)
    .map(partner => ({ item: partner, score: partnerScore(partner, learning) + (partner.createdAt ? 1 : 0) }))
    .sort((a, b) => b.score - a.score)[0]?.item ?? null;
}

export function buildPersonalRoute({ appState = {}, learning = {}, now = new Date() } = {}) {
  const partners = appState.partners ?? [];
  const events = appState.events ?? [];
  const route = [];
  const meal = pickMealPartner(partners, learning, now);
  if (meal) {
    route.push({
      step: 'Зайти в место',
      title: meal.name ?? 'Партнёр АПГ',
      text: hasOffer(meal) ? 'Там есть актуальное предложение.' : (meal.category || meal.address || 'Хорошая точка для начала маршрута.'),
      card: makeResultCard(meal, 'partner', createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: meal.id })),
    });
  }
  const event = pickBestEvent(events, learning, now.getTime());
  if (event) {
    route.push({
      step: 'Поймать событие',
      title: event.title ?? 'Мероприятие',
      text: event.location || event.place || 'Подходит для сегодняшней прогулки.',
      card: makeResultCard(event, 'event', createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENT, { eventId: event.id })),
    });
  }
  const discovery = pickDiscoveryPartner(partners, learning, meal?.id);
  if (discovery) {
    route.push({
      step: 'Открыть новое',
      title: discovery.name ?? 'Новый партнёр',
      text: hasOffer(discovery) ? 'Можно совместить с акцией и получить пользу.' : (discovery.category || 'Ещё одно место в АПГ.'),
      card: makeResultCard(discovery, 'partner', createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: discovery.id })),
    });
  }
  if (!route.length) {
    return {
      intent: 'planner.empty',
      text: 'Пока у меня мало данных для маршрута. Могу открыть партнёров рядом.',
      card: {
        title: 'Рядом со мной',
        text: 'Покажу места АПГ поблизости.',
        action: createLokiAction(LOKI_APP_ACTIONS.SHOW_NEAREST_PARTNERS),
        label: 'Показать рядом',
      },
      cards: [],
    };
  }
  return {
    intent: 'planner.route',
    text: `Собрал короткий маршрут на сегодня: ${route.map(item => item.step.toLowerCase()).join(', ')}.`,
    card: route[0].card,
    cards: route.map(item => ({ ...item.card, title: `${item.step}: ${item.title}`, text: item.text })),
    reason: 'Я учёл время дня, актуальные мероприятия, партнёров и твои прошлые интересы.',
  };
}

export function buildSurprisePick({ appState = {}, learning = {}, history = [] } = {}) {
  const recentIds = new Set(history.slice(0, 12).map(item => item.card?.id || item.adviceId).filter(Boolean));
  const candidates = [
    ...(appState.partners ?? []).map(item => ({ item, type: 'partner', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: item.id }), score: partnerScore(item, learning) + (hasOffer(item) ? 2 : 0) })),
    ...(appState.events ?? []).map(item => ({ item, type: 'event', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENT, { eventId: item.id }), score: eventScore(item, learning) + 1 })),
    ...(appState.news ?? []).map(item => ({ item, type: 'news', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_NEWS, { newsId: item.id }), score: scoreItemByLearning(item, learning) + 0.5 })),
  ]
    .filter(candidate => candidate.item?.id && !recentIds.has(candidate.item.id))
    .sort((a, b) => b.score - a.score);
  const pick = candidates[0];
  if (!pick) {
    return {
      intent: 'planner.surprise_empty',
      text: 'Сейчас нечем удивить без выдумок. Открою места рядом, там легче найти что-то новое.',
      card: {
        title: 'Исследовать рядом',
        text: 'Покажу партнёров поблизости.',
        action: createLokiAction(LOKI_APP_ACTIONS.SHOW_NEAREST_PARTNERS),
        label: 'Показать',
      },
      cards: [],
    };
  }
  const card = makeResultCard(pick.item, pick.type, pick.action);
  return {
    intent: 'planner.surprise',
    text: `Удивлю вот этим: «${card.title}». Выбрал не случайно: это выглядит полезно прямо сейчас.`,
    card,
    cards: [card],
  };
}
