export const PERSONALITY_HISTORY_LIMIT = 24;

export function normalizePersonalityHistory(value) {
  return (Array.isArray(value) ? value : []).filter(item => item?.id && item?.shownAt).slice(-PERSONALITY_HISTORY_LIMIT);
}

export function rememberPersonalityPhrase(history, phrase) {
  if (!phrase?.id) return normalizePersonalityHistory(history);
  return [...normalizePersonalityHistory(history).filter(item => item.id !== phrase.id), { id: phrase.id, shownAt: new Date().toISOString() }].slice(-PERSONALITY_HISTORY_LIMIT);
}

export function wasRecentlyUsed(history, id, windowSize = 12) {
  return normalizePersonalityHistory(history).slice(-windowSize).some(item => item.id === id);
}
