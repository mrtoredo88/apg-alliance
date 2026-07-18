import { normalizeText } from '../lokiCoreUtils.js';
import { rememberSignals } from './MemoryStore.js';

const CATEGORY_HINTS = [
  ['coffee', 'кофейни', ['кофе', 'кофейн', 'капучино']],
  ['family_events', 'семейные мероприятия', ['детск', 'семейн', 'ребен', 'ребён', 'дети']],
  ['sport', 'спорт и здоровье', ['спорт', 'фитнес', 'трениров', 'йога']],
  ['wellness', 'wellness и восстановление', ['массаж', 'спа', 'здоров', 'релакс']],
  ['beauty', 'красота и уход', ['красота', 'салон', 'маникюр', 'стриж', 'барбер']],
  ['events', 'мероприятия', ['мероприят', 'событ', 'афиш', 'куда сходить']],
  ['rewards', 'ключи и подарки', ['ключ', 'приз', 'подар', 'награ']],
  ['promotions', 'акции и скидки', ['акци', 'скидк', 'выгод', 'промо']],
];

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function titleOf(item = {}) {
  return item.title || item.name || item.label || '';
}

function makeSignalsFromQuery(query = '') {
  const text = normalizeText(query);
  return CATEGORY_HINTS.flatMap(([key, label, words]) => words.some(word => text.includes(word))
    ? [{ type: 'preference', key, label, scope: 'category', relevance: 0.24, weight: 1 }]
    : []);
}

function makeSignalsFromCards(cards = []) {
  return list(cards).flatMap(card => {
    const signals = [];
    const category = normalizeText(card.category || card.meta?.[0] || card.type);
    if (category) signals.push({ type: 'activity', key: category, label: category, scope: card.type || 'card', relevance: 0.18, weight: 1 });
    const title = titleOf(card);
    if (title && ['partner', 'expert', 'event', 'gift', 'promotion'].includes(card.type)) {
      signals.push({ type: 'recommendation', key: `${card.type}:${card.id || title}`, label: title, scope: card.type, relevance: 0.22, weight: 1, metadata: { type: card.type } });
    }
    return signals;
  });
}

function makeSignalsFromResult(result = {}) {
  const signals = [];
  if (result.intent) signals.push({ type: 'activity', key: result.intent, label: result.intent, scope: 'intent', relevance: 0.16, weight: 1 });
  if (result.planContext?.goal) signals.push({ type: 'activity', key: result.planContext.goal, label: result.planContext.goal, scope: 'planner_goal', relevance: 0.2, weight: 1 });
  signals.push(...makeSignalsFromCards([result.card, ...list(result.cards)]));
  return signals;
}

export function collectMemorySignals({ memory = {}, query = '', result = {}, now = Date.now() } = {}) {
  const signals = [
    ...makeSignalsFromQuery(query),
    ...makeSignalsFromResult(result),
  ];
  return rememberSignals(memory, signals, now);
}
