const HOUR_MS = 60 * 60 * 1000;
export const DAY_GRID_START_HOUR = 9;
export const DAY_GRID_END_HOUR = 22;
export const DEFAULT_EVENT_DURATION_MS = HOUR_MS;

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') {
    const d = value.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getEventInterval(event) {
  if (!event) return null;
  let start = toDate(event.startAt);
  if (!start) {
    const eventDate = typeof event.eventDate === 'string' ? event.eventDate : '';
    if (/^\d{4}-\d{2}-\d{2}T/.test(eventDate)) start = toDate(eventDate);
  }
  if (!start) return null;
  let end = toDate(event.endAt);
  if (!end || end.getTime() <= start.getTime()) end = new Date(start.getTime() + DEFAULT_EVENT_DURATION_MS);
  return { start, end };
}

export function isScheduleRelevant(event) {
  if (!event) return false;
  const status = String(event.status || event.lifecycleStatus || event.contentStatus || '').toLowerCase();
  if (status === 'deleted' || status === 'archived' || status === 'rejected') return false;
  if (event.active === false && status !== 'published') return false;
  return true;
}

export function intervalsOverlap(startA, endA, startB, endB) {
  return startA.getTime() < endB.getTime() && startB.getTime() < endA.getTime();
}

export function findEventConflicts(events, start, end, excludeId = null) {
  const s = toDate(start);
  const e = toDate(end);
  if (!s) return [];
  const effectiveEnd = e && e.getTime() > s.getTime() ? e : new Date(s.getTime() + DEFAULT_EVENT_DURATION_MS);
  const list = Array.isArray(events) ? events.filter(Boolean) : [];
  return list.filter(ev => {
    if (excludeId && ev.id === excludeId) return false;
    if (!isScheduleRelevant(ev)) return false;
    const interval = getEventInterval(ev);
    if (!interval) return false;
    return intervalsOverlap(s, effectiveEnd, interval.start, interval.end);
  });
}

export function buildDaySlots(events, date, fromHour = DAY_GRID_START_HOUR, toHour = DAY_GRID_END_HOUR) {
  const day = toDate(date) || new Date();
  const list = (Array.isArray(events) ? events.filter(Boolean) : [])
    .filter(isScheduleRelevant)
    .map(ev => ({ ev, interval: getEventInterval(ev) }))
    .filter(x => x.interval);

  const slots = [];
  for (let hour = fromHour; hour < toHour; hour++) {
    const slotStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + HOUR_MS);
    let occupiedMs = 0;
    const slotEvents = [];
    list.forEach(({ ev, interval }) => {
      if (!intervalsOverlap(slotStart, slotEnd, interval.start, interval.end)) return;
      const overlapStart = Math.max(slotStart.getTime(), interval.start.getTime());
      const overlapEnd = Math.min(slotEnd.getTime(), interval.end.getTime());
      occupiedMs = Math.min(HOUR_MS, occupiedMs + Math.max(0, overlapEnd - overlapStart));
      slotEvents.push(ev);
    });
    const state = !slotEvents.length ? 'free' : occupiedMs >= HOUR_MS ? 'busy' : 'partial';
    slots.push({ hour, state, events: slotEvents });
  }
  return slots;
}

export function findFreeWindows(slots) {
  const windows = [];
  let openStart = null;
  slots.forEach(slot => {
    if (slot.state === 'free') {
      if (openStart === null) openStart = slot.hour;
    } else if (openStart !== null) {
      windows.push({ from: openStart, to: slot.hour });
      openStart = null;
    }
  });
  if (openStart !== null && slots.length) windows.push({ from: openStart, to: slots[slots.length - 1].hour + 1 });
  return windows;
}

const FINISHED_GRACE_MS = 2 * HOUR_MS;

export function isEventFinished(event, now = Date.now()) {
  const interval = getEventInterval(event);
  if (interval) return interval.end.getTime() < now - FINISHED_GRACE_MS;
  const fallback = [event?.eventDate, event?.deadline].find(v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v));
  if (!fallback) return false;
  const d = new Date(fallback.length === 10 ? `${fallback}T23:59:59` : fallback);
  return !Number.isNaN(d.getTime()) && d.getTime() < now - FINISHED_GRACE_MS;
}

// Единые правила актуальности: опубликовано, не архив/удалено, не завершилось; ближайшие первыми
export function selectActualEvents(events, now = Date.now()) {
  return (Array.isArray(events) ? events.filter(Boolean) : [])
    .filter(isScheduleRelevant)
    .filter(ev => !isEventFinished(ev, now))
    .sort((a, b) => {
      const ia = getEventInterval(a);
      const ib = getEventInterval(b);
      if (!ia && !ib) return (Number(b.priority) || 0) - (Number(a.priority) || 0);
      if (!ia) return 1;
      if (!ib) return -1;
      const dt = ia.start.getTime() - ib.start.getTime();
      return dt !== 0 ? dt : (Number(b.priority) || 0) - (Number(a.priority) || 0);
    });
}

export function formatConflictLabel(event) {
  const interval = getEventInterval(event);
  const time = interval
    ? `${interval.start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}–${interval.end.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
    : 'время не указано';
  return `«${event?.title || 'Событие'}» (${time})`;
}
