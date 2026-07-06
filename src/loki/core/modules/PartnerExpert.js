import { LOKI_APP_ACTIONS, createLokiAction } from '../../lokiActionTypes.js';
import { includesAny, makeResultCard, normalizeText, openNearbyResult, titleOf } from '../lokiCoreUtils.js';

function findPartners(query, partners = []) {
  const categoryHints = [
    ['кофе', 'кофейн', 'кофей', 'капучино'],
    ['еда', 'поесть', 'ресторан', 'кафе', 'ужин', 'обед', 'завтрак', 'пицца'],
    ['массаж', 'спа', 'spa'],
    ['красота', 'салон', 'маникюр', 'стриж', 'бров'],
    ['спорт', 'фитнес', 'йога'],
    ['дет', 'семь', 'ребен', 'праздник'],
    ['подар', 'цвет', 'сувенир'],
  ].filter(group => includesAny(query, group)).flat();

  return partners
    .map(partner => {
      const haystack = normalizeText([
        partner.name,
        partner.category,
        partner.description,
        partner.address,
        partner.offer,
        partner.promo,
      ].filter(Boolean).join(' '));
      const score = [
        partner.name && query.includes(normalizeText(partner.name)) ? 8 : 0,
        categoryHints.some(hint => haystack.includes(hint)) ? 5 : 0,
        includesAny(query, haystack.split(/\s+/).filter(w => w.length > 4).slice(0, 18)) ? 2 : 0,
        partner.offer || partner.promo ? 1 : 0,
        partner.featured ? 1 : 0,
      ].reduce((sum, value) => sum + value, 0);
      return { ...partner, lokiScore: score };
    })
    .filter(partner => partner.lokiScore > 0)
    .sort((a, b) => b.lokiScore - a.lokiScore)
    .slice(0, 3);
}

function answerPartners(partners) {
  if (!partners.length) {
    return {
      intent: 'partner.empty',
      text: 'В АПГ пока нет информации об этом. Я не буду придумывать места.',
      card: openNearbyResult().card,
      cards: [],
    };
  }
  const first = partners[0];
  const reason = first.offer || first.promo
    ? 'сейчас там есть акция'
    : first.featured
      ? 'это заметный партнёр АПГ'
      : 'он подходит под твой запрос';
  const cards = partners.map(partner => makeResultCard(
    partner,
    'partner',
    createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: partner.id }),
  ));
  return {
    intent: 'partner.search',
    text: cards.length > 1
      ? `Нашёл ${cards.length} варианта. Я бы начал с «${titleOf(first, 'партнёра')}»: ${reason}.`
      : `Я бы начал с «${titleOf(first, 'партнёра')}»: ${reason}.`,
    card: cards[0],
    cards,
  };
}

export const PartnerExpert = {
  id: 'partnerExpert',
  label: 'Partner Expert',
  canHandle({ query }) {
    return includesAny(query, ['кофе', 'кофейн', 'поесть', 'еда', 'ресторан', 'кафе', 'ужин', 'обед', 'пицца', 'массаж', 'акци', 'скидк', 'салон', 'красот', 'спорт', 'йога', 'дет', 'выходн', 'подар', 'партнер', 'партнёр', 'места']);
  },
  handle({ query, context }) {
    return answerPartners(findPartners(query, context.apg.partners));
  },
};
