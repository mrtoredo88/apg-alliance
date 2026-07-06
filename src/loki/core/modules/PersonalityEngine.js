export const PersonalityEngine = {
  id: 'personalityEngine',
  label: 'Personality Engine',
  shape({ result, context }) {
    const base = result ?? { text: 'Пока я этого не знаю. В АПГ пока нет информации об этом.', card: null, cards: [] };
    const hasAction = !!(base.executeAction || base.autoAction || base.card?.action || base.cards?.some(card => card.action));
    const shortText = String(base.text || '').trim();
    return {
      ...base,
      text: shortText.length > 180 ? `${shortText.slice(0, 174).trim()}...` : shortText,
      emotion: base.emotion ?? (hasAction ? 'helper' : 'thinking'),
      tone: context.user?.name ? 'personal' : 'warm',
    };
  },
};
