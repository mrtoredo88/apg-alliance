import { subscribeToEvents } from './EventBus.js';

const timeline = [];
const MAX_TIMELINE = 500;
let unsubscribe = null;

function compactActor(actor) {
  if (!actor) return null;
  if (typeof actor === 'string') return { id: actor };
  return {
    id: actor.id ? String(actor.id) : '',
    name: actor.name || actor.first_name || actor.email || '',
    source: actor.source || actor.platform || '',
  };
}

function normalizeTimelineEntry(event) {
  return {
    id: event.id,
    time: event.timestamp,
    type: event.type,
    source: event.source || event.platform || 'web-app',
    user: compactActor(event.actor),
    entity: {
      type: event.entityType || event.payload?.entityType || '',
      id: event.entityId || event.payload?.entityId || '',
      title: event.payload?.title || event.payload?.name || '',
    },
    action: event.payload?.action || '',
    payload: event.payload || {},
  };
}

export function recordActivityEvent(event) {
  if (!event?.id) return null;
  const entry = normalizeTimelineEntry(event);
  timeline.unshift(entry);
  if (timeline.length > MAX_TIMELINE) timeline.length = MAX_TIMELINE;
  return entry;
}

export function wireActivityTimeline() {
  if (unsubscribe) return unsubscribe;
  unsubscribe = subscribeToEvents('*', recordActivityEvent);
  return unsubscribe;
}

export function getActivityTimeline(limit = 50) {
  return timeline.slice(0, Math.max(1, Number(limit) || 50));
}

export function clearActivityTimeline() {
  timeline.length = 0;
}

