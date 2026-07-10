export const PersonalityEngine = {
  id: 'personalityEngine',
  label: 'Personality Engine',
  shape({ result, context }) {
    const base = result ?? { text: 'Пока я этого не знаю. В АПГ пока нет информации об этом.', card: null, cards: [] };
    const hasAction = !!(base.executeAction || base.autoAction || base.card?.action || base.cards?.some(card => card.action));
    const shortText = String(base.text || '').trim();
    const limit = base.preserveText || base.format === 'decision' ? 720 : 180;
    return {
      ...base,
      text: shortText.length > limit ? `${shortText.slice(0, limit - 6).trim()}...` : shortText,
      emotion: base.emotion ?? (hasAction ? 'helper' : 'thinking'),
      tone: context.user?.name ? 'personal' : 'warm',
    };
  },
};
