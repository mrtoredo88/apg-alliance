import { getCapabilityRegistry } from './CapabilityRegistry.js';
import { isCapabilityAvailableForPlatform } from '../platformCapabilities.js';

const SYNONYMS = {
  BOOK_APPOINTMENT: ['записаться', 'запись', 'бронь', 'прием', 'приём', 'хочу прийти', 'забронировать', 'запиши меня'],
  SEARCH_PROMOTIONS: ['скидки', 'акции', 'предложения', 'выгодно', 'промо', 'дешевле'],
  VIEW_FRIENDS: ['друзья', 'знакомые', 'контакты'],
  SEARCH_PARTNERS: ['найди', 'где', 'рядом', 'место', 'партнёр', 'партнер'],
  SEARCH_EXPERTS: ['эксперт', 'специалист', 'врач', 'консультант'],
  SEARCH_EVENTS: ['мероприятия', 'события', 'афиша', 'куда сходить', 'чем заняться'],
  OPEN_REWARDS: ['награды', 'подарки', 'призы', 'вознаграждения'],
  OPEN_KEYS: ['ключи', 'баланс', 'заработать ключи'],
  OPEN_WORKSPACE: ['workspace', 'кабинет', 'рабочая зона'],
};

const STOP_WORDS = new Set(['покажи', 'открой', 'найди', 'хочу', 'какие', 'какая', 'какой', 'где', 'мои', 'мой', 'мне', 'меня', 'есть', 'сейчас']);

function normalize(value = '') {
  return String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function wordSet(value = '') {
  return new Set(normalize(value).split(/\s+/).filter(Boolean));
}

function phraseScore(query = '', phrase = '') {
  const q = normalize(query);
  const p = normalize(phrase);
  if (!q || !p) return 0;
  if (q.includes(p)) return p.length > 5 ? 34 : 24;
  const qWords = new Set([...wordSet(q)].filter(item => !STOP_WORDS.has(item)));
  const pWords = [...wordSet(p)];
  if (!pWords.length) return 0;
  const hits = pWords.filter(item => {
    if (qWords.has(item)) return true;
    const stem = item.slice(0, Math.min(4, item.length));
    return stem.length >= 4 && [...qWords].some(word => word.startsWith(stem) || item.startsWith(word.slice(0, Math.min(5, word.length))));
  }).length;
  return hits ? Math.round((hits / pWords.length) * 18) : 0;
}

function sequenceBonus(query = '', capabilityId = '') {
  const q = normalize(query);
  if (capabilityId === 'BOOK_APPOINTMENT' && /сразу|потом|после|и\s+запиш/.test(q)) return 8;
  if (capabilityId.startsWith('SEARCH_') && /найди|подбери|покажи|какие|где/.test(q)) return 8;
  if (capabilityId.startsWith('OPEN_') && /открой|покажи|перейди|хочу посмотреть/.test(q)) return 6;
  return 0;
}

function conflictPenalty(query = '', capabilityId = '') {
  const q = normalize(query);
  if (capabilityId === 'OPEN_WORKSPACE' && /(аналитик|показател|метрик|встреч|запис|акци|контент|мероприят|план дня)/.test(q)) return 24;
  if (capabilityId === 'BOOK_APPOINTMENT' && /(перенести|изменить|поменять|отменить|убрать|отказаться)/.test(q)) return 28;
  if (capabilityId === 'SEARCH_PARTNERS' && /(телеграм|telegram|whatsapp|ватсап|сайт|website|телефон|позвон|маршрут|добраться)/.test(q)) return 18;
  if (capabilityId === 'OPEN_PARTNER' && /(телеграм|telegram|whatsapp|ватсап|сайт|website|телефон|позвон|маршрут|добраться)/.test(q)) return 18;
  return 0;
}

export function matchCapabilities({ question = '', intent = {}, conversation = null, context = {}, memory = {} } = {}) {
  const source = [
    question,
    intent?.id,
    intent?.query,
    conversation?.effectiveQuestion,
    memory?.lastCapabilityContext?.capability,
  ].filter(Boolean).join(' ');
  const registry = getCapabilityRegistry();
  return registry
    .filter(capability => isCapabilityAvailableForPlatform(capability, { context }))
    .map(capability => {
      const aliases = [...capability.aliases, ...(SYNONYMS[capability.id] || [])];
      const aliasScore = aliases.reduce((sum, alias) => Math.max(sum, phraseScore(source, alias)), 0);
      const idScore = phraseScore(source, capability.id.replaceAll('_', ' '));
      const categoryScore = phraseScore(source, capability.category);
      const baseSignal = aliasScore + idScore + categoryScore;
      const signalScore = baseSignal ? baseSignal + sequenceBonus(source, capability.id) : 0;
      const score = signalScore ? signalScore + Number(capability.priority || 0) * 0.18 - conflictPenalty(source, capability.id) : 0;
      return {
        capability,
        score: Math.round(score),
        matchedAliases: aliases.filter(alias => phraseScore(source, alias) > 0).slice(0, 5),
      };
    })
    .filter(item => item.score > 8)
    .sort((a, b) => b.score - a.score || Number(b.capability.priority || 0) - Number(a.capability.priority || 0));
}

export function splitCapabilityClauses(question = '') {
  return normalize(question)
    .split(/\s+(?:и сразу|сразу|потом|затем|после этого|и)\s+/)
    .map(item => item.trim())
    .filter(item => item.length > 2);
}

export class CapabilityMatcher {
  match(input = {}) {
    return matchCapabilities(input);
  }
}
