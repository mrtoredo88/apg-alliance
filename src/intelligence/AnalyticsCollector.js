import { APG_EVENT_TYPES, subscribeToEvents } from './EventBus.js';

let unsubscribe = null;

const analytics = {
  screenOpenings: {},
  views: {},
  clicks: {},
  registrations: 0,
  qrScans: { started: 0, success: 0, errors: 0 },
  comments: 0,
  publications: 0,
};

function increment(bucket, key) {
  if (!bucket || !key) return;
  bucket[key] = (bucket[key] || 0) + 1;
}

export function recordAnalyticsEvent(event) {
  if (!event?.id) return;
  const action = event.payload?.action || event.type;
  const entityType = event.entityType || event.payload?.entityType || 'app';

  if (event.type === APG_EVENT_TYPES.SCREEN_OPENED || event.type === APG_EVENT_TYPES.LOKI_OPENED) {
    increment(analytics.screenOpenings, event.entityId || event.payload?.panel || 'unknown');
  }

  if (/Opened|Viewed|view/i.test(event.type) || /open|view/i.test(action)) {
    increment(analytics.views, entityType);
  }

  if (/click|route|site|call|contact|book|save|like|recommendation/i.test(action) || [
    APG_EVENT_TYPES.PARTNER_ROUTE_BUILT,
    APG_EVENT_TYPES.PARTNER_SITE_OPENED,
    APG_EVENT_TYPES.PARTNER_CALLED,
    APG_EVENT_TYPES.EXPERT_BOOKED,
    APG_EVENT_TYPES.EXPERT_CONTACT_OPENED,
    APG_EVENT_TYPES.RECOMMENDATION_INTERACTED,
  ].includes(event.type)) {
    increment(analytics.clicks, action);
  }

  if (event.type === APG_EVENT_TYPES.EVENT_REGISTERED) analytics.registrations += 1;
  if (event.type === APG_EVENT_TYPES.QR_SCAN_STARTED) analytics.qrScans.started += 1;
  if (event.type === APG_EVENT_TYPES.QR_SCANNED) analytics.qrScans.success += 1;
  if (event.type === APG_EVENT_TYPES.QR_SCAN_FAILED) analytics.qrScans.errors += 1;
  if (event.type === APG_EVENT_TYPES.NEWS_COMMENTED || event.type === APG_EVENT_TYPES.COMMENT_CREATED) analytics.comments += 1;
  if ([APG_EVENT_TYPES.NEWS_PUBLISHED, APG_EVENT_TYPES.EVENT_PUBLISHED, APG_EVENT_TYPES.PARTNER_CREATED, APG_EVENT_TYPES.EXPERT_CREATED].includes(event.type)) analytics.publications += 1;
}

export function wireAnalyticsCollector() {
  if (unsubscribe) return unsubscribe;
  unsubscribe = subscribeToEvents('*', recordAnalyticsEvent);
  return unsubscribe;
}

export function getAnalyticsSnapshot() {
  return {
    screenOpenings: { ...analytics.screenOpenings },
    views: { ...analytics.views },
    clicks: { ...analytics.clicks },
    registrations: analytics.registrations,
    qrScans: { ...analytics.qrScans },
    comments: analytics.comments,
    publications: analytics.publications,
  };
}

export function clearAnalyticsCollector() {
  analytics.screenOpenings = {};
  analytics.views = {};
  analytics.clicks = {};
  analytics.registrations = 0;
  analytics.qrScans = { started: 0, success: 0, errors: 0 };
  analytics.comments = 0;
  analytics.publications = 0;
}

