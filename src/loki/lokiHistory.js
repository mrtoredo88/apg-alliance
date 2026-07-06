const LOKI_HISTORY_KEY = 'apg_loki_history_v1';

export function loadLokiHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOKI_HISTORY_KEY) || '[]');
    return Array.isArray(raw) ? raw.slice(0, 40) : [];
  } catch {
    return [];
  }
}

export function saveLokiHistory(items) {
  try {
    localStorage.setItem(LOKI_HISTORY_KEY, JSON.stringify(items.slice(0, 40)));
  } catch {}
}

export function addLokiHistoryItem(items, item) {
  const next = [{ id: `${Date.now()}_${item.type ?? 'message'}`, ts: Date.now(), status: 'shown', ...item }, ...items];
  return next.slice(0, 40);
}

export function markLokiHistoryItem(items, id, status) {
  return items.map(item => item.id === id ? { ...item, status, actedAt: Date.now() } : item);
}

export function getRecentAdviceIds(items, windowMs = 1000 * 60 * 60 * 24 * 7) {
  const cutoff = Date.now() - windowMs;
  return new Set(items.filter(item => item.ts > cutoff && item.adviceId).map(item => item.adviceId));
}
