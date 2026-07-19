export const LOKI_USER_FALLBACK_TEXT = 'Не получилось ответить с первого раза. Повторите вопрос, пожалуйста.';

const BLOCKING_TECHNICAL_PATTERNS = [
  /внутренн(?:ий|его) обработчик/i,
  /Loki Core debug/i,
  /TypeError|ReferenceError|Unhandled Promise|Promise rejected/i,
];

const INLINE_TECHNICAL_PATTERNS = [
  /\bundefined\b|\bnull\b|\[object Object\]/gi,
];

function compactLine(line) {
  return String(line || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();
}

function normalizeBullets(text) {
  return String(text || '')
    .replace(/[ \t]*•[ \t]*/g, '\n• ')
    .replace(/\n{3,}/g, '\n\n');
}

function removeDuplicateLines(lines) {
  const seen = new Set();
  return lines.filter(line => {
    const key = compactLine(line).toLowerCase();
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeLokiResponseText(value, { maxLength = 900 } = {}) {
  const raw = String(value ?? '').replace(/\r/g, '\n');
  const safe = BLOCKING_TECHNICAL_PATTERNS.some(pattern => pattern.test(raw))
    ? LOKI_USER_FALLBACK_TEXT
    : INLINE_TECHNICAL_PATTERNS.reduce((next, pattern) => next.replace(pattern, ''), raw);
  const normalized = normalizeBullets(safe)
    .split('\n')
    .map(compactLine)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const lines = removeDuplicateLines(normalized.split('\n'));
  const text = lines.join('\n').trim() || LOKI_USER_FALLBACK_TEXT;
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

export function inspectLokiResponseText(value, options = {}) {
  const raw = String(value ?? '');
  const normalized = normalizeLokiResponseText(raw, options);
  const rawEmpty = !raw.trim();
  const blockedByTechnicalText = BLOCKING_TECHNICAL_PATTERNS.some(pattern => pattern.test(raw));
  const hadInlineTechnicalText = INLINE_TECHNICAL_PATTERNS.some(pattern => pattern.test(raw));
  const fallbackUsed = normalized === LOKI_USER_FALLBACK_TEXT && (rawEmpty || blockedByTechnicalText);
  return {
    raw,
    text: normalized,
    rawEmpty,
    blockedByTechnicalText,
    hadInlineTechnicalText,
    fallbackUsed,
  };
}

export function isLokiUserDebugVisible() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) return true;
  try {
    return localStorage.getItem('apg_loki_debug') === '1' && localStorage.getItem('apg_loki_show_debug_ui') === '1';
  } catch {
    return false;
  }
}
