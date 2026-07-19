export const PERFORMANCE_STORAGE_KEY = 'apg_performance_observatory_v1';
export const PERFORMANCE_HISTORY_LIMIT = 20;

function hasWindow() {
  return typeof window !== 'undefined';
}

function safeParse(value, fallback) {
  try {
    const parsed = JSON.parse(value || '');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function readPerformanceRuns() {
  if (!hasWindow()) return [];
  try {
    const rows = safeParse(localStorage.getItem(PERFORMANCE_STORAGE_KEY), []);
    return Array.isArray(rows) ? rows.filter(Boolean).slice(-PERFORMANCE_HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

export function writePerformanceRuns(runs = []) {
  if (!hasWindow()) return [];
  const list = Array.isArray(runs) ? runs.filter(Boolean).slice(-PERFORMANCE_HISTORY_LIMIT) : [];
  try {
    localStorage.setItem(PERFORMANCE_STORAGE_KEY, JSON.stringify(list));
  } catch {}
  return list;
}

export function appendPerformanceRun(run) {
  if (!run) return readPerformanceRuns();
  return writePerformanceRuns([...readPerformanceRuns(), run]);
}

export function clearPerformanceRuns() {
  if (!hasWindow()) return;
  try {
    localStorage.removeItem(PERFORMANCE_STORAGE_KEY);
  } catch {}
}
