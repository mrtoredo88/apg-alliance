import { buildRecommendationFeed, buildRoleAssistantTips, buildScenarioCollections, findScenarioForQuery } from '../../LokiRecommendationCenter.js';

export const ConciergeEngine = {
  id: 'conciergeEngine',
  label: 'City Concierge',
  canHandle({ query }) {
    return [
      'локо рекомендует',
      'локи рекомендует',
      'рекомендуй',
      'подборк',
      'куда сходить',
      'вечер',
      'выходной',
      'с детьми',
      'для спортсмен',
      'для автомобилист',
      'для предприним',
      'партнеру',
      'партнёру',
      'эксперту',
    ].some(word => query.includes(word));
  },
  handle({ query, context }) {
    if (query.includes('партнеру') || query.includes('партнёру')) {
      const tips = buildRoleAssistantTips({ role: 'partner', appState: context.apg });
      return {
        intent: 'concierge.partner_assistant',
        text: `Для партнёра я бы начал с этого: ${tips[0]}`,
        card: null,
        cards: tips.map((tip, idx) => ({ id: `partner-tip-${idx}`, type: 'tip', title: `Совет ${idx + 1}`, text: tip, label: 'Принято' })),
      };
    }
    if (query.includes('эксперту')) {
      const tips = buildRoleAssistantTips({ role: 'expert', appState: context.apg });
      return {
        intent: 'concierge.expert_assistant',
        text: `Для эксперта я бы начал с этого: ${tips[0]}`,
        card: null,
        cards: tips.map((tip, idx) => ({ id: `expert-tip-${idx}`, type: 'tip', title: `Совет ${idx + 1}`, text: tip, label: 'Принято' })),
      };
    }

    const appState = {
      ...context.apg,
      activePanel: context.user?.currentPanel,
      userKeys: context.user?.keys,
    };
    const collections = buildScenarioCollections({ appState, memory: context.memory, userMemory: context.userMemory });
    const scenario = findScenarioForQuery(query, collections);
    if (scenario?.cards?.length) {
      return {
        intent: `concierge.scenario.${scenario.id}`,
        text: `${scenario.title}. ${scenario.text}`,
        card: scenario.cards[0],
        cards: scenario.cards,
      };
    }

    const cards = buildRecommendationFeed({ appState, memory: context.memory, userMemory: context.userMemory, limit: 5 });
    return {
      intent: 'concierge.feed',
      text: cards.length ? 'Собрал персональную подборку по твоим интересам.' : 'Пока мало данных для персональной подборки. Чем больше ты пользуешься АПГ, тем точнее я становлюсь.',
      card: cards[0] ?? null,
      cards,
    };
  },
};
