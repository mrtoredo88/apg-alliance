import {
  REFERRAL_EVENT_TYPES,
  buildReferralFunnel,
  buildReferralHealth,
  buildReferralSessionInspectors,
  detectIncompleteReferralSessions,
  referralEventTime,
  sortReferralEvents,
} from './referral-observability.js';

export const REFERRAL_ALERT_TYPES = Object.freeze({
  SUCCESS_RATE_LOW: 'SUCCESS_RATE_LOW',
  BROKEN_SESSION: 'BROKEN_SESSION',
  LONG_RUNNING_SESSION: 'LONG_RUNNING_SESSION',
  RECOVERY_PENDING: 'RECOVERY_PENDING',
  REWARD_PENDING: 'REWARD_PENDING',
  PROFILE_SYNC_TIMEOUT: 'PROFILE_SYNC_TIMEOUT',
  AUTH_TIMEOUT: 'AUTH_TIMEOUT',
  SESSION_ORPHAN: 'SESSION_ORPHAN',
  DUPLICATE_ACTIVITY: 'DUPLICATE_ACTIVITY',
});

export const REFERRAL_MONITOR_EVENT_TYPES = Object.freeze({
  MONITOR_STARTED: 'MONITOR_STARTED',
  ALERT_CREATED: 'ALERT_CREATED',
  ALERT_UPDATED: 'ALERT_UPDATED',
  ALERT_RESOLVED: 'ALERT_RESOLVED',
  HEALTH_RECALCULATED: 'HEALTH_RECALCULATED',
  MONITOR_SCAN_COMPLETED: 'MONITOR_SCAN_COMPLETED',
});

const DEFAULT_THRESHOLDS = Object.freeze({
  successRatePct: 95,
  longRunningMinutes: 30,
  authTimeoutMinutes: 10,
  profileSyncTimeoutMinutes: 10,
  recoveryPendingMinutes: 10,
});

function safeString(value, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function dateIso(value, fallback = new Date()) {
  const ms = referralEventTime(value) || referralEventTime(fallback) || Date.now();
  return new Date(ms).toISOString();
}

function eventHasCompletedAuth(event) {
  return [REFERRAL_EVENT_TYPES.AUTH_COMPLETED, REFERRAL_EVENT_TYPES.SESSION_EMAIL_LINKED, REFERRAL_EVENT_TYPES.SESSION_TELEGRAM_LINKED].includes(event.type)
    && ['completed', 'success', 'done'].includes(event.status);
}

function makeAlert({ type, severity = 'warning', flowId = '', sessionId = '', userId = '', summary = '', details = {}, createdAt, updatedAt, resolved = false, events = [] }) {
  const key = [type, flowId || 'no-flow', sessionId || 'no-session', userId || 'no-user'].join('__').replace(/[^\w:.-]+/g, '_');
  return {
    id: `ref_alert_${key}`,
    type,
    severity,
    createdAt: dateIso(createdAt || events[0]?.timestamp),
    updatedAt: dateIso(updatedAt || events.at(-1)?.timestamp || createdAt),
    resolved: resolved === true,
    flowId: safeString(flowId, 180),
    sessionId: safeString(sessionId, 180),
    userId: safeString(userId, 180),
    summary: safeString(summary, 500),
    details,
    timeline: sortReferralEvents(events).map(event => ({
      id: event.id,
      timestamp: event.timestamp,
      type: event.type,
      status: event.status,
      source: event.source,
      sessionId: event.sessionId,
      flowId: event.referralFlowId,
      userId: event.referredUserId,
    })),
  };
}

function groupEventsByFlow(events = []) {
  const map = new Map();
  sortReferralEvents(events).forEach(event => {
    const key = event.referralFlowId || event.sessionId || event.referredUserId || event.id;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(event);
  });
  return map;
}

function sessionEvents(events = [], session = {}) {
  return sortReferralEvents(events).filter(event => (
    (session.id && event.sessionId === session.id)
    || (session.referralFlowId && event.referralFlowId === session.referralFlowId)
    || (session.userId && event.referredUserId === session.userId)
  ));
}

function hasReward(events = []) {
  return events.some(event => [REFERRAL_EVENT_TYPES.REWARD_GRANTED, REFERRAL_EVENT_TYPES.ALREADY_GRANTED].includes(event.type));
}

function hasProfileSync(events = []) {
  return events.some(event => [REFERRAL_EVENT_TYPES.SESSION_PROFILE_SYNC, REFERRAL_EVENT_TYPES.PROFILE_SYNC_COMPLETED, REFERRAL_EVENT_TYPES.PROFILE_SYNC_STARTED].includes(event.type));
}

export function buildReferralMonitoring({ events = [], sessions = [], recoveryCandidates = [], now = new Date(), thresholds = {} } = {}) {
  const config = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const sortedEvents = sortReferralEvents(events);
  const nowMs = referralEventTime(now) || Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const funnel = buildReferralFunnel(sortedEvents, now);
  const health = buildReferralHealth(sortedEvents, sessions, recoveryCandidates, now);
  const inspectors = buildReferralSessionInspectors(sessions, sortedEvents);
  const incompleteSessions = detectIncompleteReferralSessions(sessions, sortedEvents, now, 10);
  const alerts = [];

  if (health.successRatePct < config.successRatePct && (funnel.total.sessionsCreated || funnel.total.authStarted || funnel.total.rewardGranted)) {
    alerts.push(makeAlert({
      type: REFERRAL_ALERT_TYPES.SUCCESS_RATE_LOW,
      severity: health.successRatePct < 80 ? 'critical' : 'warning',
      summary: `Referral success rate ${health.successRatePct}% ниже порога ${config.successRatePct}%.`,
      details: { thresholdPct: config.successRatePct, successRatePct: health.successRatePct, funnel: funnel.total },
      createdAt: now,
      updatedAt: now,
    }));
  }

  incompleteSessions.forEach(session => {
    alerts.push(makeAlert({
      type: REFERRAL_ALERT_TYPES.BROKEN_SESSION,
      severity: session.ageMinutes >= config.longRunningMinutes ? 'critical' : 'warning',
      flowId: session.referralFlowId,
      sessionId: session.id,
      userId: session.userId,
      summary: session.reason || 'Referral session не завершена.',
      details: { ageMinutes: session.ageMinutes, status: session.status, referrerId: session.referrerId },
      createdAt: session.createdAt,
      updatedAt: session.lastEventAt || session.createdAt,
      events: sessionEvents(sortedEvents, session),
    }));
  });

  inspectors.forEach(session => {
    const eventsForSession = session.events || sessionEvents(sortedEvents, session);
    const createdMs = referralEventTime(session.createdAt) || referralEventTime(eventsForSession[0]?.timestamp);
    const ageMinutes = createdMs ? Math.max(0, Math.round((nowMs - createdMs) / 60000)) : 0;
    if (!session.completed && ageMinutes >= config.longRunningMinutes) {
      alerts.push(makeAlert({
        type: REFERRAL_ALERT_TYPES.LONG_RUNNING_SESSION,
        severity: 'critical',
        flowId: session.referralFlowId,
        sessionId: session.id,
        userId: session.userId,
        summary: `Referral session активна ${ageMinutes} мин.`,
        details: { ageMinutes, status: session.status, referrerId: session.referrerId },
        createdAt: session.createdAt,
        updatedAt: eventsForSession.at(-1)?.timestamp || session.createdAt,
        events: eventsForSession,
      }));
    }
    if (eventsForSession.some(event => [REFERRAL_EVENT_TYPES.REFERRAL_ATTACHED, REFERRAL_EVENT_TYPES.SESSION_ATTACHED].includes(event.type)) && !hasReward(eventsForSession)) {
      alerts.push(makeAlert({
        type: REFERRAL_ALERT_TYPES.REWARD_PENDING,
        severity: 'warning',
        flowId: session.referralFlowId,
        sessionId: session.id,
        userId: session.userId,
        summary: 'Referral attached, но reward не подтверждён.',
        details: { rewardStatus: session.rewardStatus, referrerId: session.referrerId },
        createdAt: eventsForSession.find(event => [REFERRAL_EVENT_TYPES.REFERRAL_ATTACHED, REFERRAL_EVENT_TYPES.SESSION_ATTACHED].includes(event.type))?.timestamp,
        updatedAt: eventsForSession.at(-1)?.timestamp,
        events: eventsForSession,
      }));
    }
    if (eventsForSession.some(eventHasCompletedAuth) && !hasProfileSync(eventsForSession) && ageMinutes >= config.profileSyncTimeoutMinutes) {
      alerts.push(makeAlert({
        type: REFERRAL_ALERT_TYPES.PROFILE_SYNC_TIMEOUT,
        severity: 'warning',
        flowId: session.referralFlowId,
        sessionId: session.id,
        userId: session.userId,
        summary: 'Auth завершён, но profile sync отсутствует.',
        details: { ageMinutes, authType: session.authType },
        createdAt: eventsForSession.find(eventHasCompletedAuth)?.timestamp,
        updatedAt: eventsForSession.at(-1)?.timestamp,
        events: eventsForSession,
      }));
    }
  });

  groupEventsByFlow(sortedEvents).forEach((flowEvents, flowId) => {
    const first = flowEvents[0];
    const last = flowEvents.at(-1);
    const ageMinutes = Math.max(0, Math.round((nowMs - referralEventTime(first?.timestamp)) / 60000));
    const authStarted = flowEvents.some(event => [REFERRAL_EVENT_TYPES.AUTH_STARTED, REFERRAL_EVENT_TYPES.SESSION_EMAIL_LINKED, REFERRAL_EVENT_TYPES.SESSION_TELEGRAM_LINKED].includes(event.type));
    const authCompleted = flowEvents.some(eventHasCompletedAuth);
    const hasSession = flowEvents.some(event => event.sessionId || [REFERRAL_EVENT_TYPES.SESSION_CREATED, REFERRAL_EVENT_TYPES.SESSION_RESTORED].includes(event.type));
    if (authStarted && !authCompleted && ageMinutes >= config.authTimeoutMinutes) {
      alerts.push(makeAlert({
        type: REFERRAL_ALERT_TYPES.AUTH_TIMEOUT,
        severity: 'warning',
        flowId,
        sessionId: first?.sessionId || '',
        userId: first?.referredUserId || '',
        summary: 'Auth started есть, auth completed отсутствует.',
        details: { ageMinutes },
        createdAt: first?.timestamp,
        updatedAt: last?.timestamp,
        events: flowEvents,
      }));
    }
    if (!hasSession && flowId && flowId !== first?.id) {
      alerts.push(makeAlert({
        type: REFERRAL_ALERT_TYPES.SESSION_ORPHAN,
        severity: 'warning',
        flowId,
        sessionId: '',
        userId: first?.referredUserId || '',
        summary: 'Есть referral flow без server referral session.',
        details: { eventsCount: flowEvents.length },
        createdAt: first?.timestamp,
        updatedAt: last?.timestamp,
        events: flowEvents,
      }));
    }
  });

  recoveryCandidates.forEach(candidate => {
    alerts.push(makeAlert({
      type: REFERRAL_ALERT_TYPES.RECOVERY_PENDING,
      severity: 'warning',
      flowId: candidate.flowId || '',
      sessionId: candidate.referralSessionId || '',
      userId: candidate.referredUserId || '',
      summary: candidate.reason || 'Referral recovery candidate detected.',
      details: candidate,
      createdAt: candidate.createdAt || now,
      updatedAt: candidate.updatedAt || now,
    }));
  });

  sortedEvents
    .filter(event => event.type === REFERRAL_EVENT_TYPES.DUPLICATE_PREVENTED || event.type === REFERRAL_EVENT_TYPES.SESSION_DUPLICATE)
    .forEach(event => {
      alerts.push(makeAlert({
        type: REFERRAL_ALERT_TYPES.DUPLICATE_ACTIVITY,
        severity: 'info',
        flowId: event.referralFlowId,
        sessionId: event.sessionId,
        userId: event.referredUserId,
        summary: 'Prevented duplicate referral activity.',
        details: event.metadata || {},
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
        resolved: true,
        events: [event],
      }));
    });

  const uniqueAlerts = [...new Map(alerts.map(alert => [alert.id, alert])).values()]
    .sort((a, b) => Number(a.resolved) - Number(b.resolved) || referralEventTime(b.updatedAt) - referralEventTime(a.updatedAt));
  const openAlerts = uniqueAlerts.filter(alert => !alert.resolved);
  const criticalAlerts = openAlerts.filter(alert => alert.severity === 'critical');
  const warnings = openAlerts.filter(alert => alert.severity === 'warning');
  const resolvedToday = uniqueAlerts.filter(alert => alert.resolved && nowMs - referralEventTime(alert.updatedAt) <= dayMs);
  const status = criticalAlerts.length ? 'red' : warnings.length || health.brokenSessions || health.recoveryPending ? 'yellow' : 'green';
  const completedHour = sortedEvents.filter(event => event.type === REFERRAL_EVENT_TYPES.REWARD_GRANTED && nowMs - referralEventTime(event.timestamp) <= 60 * 60 * 1000).length;

  return {
    timestamp: dateIso(now),
    thresholds: config,
    status,
    healthScore: Math.max(0, Math.min(100, Math.round((health.successRatePct || 100) - criticalAlerts.length * 15 - warnings.length * 5))),
    health: {
      ...health,
      activeSessions: inspectors.filter(session => !session.completed).length,
      abandonedSessions: incompleteSessions.length,
      completedHour,
    },
    alerts: uniqueAlerts,
    summary: {
      openAlerts: openAlerts.length,
      critical: criticalAlerts.length,
      warnings: warnings.length,
      resolvedToday: resolvedToday.length,
      brokenSessions: health.brokenSessions || incompleteSessions.length,
      recoveryPending: health.recoveryPending || recoveryCandidates.length,
      rewardPending: openAlerts.filter(alert => alert.type === REFERRAL_ALERT_TYPES.REWARD_PENDING).length,
      successRate: health.successRatePct,
      averageCompletion: health.averageCompletionSeconds,
      activeSessions: inspectors.filter(session => !session.completed).length,
      abandonedSessions: incompleteSessions.length,
    },
    funnel,
  };
}

export function referralAlertsToCsv(alerts = []) {
  const headers = ['id', 'type', 'severity', 'createdAt', 'updatedAt', 'resolved', 'flowId', 'sessionId', 'userId', 'summary'];
  const escape = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [headers.join(','), ...alerts.map(alert => headers.map(key => escape(alert[key])).join(','))].join('\n');
}
