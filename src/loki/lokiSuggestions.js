import { LOKI_APP_ACTIONS, LOKI_ACTION_LABELS, createLokiAction } from './lokiActionTypes.js';
import { LOKI_EVENTS } from './lokiEvents.js';

export function getLokiSuggestion({ eventType, activePanel, payload = {} }) {
  if (eventType === LOKI_EVENTS.KEY_RECEIVED) {
    return {
      title: 'Ключ уже на месте',
      text: 'Можно сразу проверить прогресс и достижения.',
      action: createLokiAction(LOKI_APP_ACTIONS.SHOW_ACHIEVEMENTS),
      label: 'Посмотреть прогресс',
    };
  }

  if (eventType === LOKI_EVENTS.PARTNER_OPENED) {
    return {
      title: payload.partnerName ? payload.partnerName : 'Карточка партнёра',
      text: 'Хочешь посмотреть, что есть рядом?',
      action: createLokiAction(LOKI_APP_ACTIONS.SHOW_NEAREST_PARTNERS),
      label: 'Показать рядом',
    };
  }

  if (eventType === LOKI_EVENTS.EVENT_OPENED) {
    return {
      title: 'Афиша города',
      text: 'Открою мероприятия, которые можно запланировать.',
      action: createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENT, { eventId: payload.id }),
      label: LOKI_ACTION_LABELS[LOKI_APP_ACTIONS.OPEN_EVENT],
    };
  }

  if (eventType === LOKI_EVENTS.PRIZE_OPENED) {
    return {
      title: 'Подарки и розыгрыши',
      text: 'Проверим, на что можно обменять ключи.',
      action: createLokiAction(LOKI_APP_ACTIONS.OPEN_PRIZE, { prizeId: payload.id }),
      label: LOKI_ACTION_LABELS[LOKI_APP_ACTIONS.OPEN_PRIZE],
    };
  }

  if (eventType === LOKI_EVENTS.USER_LOGIN || eventType === LOKI_EVENTS.RETURN_VISIT) {
    return {
      title: 'Начнём с города',
      text: 'Могу показать партнёров рядом или открыть сканер.',
      action: createLokiAction(LOKI_APP_ACTIONS.SHOW_NEAREST_PARTNERS),
      label: 'Что рядом?',
    };
  }

  if (eventType === LOKI_EVENTS.APP_ERROR) {
    return {
      title: 'Помогу вернуться',
      text: 'Можно открыть главную точку приложения.',
      action: createLokiAction(LOKI_APP_ACTIONS.SHOW_PROFILE),
      label: 'Открыть профиль',
    };
  }

  if (activePanel === 'home') {
    return {
      title: 'Что дальше?',
      text: 'Хочешь посмотреть новые события?',
      action: createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENT),
      label: 'События',
    };
  }

  if (activePanel === 'profile') {
    return {
      title: 'Твой прогресс',
      text: 'Показать достижения и задания?',
      action: createLokiAction(LOKI_APP_ACTIONS.SHOW_ACHIEVEMENTS),
      label: 'Открыть',
    };
  }

  return null;
}
