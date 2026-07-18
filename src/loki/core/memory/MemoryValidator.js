import { normalizeText } from '../lokiCoreUtils.js';
import { createMemoryEvent, LOKI_MEMORY_EVENTS } from './MemoryHistory.js';

const SENSITIVE_PATTERNS = [
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  /(?:\+?\d[\s\-()]{0,3}){8,}/,
  /парол|password|token|секрет|secret|карта|cvv|паспорт|адрес прожив/i,
  /личн(?:ая|ую|ые)\s+переписк/i,
];

const MAX_LABEL_LENGTH = 72;

export function sanitizeMemoryLabel(value = '') {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LABEL_LENGTH);
}

export function isSensitiveMemoryText(value = '') {
  const text = String(value ?? '').trim();
  if (!text) return false;
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(text));
}

export function validateMemorySignal(signal = {}) {
  const key = normalizeText(signal.key || signal.label);
  const label = sanitizeMemoryLabel(signal.label || signal.key);
  if (!key || !label) {
    return { ok: false, reason: 'empty_memory_signal', event: createMemoryEvent(LOKI_MEMORY_EVENTS.SKIPPED, { reason: 'empty_memory_signal' }) };
  }
  if (isSensitiveMemoryText(`${key} ${label}`)) {
    return { ok: false, reason: 'sensitive_memory_signal', event: createMemoryEvent(LOKI_MEMORY_EVENTS.SKIPPED, { key, reason: 'sensitive_memory_signal' }) };
  }
  return {
    ok: true,
    signal: {
      ...signal,
      key,
      label,
      type: signal.type || 'preference',
      scope: signal.scope || 'general',
      weight: Number(signal.weight || 1),
    },
  };
}

export function sanitizeMemoryMetadata(metadata = {}) {
  return Object.fromEntries(Object.entries(metadata || {})
    .filter(([key, value]) => !isSensitiveMemoryText(`${key} ${String(value ?? '')}`))
    .map(([key, value]) => [key, typeof value === 'number' || typeof value === 'boolean' ? value : sanitizeMemoryLabel(value)]));
}
