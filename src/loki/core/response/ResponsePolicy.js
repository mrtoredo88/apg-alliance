import { normalizeText } from '../lokiCoreUtils.js';
import { applyLokiPreferences } from '../memory/PreferenceMemory.js';

const HIDDEN_LINES = [
  /^(?:уч[её]л|учитываю) текущие данные/i,
  /^по актуальным данным/i,
  /^первый запуск прош[её]л/i,
  /^система готова/i,
  /^следующее действие\s*:/i,
];

const STRICT_RULES = [
  {
    id: 'coffee',
    query: ['кофе', 'кофейн', 'капучино', 'латте'],
    types: ['partner', 'location'],
    terms: ['кофе', 'кофейн', 'кафе', 'пекар', 'выпеч', 'десерт', 'ресторан', 'завтрак', 'капучино', 'латте'],
    empty: 'Понял запрос про кофе, но подходящих мест в данных АПГ пока не нашёл.',
  },
  {
    id: 'flowers',
    query: ['цветы', 'цветок', 'букет', 'флорист'],
    types: ['partner', 'location'],
    terms: ['цвет', 'букет', 'флорист'],
    empty: 'Понял запрос про цветы, но подходящих мест в данных АПГ пока не нашёл.',
  },
  {
    id: 'events',
    query: ['мероприят', 'событ', 'афиш', 'куда сходить'],
    types: ['event'],
    empty: 'Подходящих мероприятий в данных АПГ пока нет.',
  },
  {
    id: 'experts',
    query: ['эксперт', 'специалист', 'психолог', 'юрист', 'консультант'],
    types: ['expert'],
    empty: 'Подходящих экспертов в данных АПГ пока не нашёл.',
  },
  {
    id: 'gifts',
    query: ['подар', 'приз', 'награ'],
    types: ['gift', 'reward', 'prize'],
    empty: 'Доступных подарков в данных АПГ пока нет.',
  },
  {
    id: 'news',
    query: ['новост', 'что нового', 'публикац'],
    types: ['news', 'article'],
    empty: 'Свежих новостей в данных АПГ пока нет.',
  },
  {
    id: 'promotions',
    query: ['акци', 'скидк', 'промо', 'предложен'],
    types: ['promotion', 'partner'],
    terms: ['акци', 'скид', 'промо', 'предложен', 'выгод'],
    empty: 'Подходящих акций в данных АПГ пока нет.',
  },
];

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function cardText(card = {}) {
  return normalizeText([
    card.title,
    card.text,
    card.label,
    ...list(card.meta),
    card.category,
    card.type,
  ].filter(Boolean).join(' '));
}

function detectRule(question = '') {
  const query = normalizeText(question);
  return STRICT_RULES.find(rule => rule.query.some(term => query.includes(term))) || null;
}

function matchesRule(card = {}, rule) {
  if (!rule) return true;
  const type = normalizeText(card.type);
  if (rule.types.length && !rule.types.includes(type)) return false;
  if (!rule.terms?.length) return true;
  const haystack = cardText(card);
  return rule.terms.some(term => haystack.includes(term));
}

function normalizeActions(card = {}) {
  const source = list(card.actions);
  const open = source.find(item => /^(открыть|читать|записаться)$/i.test(item.label || ''))
    || (card.action ? { label: card.type === 'news' ? 'Читать' : 'Открыть', action: card.action } : null);
  const route = source.find(item => /маршрут|карт/i.test(item.label || ''));
  const call = source.find(item => /позвонить|телефон/i.test(item.label || ''));
  return [
    open,
    route ? { ...route, label: 'Маршрут' } : null,
    call ? { ...call, label: 'Позвонить' } : null,
  ].filter(Boolean);
}

function normalizeCard(card = {}) {
  return {
    ...card,
    actions: normalizeActions(card),
  };
}

function uniqueCards(cards = []) {
  const seen = new Set();
  return cards.filter(card => {
    const key = `${card.type || ''}:${card.id || card.title || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function compactText(value) {
  const lines = String(value || '')
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter(line => !HIDDEN_LINES.some(pattern => pattern.test(line)));
  return [...new Set(lines)].slice(0, 3).join('\n');
}

function resultText(cards, rule, originalText, changed) {
  if (rule && !cards.length) return rule.empty;
  if (rule && changed) {
    const count = cards.length;
    const countText = count === 1 ? 'один подходящий вариант' : `${count} подходящих варианта`;
    return `Нашёл ${countText}.\nЛучшее сейчас — «${cards[0].title || 'первый вариант'}».`;
  }
  return compactText(originalText);
}

export function applyLokiResponsePolicy({ question = '', result = {}, userMemory = {} } = {}) {
  const rule = detectRule(question);
  const rawCards = uniqueCards(list(result.cards).length ? list(result.cards) : result.card ? [result.card] : []);
  const intentCards = uniqueCards(rawCards.filter(card => matchesRule(card, rule))).map(normalizeCard);
  const preferenceResult = applyLokiPreferences(intentCards, userMemory.preferences);
  const cards = preferenceResult.cards;
  const changed = cards.length !== rawCards.length || cards.some((card, index) => card !== intentCards[index]);
  const text = resultText(cards, rule, result.text, changed) || 'Готово.';
  return {
    ...result,
    text,
    card: cards[0] || null,
    cards,
    responsePolicy: {
      version: 'v1',
      rule: rule?.id || 'general',
      checked: rawCards.length,
      accepted: cards.length,
      rejected: Math.max(0, rawCards.length - cards.length),
      changed,
      preferences: preferenceResult.applied,
    },
  };
}

export const LOKI_RESPONSE_POLICY_RULES = STRICT_RULES;
