const TECHNICAL_PATTERNS = [
  /внутренн(?:ий|его) обработчик/i,
  /Loki Core debug/i,
  /\bundefined\b|\bnull\b|\[object Object\]/i,
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
  const safe = TECHNICAL_PATTERNS.some(pattern => pattern.test(raw))
    ? 'Не получилось ответить с первого раза. Повторите вопрос, пожалуйста.'
    : raw;
  const normalized = normalizeBullets(safe)
    .split('\n')
    .map(compactLine)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const lines = removeDuplicateLines(normalized.split('\n'));
  const text = lines.join('\n').trim() || 'Не получилось ответить с первого раза. Повторите вопрос, пожалуйста.';
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

export function isLokiUserDebugVisible() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) return true;
  try {
    return localStorage.getItem('apg_loki_debug') === '1' && localStorage.getItem('apg_loki_show_debug_ui') === '1';
  } catch {
    return false;
  }
}
