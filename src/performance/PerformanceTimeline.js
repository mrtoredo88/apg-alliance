export const SLOW_STAGE_MS = 500;
export const CRITICAL_STAGE_MS = 1000;

export function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') return Math.round(performance.now());
  return Date.now();
}

export function normalizeMark(mark = {}, index = 0, startedAt = 0) {
  const at = Number(mark.at ?? mark.time ?? nowMs());
  const relative = Math.max(0, Math.round(mark.relativeMs ?? (startedAt ? at - startedAt : at)));
  return {
    id: mark.id || `${mark.stage || mark.name || 'mark'}:${index}`,
    stage: String(mark.stage || mark.name || 'unknown'),
    group: String(mark.group || 'boot'),
    at,
    relativeMs: relative,
    detail: mark.detail || null,
  };
}

export function buildTimeline(marks = [], startedAt = 0) {
  const sorted = (Array.isArray(marks) ? marks : [])
    .map((mark, index) => normalizeMark(mark, index, startedAt))
    .sort((a, b) => a.relativeMs - b.relativeMs);
  return sorted.map((mark, index) => {
    const prev = sorted[index - 1] || null;
    const durationMs = Math.max(0, Math.round(mark.relativeMs - (prev?.relativeMs ?? 0)));
    return {
      ...mark,
      durationMs,
      severity: durationMs >= CRITICAL_STAGE_MS ? 'critical' : durationMs >= SLOW_STAGE_MS ? 'slow' : 'ok',
    };
  });
}

export function groupTimeline(timeline = []) {
  return timeline.reduce((acc, item) => {
    const key = item.group || 'boot';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}
