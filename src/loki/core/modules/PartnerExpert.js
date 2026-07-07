import { LOKI_APP_ACTIONS, createLokiAction } from '../../lokiActionTypes.js';
import { includesAny, makeResultCard, normalizeText, openNearbyResult, titleOf } from '../lokiCoreUtils.js';

const GENERIC_PARTNER_WORDS = ['партнер', 'партнёр', 'места', 'рядом', 'куда сходить', 'посоветуй', 'где можно', 'что есть', 'найди', 'подбери'];
const AMBIGUOUS_WORDS = ['салон', 'студия', 'мастер', 'записаться', 'услуга'];
const FOLLOWUP_WORDS = ['парковк', 'адрес', 'далеко', 'рядом', 'маршрут', 'как добраться', 'цена', 'дешев', 'подешевле', 'сегодня', 'открыто', 'вечер', 'поздно', 'работают', 'ближе', 'еще', 'ещё'];
const SEMANTIC_STOP_WORDS = new Set(['куда', 'сходить', 'можно', 'хочу', 'есть', 'хорошие', 'посоветуй', 'что', 'нибудь', 'рядом', 'сегодня', 'лучше', 'где']);
const SPECIFIC_SERVICE_WORDS = ['красот', 'маникюр', 'педикюр', 'ногти', 'ногот', 'стриж', 'парикмах', 'барбер', 'косметолог', 'бров', 'ресниц', 'массаж', 'spa', 'спа', 'кофе', 'капучино', 'завтрак', 'пицца', 'подар', 'цвет', 'фитнес', 'йога'];

function editDistance(a, b) {
  if (!a || !b) return Math.max(a.length, b.length);
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let leftTop = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = prev[j];
      prev[j] = a[i - 1] === b[j - 1]
        ? leftTop
        : Math.min(leftTop + 1, prev[j] + 1, prev[j - 1] + 1);
      leftTop = old;
    }
  }
  return prev[b.length];
}

function fuzzyWordHit(word, candidates) {
  if (word.length < 5) return false;
  return candidates.some(candidate => {
    if (candidate.includes(word) || word.includes(candidate)) return true;
    if (Math.abs(candidate.length - word.length) > 2) return false;
    return editDistance(word, candidate) <= 2;
  });
}

function scorePhrase(query, phrase) {
  const text = normalizeText(phrase);
  if (!text) return 0;
  if (query.includes(text)) return text.length > 8 ? 8 : 5;
  const words = text.split(/\s+/).filter(word => word.length > 3 && !SEMANTIC_STOP_WORDS.has(word));
  if (!words.length) return 0;
  const hits = words.filter(word => query.includes(word)).length;
  return hits ? Math.min(5, hits * 1.8) : 0;
}

function detectPartnerIntent(query, context) {
  const categories = context.knowledge?.categories ?? [];
  const lastQuery = normalizeText(context.memory?.lastConversation?.userText || context.memory?.lastUserText || '');
  const contextualQuery = includesAny(query, FOLLOWUP_WORDS) && lastQuery ? `${lastQuery} ${query}` : query;
  const scored = categories
    .map(category => {
      const phrases = [
        category.title,
        ...(category.includes ?? []),
        ...(category.synonyms ?? []),
      ];
      const score = phrases.reduce((sum, phrase) => sum + scorePhrase(contextualQuery, phrase), 0);
      return { ...category, score };
    })
    .filter(category => category.score > 0)
    .sort((a, b) => b.score - a.score);

  const top = scored[0] ?? null;
  const second = scored[1] ?? null;
  const generic = includesAny(query, GENERIC_PARTNER_WORDS);
  const broadSalonRequest = includesAny(query, ['хочу в салон', 'в салон', 'салон']) && !includesAny(query, SPECIFIC_SERVICE_WORDS);
  const ambiguous = broadSalonRequest || (includesAny(query, AMBIGUOUS_WORDS) && (!top || top.score < 4 || (second && top.score < 8 && top.score - second.score < 3)));
  const previous = context.memory?.lastConversation?.answer || context.memory?.lastMessage?.text || '';

  return {
    category: top,
    candidates: scored.slice(0, 3),
    generic,
    ambiguous,
    followUp: includesAny(query, FOLLOWUP_WORDS) && !!(context.memory?.lastAction || context.memory?.lastConversation || context.memory?.lastMessage),
    previous: normalizeText(previous),
    contextualQuery,
  };
}

function partnerHaystack(partner) {
  return normalizeText([
    partner.name,
    partner.category,
    partner.description,
    partner.address,
    partner.offer,
    partner.promo,
    partner.tags?.join?.(' '),
    partner.keywords?.join?.(' '),
  ].filter(Boolean).join(' '));
}

function findPartners(query, partners = [], intent) {
  const categoryHints = [
    ...(intent.category?.includes ?? []),
    ...(intent.category?.synonyms ?? []),
    intent.category?.title,
  ].filter(Boolean).map(normalizeText);
  const hintWords = categoryHints.join(' ').split(/\s+/).filter(word => word.length > 3 && !SEMANTIC_STOP_WORDS.has(word));
  const sourceQuery = intent.contextualQuery || query;

  return partners
    .map(partner => {
      const haystack = partnerHaystack(partner);
      const queryWords = sourceQuery.split(/\s+/).filter(w => w.length > 3 && !SEMANTIC_STOP_WORDS.has(w));
      const categoryScore = categoryHints.reduce((sum, hint) => sum + (hint && haystack.includes(hint) ? 4 : 0), 0);
      const semanticScore = hintWords.reduce((sum, word) => sum + (haystack.includes(word) || fuzzyWordHit(word, haystack.split(/\s+/)) ? 1.35 : 0), 0);
      const queryScore = queryWords.reduce((sum, word) => sum + (haystack.includes(word) ? 1.25 : 0), 0);
      const score = [
        partner.name && query.includes(normalizeText(partner.name)) ? 10 : 0,
        categoryScore,
        semanticScore,
        queryScore,
        partner.offer || partner.promo ? 1 : 0,
        partner.featured ? 1 : 0,
      ].reduce((sum, value) => sum + value, 0);
      return { ...partner, lokiScore: score };
    })
    .filter(partner => partner.lokiScore > 0)
    .sort((a, b) => b.lokiScore - a.lokiScore)
    .slice(0, 3);
}

function answerClarify(intent) {
  const options = intent.candidates.length
    ? intent.candidates.flatMap(category => category.clarify ?? []).slice(0, 4)
    : ['Маникюр', 'Парикмахер', 'Косметолог', 'Массаж'];
  return {
    intent: 'partner.clarify',
    text: `Уточню, чтобы не промахнуться. Что именно нужно: ${options.join(', ')}?`,
    card: {
      title: 'Уточнить запрос',
      text: 'Напиши одно слово, например: маникюр, кофе, массаж или подарок.',
      label: 'Показать партнёров',
      action: createLokiAction(LOKI_APP_ACTIONS.SHOW_NEAREST_PARTNERS),
    },
    cards: [],
    emotion: 'thinking',
  };
}

function answerPartners(partners, intent) {
  if (!partners.length) {
    return {
      intent: 'partner.empty',
      text: intent.category
        ? `Я понял запрос как «${intent.category.title}», но в данных АПГ пока не нашёл подходящих партнёров. Я не буду придумывать места.`
        : 'В АПГ пока нет информации об этом. Я не буду придумывать места.',
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
      ? `Понял запрос${intent.category ? ` про «${intent.category.title}»` : ''}. Нашёл ${cards.length} варианта. Я бы начал с «${titleOf(first, 'партнёра')}»: ${reason}.`
      : `Понял запрос${intent.category ? ` про «${intent.category.title}»` : ''}. Я бы начал с «${titleOf(first, 'партнёра')}»: ${reason}.`,
    card: cards[0],
    cards,
  };
}

function answerFollowUp(intent) {
  const lastAction = intent?.lastAction;
  return {
    intent: 'partner.follow_up',
    text: 'Понял, ты продолжаешь прошлый запрос. Лучше открыть карточку места: там будут адрес, детали, контакты и всё, что партнёр добавил в АПГ.',
    card: lastAction?.type ? {
      title: 'Открыть карточку',
      text: 'Покажу место из прошлого ответа.',
      label: 'Открыть',
      action: lastAction,
    } : openNearbyResult().card,
    cards: [],
  };
}

export const PartnerExpert = {
  id: 'partnerExpert',
  label: 'Partner Expert',
  canHandle({ query, context }) {
    const intent = detectPartnerIntent(query, context);
    return intent.followUp || intent.generic || !!intent.category || includesAny(query, ['акци', 'скидк', 'партнер', 'партнёр', 'места', 'рядом']);
  },
  handle({ query, context }) {
    const intent = { ...detectPartnerIntent(query, context), lastAction: context.memory?.lastAction };
    if (intent.followUp && !intent.category && !intent.generic) return answerFollowUp(intent);
    if (intent.ambiguous) return answerClarify(intent);
    return answerPartners(findPartners(query, context.apg.partners, intent), intent);
  },
};
