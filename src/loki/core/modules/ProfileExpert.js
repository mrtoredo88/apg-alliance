import { LOKI_APP_ACTIONS, createLokiAction } from '../../lokiActionTypes.js';
import { includesAny } from '../lokiCoreUtils.js';

export const ProfileExpert = {
  id: 'profileExpert',
  label: 'Profile Expert',
  canHandle({ query }) {
    return includesAny(query, ['профиль', 'аккаунт', 'мои данные', 'избранн', 'настрой']);
  },
  handle({ query, context }) {
    const action = includesAny(query, ['избранн'])
      ? createLokiAction(LOKI_APP_ACTIONS.SHOW_FAVORITES)
      : includesAny(query, ['настрой'])
        ? createLokiAction(LOKI_APP_ACTIONS.OPEN_SETTINGS)
        : createLokiAction(LOKI_APP_ACTIONS.SHOW_PROFILE);
    return {
      intent: 'profile.open',
      text: context.user.name ? `Открою профиль, ${context.user.name}.` : 'Открою профиль.',
      card: { title: 'Профиль', text: 'Ключи, достижения, избранное и настройки.', action, label: 'Открыть' },
      cards: [],
    };
  },
};
