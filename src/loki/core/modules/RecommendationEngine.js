import { LOKI_APP_ACTIONS, createLokiAction } from '../../lokiActionTypes.js';
import { includesAny, makeResultCard } from '../lokiCoreUtils.js';

export const RecommendationEngine = {
  id: 'recommendationEngine',
  label: 'Recommendation Engine',
  canHandle({ query }) {
    return includesAny(query, ['посоветуй', 'рекомендуй', 'лучше', 'куда', 'выбрать']);
  },
  handle({ context }) {
    const partner = context.apg.partners?.find(item => item.offer || item.promo || item.featured) ?? context.apg.partners?.[0];
    const event = context.apg.events?.[0];
    const cards = [
      partner && makeResultCard(partner, 'partner', createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: partner.id })),
      event && makeResultCard(event, 'event', createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENT, { eventId: event.id })),
    ].filter(Boolean);
    if (!cards.length) return { intent: 'recommendation.empty', text: 'Пока у меня мало данных для рекомендации.', card: null, cards: [] };
    return {
      intent: 'recommendation.personal',
      text: 'Я бы начал с этих вариантов: они выглядят самыми полезными прямо сейчас.',
      card: cards[0],
      cards,
    };
  },
};
