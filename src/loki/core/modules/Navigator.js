import { LOKI_APP_ACTIONS, createLokiAction } from '../../lokiActionTypes.js';
import { includesAny, openNearbyResult } from '../lokiCoreUtils.js';

export const Navigator = {
  id: 'navigator',
  label: 'Navigator',
  canHandle({ query, context }) {
    return includesAny(query, ['покажи', 'открой', 'давай', 'перейди', 'рядом', 'карта', 'скан', 'профиль', 'уведомлен'])
      || !!(includesAny(query, ['еще', 'ещё', 'дальше']) && context.memory?.lastAction);
  },
  handle({ query, context }) {
    if (includesAny(query, ['покажи', 'открой', 'давай', 'перейди', 'еще', 'ещё', 'дальше']) && context.memory?.lastAction) {
      return { intent: 'navigation.followUp', text: 'Показываю.', card: null, cards: [], executeAction: context.memory.lastAction };
    }
    if (includesAny(query, ['рядом', 'поблизости', 'карта'])) {
      return { intent: 'navigation.nearby', ...openNearbyResult({ auto: includesAny(query, ['покажи', 'открой']) }) };
    }
    if (includesAny(query, ['скан', 'qr', 'куар', 'ключ'])) {
      const action = createLokiAction(LOKI_APP_ACTIONS.START_QR_SCANNER);
      return {
        intent: 'navigation.scanner',
        text: 'Открою сканер QR.',
        card: { title: 'Сканировать QR', text: 'Так можно получить ключ после посещения партнёра.', action, label: 'Открыть сканер' },
        cards: [],
      };
    }
    if (includesAny(query, ['профиль', 'аккаунт'])) {
      const action = createLokiAction(LOKI_APP_ACTIONS.SHOW_PROFILE);
      return {
        intent: 'navigation.profile',
        text: 'Открою профиль.',
        card: { title: 'Профиль', text: 'Ключи, достижения и настройки.', action, label: 'Открыть' },
        cards: [],
      };
    }
    if (includesAny(query, ['уведомлен'])) {
      const action = createLokiAction(LOKI_APP_ACTIONS.SHOW_NOTIFICATIONS);
      return {
        intent: 'navigation.notifications',
        text: 'Открою уведомления.',
        card: { title: 'Уведомления', text: 'Новости и важные сообщения АПГ.', action, label: 'Открыть' },
        cards: [],
      };
    }
    return null;
  },
};
