import { LOKI_APP_ACTIONS, createLokiAction } from '../../lokiActionTypes.js';
import { includesAny } from '../lokiCoreUtils.js';

export const RewardsExpert = {
  id: 'rewardsExpert',
  label: 'Rewards Expert',
  canHandle({ query }) {
    return includesAny(query, ['ключ', 'заработ', 'получить', 'приз', 'розыгрыш', 'подар', 'достижен', 'задани']);
  },
  handle({ query, context }) {
    if (includesAny(query, ['ключ', 'заработ', 'получить'])) {
      const action = createLokiAction(LOKI_APP_ACTIONS.START_QR_SCANNER);
      return {
        intent: 'rewards.keys',
        text: `Сейчас у тебя ${context.user.keys} ключей. Самый надёжный способ получить ещё — посетить партнёра и отсканировать QR сотрудника.`,
        card: { title: 'Получить ключ', text: 'Открою сканер QR.', action, label: 'Сканировать QR' },
        cards: [],
      };
    }
    if (includesAny(query, ['достижен', 'задани'])) {
      const action = createLokiAction(LOKI_APP_ACTIONS.SHOW_ACHIEVEMENTS);
      return {
        intent: 'rewards.achievements',
        text: 'Открою твой прогресс. Там видны задания, ключи и достижения.',
        card: { title: 'Прогресс АПГ', text: 'Профиль и задания пользователя.', action, label: 'Открыть' },
        cards: [],
      };
    }
    const action = createLokiAction(LOKI_APP_ACTIONS.OPEN_PRIZE);
    return {
      intent: 'rewards.prizes',
      text: context.user.keys > 0
        ? 'Могу открыть раздел призов и розыгрышей. Доступность зависит от текущих условий в АПГ.'
        : 'Призы есть в отдельном разделе, но сначала стоит накопить ключи.',
      card: { title: 'Призы и розыгрыши', text: `${context.user.keys} ключей на балансе`, action, label: 'Открыть' },
      cards: [],
    };
  },
};
