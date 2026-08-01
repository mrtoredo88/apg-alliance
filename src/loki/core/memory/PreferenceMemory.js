import { normalizeText } from '../lokiCoreUtils.js';

const MAX_ENTITY_SIGNALS = 40;
const KNOWN_REASONS = new Set(['irrelevant', 'too_far', 'closed', 'expensive', 'other']);

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function entityKey(item = {}) {
  return normalizeText(item.id || item.title || item.name || '');
}

function remember(source = [], values = []) {
  const next = [...values, ...list(source)].map(normalizeText).filter(Boolean);
  return [...new Set(next)].slice(0, MAX_ENTITY_SIGNALS);
}

export function normalizeLokiPreferences(preferences = {}) {
  const source = preferences && typeof preferences === 'object' ? preferences : {};
  return {
    avoidEntities: list(source.avoidEntities).map(normalizeText).filter(Boolean).slice(0, MAX_ENTITY_SIGNALS),
    preferNearby: Math.max(0, Number(source.preferNearby || 0)),
    avoidClosed: Math.max(0, Number(source.avoidClosed || 0)),
    preferAffordable: Math.max(0, Number(source.preferAffordable || 0)),
    irrelevantCount: Math.max(0, Number(source.irrelevantCount || 0)),
    otherCount: Math.max(0, Number(source.otherCount || 0)),
    lastReason: String(source.lastReason || ''),
    updatedAt: source.updatedAt || null,
  };
}

export function buildExplicitPreferencePatch(preferences = {}, feedback = {}, task = {}) {
  const current = normalizeLokiPreferences(preferences);
  if (feedback.type !== 'negative' || !KNOWN_REASONS.has(feedback.reason)) return current;
  const resultEntities = list(task.results).map(entityKey).filter(Boolean);
  const next = {
    ...current,
    lastReason: feedback.reason,
    updatedAt: feedback.createdAt || new Date().toISOString(),
  };
  if (feedback.reason === 'irrelevant') {
    next.avoidEntities = remember(current.avoidEntities, resultEntities);
    next.irrelevantCount += 1;
  }
  if (feedback.reason === 'too_far') next.preferNearby += 1;
  if (feedback.reason === 'closed') next.avoidClosed += 1;
  if (feedback.reason === 'expensive') next.preferAffordable += 1;
  if (feedback.reason === 'other') next.otherCount += 1;
  return next;
}

function cardText(card = {}) {
  return normalizeText([
    card.title,
    card.text,
    card.category,
    ...list(card.meta),
  ].filter(Boolean).join(' '));
}

function distanceKm(card = {}) {
  const source = `${card.distance ?? ''} ${list(card.meta).join(' ')}`.replace(',', '.');
  const km = source.match(/(\d+(?:\.\d+)?)\s*км/i);
  if (km) return Number(km[1]);
  const meters = source.match(/(\d+)\s*м(?:\s|$)/i);
  if (meters) return Number(meters[1]) / 1000;
  return null;
}

function isClosed(card = {}) {
  return /(?:сейчас\s+)?закрыт[оа]?|не работает|выходной/.test(cardText(card));
}

function isExpensive(card = {}) {
  return /₽₽₽|премиум|люкс|дорог/.test(cardText(card));
}

export function applyLokiPreferences(cards = [], preferences = {}) {
  const normalized = normalizeLokiPreferences(preferences);
  const avoided = new Set(normalized.avoidEntities);
  const ranked = list(cards)
    .filter(card => !avoided.has(entityKey(card)))
    .filter(card => !(normalized.avoidClosed > 0 && isClosed(card)))
    .map((card, index) => {
      const distance = distanceKm(card);
      let score = -index * 0.01;
      if (normalized.preferNearby > 0 && distance != null) score -= distance * Math.min(4, normalized.preferNearby);
      if (normalized.preferAffordable > 0 && isExpensive(card)) score -= 8;
      return { card, score };
    })
    .sort((a, b) => b.score - a.score);
  return {
    cards: ranked.map(item => item.card),
    applied: {
      avoidEntities: Math.max(0, list(cards).length - ranked.length),
      preferNearby: normalized.preferNearby > 0,
      avoidClosed: normalized.avoidClosed > 0,
      preferAffordable: normalized.preferAffordable > 0,
    },
  };
}

export function describeLokiPreferences(preferences = {}) {
  const normalized = normalizeLokiPreferences(preferences);
  return [
    normalized.preferNearby > 0 ? { key: 'preferNearby', label: 'Предпочитаете места поближе' } : null,
    normalized.avoidClosed > 0 ? { key: 'avoidClosed', label: 'Не показывать закрытые места' } : null,
    normalized.preferAffordable > 0 ? { key: 'preferAffordable', label: 'Предпочитаете доступные варианты' } : null,
    normalized.avoidEntities.length ? { key: 'avoidEntities', label: 'Не повторять неподходящие варианты' } : null,
  ].filter(Boolean);
}
