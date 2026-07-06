import { LOKI_APP_ACTIONS, LOKI_MESSAGE_PRIORITY, createLokiAction } from './lokiActionTypes.js';

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value.toDate) return value.toDate().getTime();
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function daysSince(dateKey) {
  if (!dateKey) return Infinity;
  const ms = new Date(dateKey).getTime();
  if (!Number.isFinite(ms)) return Infinity;
  return (Date.now() - ms) / 86400000;
}

export function buildLokiRecommendations(appState = {}, memory = {}) {
  const {
    activePanel,
    partners = [],
    events = [],
    news = [],
    notifications = [],
    userKeys = 0,
    lastScanDate,
    unreadCount = 0,
    favorites = [],
  } = appState;
  const panelVisits = memory.panelVisits ?? {};
  const now = Date.now();
  const upcomingEvent = events
    .map(event => ({ ...event, eventMs: toMillis(event.date ?? event.startAt ?? event.startsAt ?? event.createdAt) }))
    .filter(event => event.eventMs > now && event.eventMs - now < 1000 * 60 * 90)
    .sort((a, b) => a.eventMs - b.eventMs)[0];
  const freshPartner = partners
    .map(partner => ({ ...partner, freshMs: toMillis(partner.createdAt ?? partner.updatedAt) }))
    .filter(partner => partner.freshMs && now - partner.freshMs < 1000 * 60 * 60 * 24 * 14)
    .sort((a, b) => b.freshMs - a.freshMs)[0];
  const unreadNews = news
    .map(item => ({ ...item, newsMs: toMillis(item.createdAt ?? item.date) }))
    .filter(item => item.newsMs && now - item.newsMs < 1000 * 60 * 60 * 24 * 5)
    .length;

  return [
    upcomingEvent && {
      id: `event-soon-${upcomingEvent.id}`,
      kind: 'proactive',
      priority: LOKI_MESSAGE_PRIORITY.HIGH,
      message: 'Скоро начинается мероприятие. Хочешь открыть афишу?',
      card: {
        title: upcomingEvent.title ?? 'Ближайшее мероприятие',
        text: 'До начала осталось совсем немного.',
        action: createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENT, { eventId: upcomingEvent.id }),
        label: 'Открыть',
      },
    },
    userKeys >= 3 && activePanel !== 'rewards' && {
      id: 'enough-keys-raffle',
      kind: 'proactive',
      priority: LOKI_MESSAGE_PRIORITY.NORMAL,
      message: 'У тебя уже хватает ключей для участия в розыгрыше.',
      card: {
        title: `${userKeys} ключей`,
        text: 'Можно посмотреть призы и розыгрыши.',
        action: createLokiAction(LOKI_APP_ACTIONS.OPEN_PRIZE),
        label: 'К призам',
      },
    },
    freshPartner && activePanel !== 'nearby' && {
      id: `fresh-partner-${freshPartner.id}`,
      kind: 'proactive',
      priority: LOKI_MESSAGE_PRIORITY.NORMAL,
      message: 'Сегодня рядом появился партнёр, которого стоит посмотреть.',
      card: {
        title: freshPartner.name ?? 'Новый партнёр',
        text: freshPartner.category ?? 'Новое место в АПГ',
        action: createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: freshPartner.id }),
        label: 'Посмотреть',
      },
    },
    daysSince(lastScanDate) > 6 && activePanel !== 'nearby' && {
      id: 'long-no-visits',
      kind: 'proactive',
      priority: LOKI_MESSAGE_PRIORITY.NORMAL,
      message: 'Ты давно не получал ключ. Хочешь посмотреть места рядом?',
      card: {
        title: 'Ключи рядом',
        text: 'Покажу партнёров поблизости.',
        action: createLokiAction(LOKI_APP_ACTIONS.SHOW_NEAREST_PARTNERS),
        label: 'Показать рядом',
      },
    },
    unreadCount > 0 && notifications.length > 0 && activePanel !== 'notifications' && {
      id: 'unread-notifications',
      kind: 'proactive',
      priority: LOKI_MESSAGE_PRIORITY.LOW,
      message: 'У тебя есть непрочитанные уведомления.',
      card: {
        title: `${unreadCount} новых`,
        text: 'Открою центр уведомлений.',
        action: createLokiAction(LOKI_APP_ACTIONS.SHOW_NOTIFICATIONS),
        label: 'Открыть',
      },
    },
    unreadNews > 0 && (panelVisits.home ?? 0) > 1 && activePanel !== 'home' && {
      id: 'fresh-news',
      kind: 'proactive',
      priority: LOKI_MESSAGE_PRIORITY.LOW,
      message: 'В новостях появилось кое-что свежее.',
      card: {
        title: 'Новости города',
        text: `${unreadNews} свежих материалов`,
        action: createLokiAction(LOKI_APP_ACTIONS.OPEN_NEWS),
        label: 'Читать',
      },
    },
    favorites.length > 0 && activePanel === 'profile' && {
      id: 'favorites-reminder',
      kind: 'proactive',
      priority: LOKI_MESSAGE_PRIORITY.LOW,
      message: 'В избранном уже есть места. Можно вернуться к ним позже.',
      card: {
        title: 'Избранное',
        text: `${favorites.length} сохранено`,
        action: createLokiAction(LOKI_APP_ACTIONS.SHOW_FAVORITES),
        label: 'Посмотреть',
      },
    },
  ].filter(Boolean);
}
