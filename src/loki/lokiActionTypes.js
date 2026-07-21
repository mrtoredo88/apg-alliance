export const LOKI_APP_ACTIONS = {
  OPEN_PARTNER: 'openPartner',
  OPEN_EVENT: 'openEvent',
  OPEN_NEWS: 'openNews',
  OPEN_PRIZE: 'openPrize',
  OPEN_PARTNERS: 'openPartners',
  OPEN_OFFERS: 'openOffers',
  OPEN_EXPERTS: 'openExperts',
  OPEN_EVENTS: 'openEvents',
  OPEN_NEWS_FEED: 'openNewsFeed',
  OPEN_TASKS: 'openTasks',
  OPEN_MAP: 'openMap',
  SHOW_NEAREST_PARTNERS: 'showNearestPartners',
  SHOW_PROFILE: 'showProfile',
  SHOW_ACHIEVEMENTS: 'showAchievements',
  SHOW_FAVORITES: 'showFavorites',
  SHOW_NOTIFICATIONS: 'showNotifications',
  START_QR_SCANNER: 'startQrScanner',
  OPEN_SETTINGS: 'openSettings',
  OPEN_REFERENCE: 'openReference',
  OPEN_LOKI: 'openLoki',
  ADD_FAVORITE_PARTNER: 'addFavoritePartner',
  START_EVENT_REGISTRATION: 'startEventRegistration',
};

export const LOKI_MESSAGE_PRIORITY = {
  CRITICAL: 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
};

export const LOKI_ACTION_LABELS = {
  [LOKI_APP_ACTIONS.OPEN_PARTNER]: 'Открыть',
  [LOKI_APP_ACTIONS.OPEN_EVENT]: 'Открыть',
  [LOKI_APP_ACTIONS.OPEN_NEWS]: 'Читать',
  [LOKI_APP_ACTIONS.OPEN_PRIZE]: 'Посмотреть',
  [LOKI_APP_ACTIONS.OPEN_PARTNERS]: 'Партнёры',
  [LOKI_APP_ACTIONS.OPEN_OFFERS]: 'Акции',
  [LOKI_APP_ACTIONS.OPEN_EXPERTS]: 'Эксперты',
  [LOKI_APP_ACTIONS.OPEN_EVENTS]: 'События',
  [LOKI_APP_ACTIONS.OPEN_NEWS_FEED]: 'Новости',
  [LOKI_APP_ACTIONS.OPEN_TASKS]: 'Задания',
  [LOKI_APP_ACTIONS.OPEN_MAP]: 'Открыть карту',
  [LOKI_APP_ACTIONS.SHOW_NEAREST_PARTNERS]: 'Показать рядом',
  [LOKI_APP_ACTIONS.SHOW_PROFILE]: 'Открыть профиль',
  [LOKI_APP_ACTIONS.SHOW_ACHIEVEMENTS]: 'Достижения',
  [LOKI_APP_ACTIONS.SHOW_FAVORITES]: 'Избранное',
  [LOKI_APP_ACTIONS.SHOW_NOTIFICATIONS]: 'Уведомления',
  [LOKI_APP_ACTIONS.START_QR_SCANNER]: 'Сканировать QR',
  [LOKI_APP_ACTIONS.OPEN_SETTINGS]: 'Настройки',
  [LOKI_APP_ACTIONS.OPEN_REFERENCE]: 'Справочник',
  [LOKI_APP_ACTIONS.OPEN_LOKI]: 'Спросить Локи',
  [LOKI_APP_ACTIONS.ADD_FAVORITE_PARTNER]: 'В избранное',
  [LOKI_APP_ACTIONS.START_EVENT_REGISTRATION]: 'К регистрации',
};

export function createLokiAction(type, payload = {}) {
  return { type, payload };
}

export function normalizeLokiActionRequest(request) {
  if (!request) return null;
  if (typeof request === 'string') return { type: request, payload: {} };
  if (typeof request.action === 'string') return { type: request.action, payload: request };
  if (typeof request.type === 'string') return { type: request.type, payload: request.payload ?? {} };
  return null;
}
