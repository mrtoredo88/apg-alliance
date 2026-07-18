import { normalizeText } from '../lokiCoreUtils.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function queryScore(entry = {}, query = '') {
  const q = normalizeText(query);
  const haystack = normalizeText(`${entry.key || ''} ${entry.label || ''} ${entry.scope || ''}`);
  if (!q || !haystack) return 0;
  return q.split(/\s+/).reduce((sum, token) => sum + (token.length > 2 && haystack.includes(token) ? 0.12 : 0), 0);
}

export function rankMemoryEntries(entries = [], { query = '', limit = 12 } = {}) {
  return list(entries)
    .map(entry => {
      const frequency = Math.min(1, Number(entry.frequency || 0) / 10);
      const confidence = Number(entry.confidence || 0);
      const relevance = Number(entry.relevance || 0);
      const decay = Number(entry.decay ?? 1);
      const score = (relevance * 0.38) + (confidence * 0.28) + (frequency * 0.2) + (decay * 0.14) + queryScore(entry, query);
      return { ...entry, score: Math.round(score * 100) / 100 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function memoryMatchScore(item = {}, snapshot = {}) {
  if (!snapshot?.used?.length) return 0;
  const haystack = normalizeText([
    item.category,
    item.categoryLabel,
    item.specialization,
    item.title,
    item.name,
    item.address,
    item.mainLocation?.address,
  ].filter(Boolean).join(' '));
  if (!haystack) return 0;
  return list(snapshot.used)
    .filter(entry => ['preference', 'conversation', 'recommendation'].includes(entry.type))
    .reduce((sum, entry) => sum + (haystack.includes(normalizeText(entry.key)) || haystack.includes(normalizeText(entry.label)) ? Number(entry.score || 0) : 0), 0);
}
