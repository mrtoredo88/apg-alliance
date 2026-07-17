export const REFERRAL_EVENT_TYPES = Object.freeze({
  QUERY_DETECTED: 'REF_QUERY_DETECTED',
  QUERY_SAVED: 'REF_QUERY_SAVED',
  AUTH_STARTED: 'REF_AUTH_STARTED',
  AUTH_COMPLETED: 'REF_AUTH_COMPLETED',
  USER_CREATED: 'REF_USER_CREATED',
  REFERRAL_ATTACHED: 'REFERRAL_ATTACHED',
  PROFILE_SYNC_STARTED: 'PROFILE_SYNC_STARTED',
  PROFILE_SYNC_COMPLETED: 'PROFILE_SYNC_COMPLETED',
  REWARD_GRANTED: 'REFERRAL_REWARD_GRANTED',
  ALREADY_GRANTED: 'REFERRAL_ALREADY_GRANTED',
  RECOVERY_STARTED: 'REFERRAL_RECOVERY_STARTED',
  RECOVERY_COMPLETED: 'REFERRAL_RECOVERY_COMPLETED',
  DUPLICATE_PREVENTED: 'REFERRAL_DUPLICATE_PREVENTED',
  FAILED: 'REFERRAL_FAILED',
  SESSION_CREATED: 'REF_SESSION_CREATED',
  SESSION_RESTORED: 'REF_SESSION_RESTORED',
  SESSION_ATTACHED: 'REF_SESSION_ATTACHED',
  SESSION_EXPIRED: 'REF_SESSION_EXPIRED',
  SESSION_COMPLETED: 'REF_SESSION_COMPLETED',
  SESSION_RECOVERED: 'REF_SESSION_RECOVERED',
  SESSION_REUSED: 'REF_SESSION_REUSED',
  SESSION_DUPLICATE: 'REF_SESSION_DUPLICATE',
  SESSION_MISSING: 'REF_SESSION_MISSING',
  SESSION_TELEGRAM_LINKED: 'REF_SESSION_TELEGRAM_LINKED',
  SESSION_EMAIL_LINKED: 'REF_SESSION_EMAIL_LINKED',
  SESSION_PROFILE_SYNC: 'REF_SESSION_PROFILE_SYNC',
  MONITOR_STARTED: 'REF_MONITOR_STARTED',
  ALERT_CREATED: 'REF_ALERT_CREATED',
  ALERT_UPDATED: 'REF_ALERT_UPDATED',
  ALERT_RESOLVED: 'REF_ALERT_RESOLVED',
  HEALTH_RECALCULATED: 'REF_HEALTH_RECALCULATED',
  MONITOR_SCAN_COMPLETED: 'REF_MONITOR_SCAN_COMPLETED',
});

const RANGE_KEYS = ['today', 'week', 'month', 'total'];
const KPI_TEMPLATE = Object.freeze({
  openedLinks: 0,
  authStarted: 0,
  successfulRegistrations: 0,
  rewardsGranted: 0,
  recovery: 0,
  duplicatesPrevented: 0,
  errors: 0,
  conversionPct: 0,
});
const FUNNEL_STAGES = Object.freeze([
  { key: 'sessionsCreated', label: 'Sessions Created' },
  { key: 'authStarted', label: 'Auth Started' },
  { key: 'authCompleted', label: 'Auth Completed' },
  { key: 'profileSync', label: 'Profile Sync' },
  { key: 'referralAttached', label: 'Referral Attached' },
  { key: 'rewardGranted', label: 'Reward Granted' },
]);
const FUNNEL_TEMPLATE = Object.freeze(Object.fromEntries(FUNNEL_STAGES.map(stage => [stage.key, 0])));

function safeString(value, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function safeMetadata(input = {}) {
  const out = {};
  Object.entries(input && typeof input === 'object' ? input : {}).slice(0, 40).forEach(([key, value]) => {
    if (value == null || ['string', 'number', 'boolean'].includes(typeof value)) out[safeString(key, 80)] = value;
    else out[safeString(key, 80)] = JSON.stringify(value).slice(0, 600);
  });
  return out;
}

export function referralEventTime(value) {
  if (!value) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000);
  if (value instanceof Date) return value.getTime();
  return 0;
}

export function normalizeReferralEvent(input = {}) {
  const type = safeString(input.type || REFERRAL_EVENT_TYPES.FAILED, 80);
  const timestampMs = referralEventTime(input.timestamp || input.createdAt || input.at) || Date.now();
  const referralFlowId = safeString(input.referralFlowId || input.flowId || '', 120);
  const id = safeString(input.id || `${referralFlowId || 'ref'}_${type}_${timestampMs}`, 180);
  return {
    id,
    timestamp: new Date(timestampMs).toISOString(),
    referrerId: safeString(input.referrerId, 180),
    referredUserId: safeString(input.referredUserId || input.userId, 180),
    referralCode: safeString(input.referralCode || input.ref, 180),
    referralFlowId,
    type,
    status: safeString(input.status || 'info', 60),
    source: safeString(input.source || 'unknown', 120),
    sessionId: safeString(input.sessionId, 120),
    deviceId: safeString(input.deviceId, 120),
    platform: safeString(input.platform, 120),
    attempt: Number.isFinite(Number(input.attempt)) ? Number(input.attempt) : 1,
    metadata: safeMetadata(input.metadata || {}),
  };
}

export function sortReferralEvents(events = []) {
  return [...events].map(normalizeReferralEvent).sort((a, b) => referralEventTime(a.timestamp) - referralEventTime(b.timestamp));
}

export function buildReferralTimeline(events = []) {
  const byFlow = new Map();
  sortReferralEvents(events).forEach(event => {
    const key = event.referralFlowId || event.referredUserId || event.referralCode || event.id;
    if (!byFlow.has(key)) byFlow.set(key, { id: key, events: [], status: 'info', referrerId: '', referredUserId: '', referralCode: '' });
    const row = byFlow.get(key);
    row.events.push(event);
    row.referrerId ||= event.referrerId;
    row.referredUserId ||= event.referredUserId;
    row.referralCode ||= event.referralCode;
    if (event.status === 'error' || event.type === REFERRAL_EVENT_TYPES.FAILED) row.status = 'error';
    else if ([REFERRAL_EVENT_TYPES.REWARD_GRANTED, REFERRAL_EVENT_TYPES.RECOVERY_COMPLETED].includes(event.type) && row.status !== 'error') row.status = 'completed';
    else if (row.status === 'info') row.status = 'active';
  });
  return [...byFlow.values()].sort((a, b) => referralEventTime(b.events.at(-1)?.timestamp) - referralEventTime(a.events.at(-1)?.timestamp));
}

function emptyKpis() {
  return Object.fromEntries(RANGE_KEYS.map(key => [key, { ...KPI_TEMPLATE }]));
}

function emptyFunnel() {
  return Object.fromEntries(RANGE_KEYS.map(key => [key, { ...FUNNEL_TEMPLATE }]));
}

function applyKpi(kpi, event) {
  if (event.type === REFERRAL_EVENT_TYPES.QUERY_DETECTED) kpi.openedLinks += 1;
  if (event.type === REFERRAL_EVENT_TYPES.AUTH_STARTED) kpi.authStarted += 1;
  if (event.type === REFERRAL_EVENT_TYPES.REFERRAL_ATTACHED) kpi.successfulRegistrations += 1;
  if (event.type === REFERRAL_EVENT_TYPES.REWARD_GRANTED) kpi.rewardsGranted += 1;
  if (event.type === REFERRAL_EVENT_TYPES.RECOVERY_COMPLETED) kpi.recovery += 1;
  if (event.type === REFERRAL_EVENT_TYPES.DUPLICATE_PREVENTED) kpi.duplicatesPrevented += 1;
  if (event.status === 'error' || event.type === REFERRAL_EVENT_TYPES.FAILED) kpi.errors += 1;
}

function applyFunnel(funnel, event) {
  if ([REFERRAL_EVENT_TYPES.SESSION_CREATED, REFERRAL_EVENT_TYPES.SESSION_RESTORED].includes(event.type)) funnel.sessionsCreated += 1;
  if ([REFERRAL_EVENT_TYPES.AUTH_STARTED, REFERRAL_EVENT_TYPES.SESSION_EMAIL_LINKED, REFERRAL_EVENT_TYPES.SESSION_TELEGRAM_LINKED].includes(event.type) && event.status !== 'completed') funnel.authStarted += 1;
  if ([REFERRAL_EVENT_TYPES.AUTH_COMPLETED, REFERRAL_EVENT_TYPES.SESSION_EMAIL_LINKED, REFERRAL_EVENT_TYPES.SESSION_TELEGRAM_LINKED].includes(event.type) && ['completed', 'success', 'done'].includes(event.status)) funnel.authCompleted += 1;
  if ([REFERRAL_EVENT_TYPES.PROFILE_SYNC_STARTED, REFERRAL_EVENT_TYPES.PROFILE_SYNC_COMPLETED, REFERRAL_EVENT_TYPES.SESSION_PROFILE_SYNC].includes(event.type)) funnel.profileSync += 1;
  if ([REFERRAL_EVENT_TYPES.REFERRAL_ATTACHED, REFERRAL_EVENT_TYPES.SESSION_ATTACHED].includes(event.type)) funnel.referralAttached += 1;
  if (event.type === REFERRAL_EVENT_TYPES.REWARD_GRANTED) funnel.rewardGranted += 1;
}

export function aggregateReferralEvents(events = [], now = new Date()) {
  const dashboard = emptyKpis();
  const nowMs = referralEventTime(now);
  const day = 24 * 60 * 60 * 1000;
  sortReferralEvents(events).forEach(event => {
    const age = nowMs - referralEventTime(event.timestamp);
    applyKpi(dashboard.total, event);
    if (age <= day) applyKpi(dashboard.today, event);
    if (age <= day * 7) applyKpi(dashboard.week, event);
    if (age <= day * 31) applyKpi(dashboard.month, event);
  });
  Object.values(dashboard).forEach(kpi => {
    kpi.conversionPct = kpi.openedLinks ? Math.round((kpi.rewardsGranted / kpi.openedLinks) * 1000) / 10 : 0;
  });
  return dashboard;
}

export function buildReferralFunnel(events = [], now = new Date()) {
  const funnel = emptyFunnel();
  const nowMs = referralEventTime(now);
  const day = 24 * 60 * 60 * 1000;
  sortReferralEvents(events).forEach(event => {
    const age = nowMs - referralEventTime(event.timestamp);
    applyFunnel(funnel.total, event);
    if (age <= day) applyFunnel(funnel.today, event);
    if (age <= day * 7) applyFunnel(funnel.week, event);
    if (age <= day * 31) applyFunnel(funnel.month, event);
  });
  return Object.fromEntries(Object.entries(funnel).map(([range, values]) => {
    const steps = FUNNEL_STAGES.map((stage, index) => {
      const value = values[stage.key] || 0;
      const previous = index === 0 ? value : values[FUNNEL_STAGES[index - 1].key] || 0;
      return {
        ...stage,
        value,
        conversionFromPreviousPct: previous ? Math.round((value / previous) * 1000) / 10 : value ? 100 : 0,
      };
    });
    return [range, { ...values, steps }];
  }));
}

function normalizeReferralSession(session = {}) {
  const createdAt = session.createdAt || session.timestamp || session.startedAt || null;
  const completedAt = session.completedAt || null;
  return {
    id: safeString(session.id || session.sessionId, 180),
    referrerId: safeString(session.referrerId || session.referralCode || session.ref, 180),
    referralFlowId: safeString(session.referralFlowId || session.flowId, 180),
    deviceId: safeString(session.deviceId, 180),
    platform: safeString(session.platform, 180),
    source: safeString(session.source, 180),
    status: safeString(session.status || 'active', 80),
    completed: session.completed === true || session.status === 'completed',
    completedAt,
    createdAt,
    expiresAt: session.expiresAt || null,
    authType: safeString(session.authType, 80),
    userId: safeString(session.userId, 180),
  };
}

function eventsForSession(events = [], session = {}) {
  const normalized = normalizeReferralSession(session);
  return sortReferralEvents(events).filter(event => (
    (normalized.id && event.sessionId === normalized.id)
    || (normalized.referralFlowId && event.referralFlowId === normalized.referralFlowId)
    || (normalized.userId && event.referredUserId === normalized.userId)
  ));
}

function incompleteReason(session = {}, events = []) {
  const types = new Set(events.map(event => event.type));
  if (!types.has(REFERRAL_EVENT_TYPES.AUTH_STARTED) && !types.has(REFERRAL_EVENT_TYPES.SESSION_EMAIL_LINKED) && !types.has(REFERRAL_EVENT_TYPES.SESSION_TELEGRAM_LINKED)) return 'Session created, auth not started';
  if (!events.some(event => [REFERRAL_EVENT_TYPES.AUTH_COMPLETED, REFERRAL_EVENT_TYPES.SESSION_EMAIL_LINKED, REFERRAL_EVENT_TYPES.SESSION_TELEGRAM_LINKED].includes(event.type) && ['completed', 'success', 'done'].includes(event.status))) return 'Auth started, not completed';
  if (!types.has(REFERRAL_EVENT_TYPES.SESSION_PROFILE_SYNC) && !types.has(REFERRAL_EVENT_TYPES.PROFILE_SYNC_COMPLETED)) return 'Auth completed, profile sync missing';
  if (!types.has(REFERRAL_EVENT_TYPES.REFERRAL_ATTACHED) && !types.has(REFERRAL_EVENT_TYPES.SESSION_ATTACHED)) return 'Profile sync completed, referral not attached';
  if (!types.has(REFERRAL_EVENT_TYPES.REWARD_GRANTED) && !types.has(REFERRAL_EVENT_TYPES.ALREADY_GRANTED)) return 'Referral attached, reward not confirmed';
  return session.completed ? 'Completed' : 'Completion marker missing';
}

export function detectIncompleteReferralSessions(sessions = [], events = [], now = new Date(), thresholdMinutes = 10) {
  const nowMs = referralEventTime(now);
  return sessions
    .map(normalizeReferralSession)
    .filter(session => session.id)
    .map(session => {
      const sessionEvents = eventsForSession(events, session);
      const createdMs = referralEventTime(session.createdAt) || referralEventTime(sessionEvents[0]?.timestamp);
      const ageMinutes = createdMs ? Math.max(0, Math.round((nowMs - createdMs) / 60000)) : 0;
      return {
        ...session,
        ageMinutes,
        eventsCount: sessionEvents.length,
        lastEventAt: sessionEvents.at(-1)?.timestamp || '',
        reason: incompleteReason(session, sessionEvents),
      };
    })
    .filter(session => session.ageMinutes >= thresholdMinutes && !session.completed && session.status !== 'completed')
    .sort((a, b) => b.ageMinutes - a.ageMinutes);
}

export function buildReferralSessionInspectors(sessions = [], events = []) {
  return sessions.map(session => {
    const normalized = normalizeReferralSession(session);
    const sessionEvents = eventsForSession(events, normalized);
    const firstMs = referralEventTime(normalized.createdAt) || referralEventTime(sessionEvents[0]?.timestamp);
    const completedMs = referralEventTime(normalized.completedAt) || referralEventTime(sessionEvents.find(event => event.type === REFERRAL_EVENT_TYPES.SESSION_COMPLETED)?.timestamp);
    return {
      ...normalized,
      events: sessionEvents,
      eventsCount: sessionEvents.length,
      currentStatus: normalized.completed ? 'completed' : incompleteReason(normalized, sessionEvents),
      completionSeconds: firstMs && completedMs ? Math.max(0, Math.round((completedMs - firstMs) / 1000)) : null,
      rewardStatus: sessionEvents.some(event => event.type === REFERRAL_EVENT_TYPES.REWARD_GRANTED) ? 'granted' : sessionEvents.some(event => event.type === REFERRAL_EVENT_TYPES.ALREADY_GRANTED) ? 'already_granted' : 'not_confirmed',
      recoveryStatus: sessionEvents.some(event => event.type === REFERRAL_EVENT_TYPES.RECOVERY_COMPLETED) ? 'recovered' : sessionEvents.some(event => event.type === REFERRAL_EVENT_TYPES.RECOVERY_STARTED) ? 'started' : 'not_needed',
    };
  });
}

export function buildReferralHealth(events = [], sessions = [], recoveryCandidates = [], now = new Date()) {
  const dashboard = aggregateReferralEvents(events, now);
  const incomplete = detectIncompleteReferralSessions(sessions, events, now);
  const inspectors = buildReferralSessionInspectors(sessions, events);
  const completedSessions = inspectors.filter(session => session.completed);
  const completionTimes = completedSessions.map(session => session.completionSeconds).filter(value => Number.isFinite(value));
  const completedToday = dashboard.today.rewardsGranted || completedSessions.filter(session => {
    const completedMs = referralEventTime(session.completedAt);
    return completedMs && referralEventTime(now) - completedMs <= 24 * 60 * 60 * 1000;
  }).length;
  return {
    successRatePct: dashboard.total.openedLinks ? Math.round((dashboard.total.rewardsGranted / dashboard.total.openedLinks) * 1000) / 10 : 100,
    averageCompletionSeconds: completionTimes.length ? Math.round(completionTimes.reduce((sum, value) => sum + value, 0) / completionTimes.length) : null,
    brokenSessions: incomplete.length,
    recoveryPending: recoveryCandidates.length,
    duplicatePrevented: dashboard.total.duplicatesPrevented,
    completedToday,
  };
}

export function detectReferralProblems(events = [], now = new Date()) {
  const nowMs = referralEventTime(now);
  const timeline = buildReferralTimeline(events);
  const problems = [];
  timeline.forEach(flow => {
    const flowEvents = flow.events;
    const first = flowEvents[0];
    const last = flowEvents.at(-1);
    const hasReward = flowEvents.some(e => e.type === REFERRAL_EVENT_TYPES.REWARD_GRANTED || e.type === REFERRAL_EVENT_TYPES.ALREADY_GRANTED);
    const hasAuth = flowEvents.some(e => e.type === REFERRAL_EVENT_TYPES.AUTH_STARTED || e.type === REFERRAL_EVENT_TYPES.AUTH_COMPLETED);
    const failures = flowEvents.filter(e => e.type === REFERRAL_EVENT_TYPES.FAILED || e.status === 'error').length;
    const recoveryStarts = flowEvents.filter(e => e.type === REFERRAL_EVENT_TYPES.RECOVERY_STARTED).length;
    if (hasAuth && !hasReward && nowMs - referralEventTime(first?.timestamp) > 5 * 60 * 1000) {
      problems.push({ type: 'stuck_referral', severity: 'warning', flowId: flow.id, message: 'Регистрация началась, но начисление не завершилось более 5 минут.' });
    }
    if (hasReward && referralEventTime(last?.timestamp) - referralEventTime(first?.timestamp) > 5 * 60 * 1000) {
      problems.push({ type: 'reward_delayed', severity: 'info', flowId: flow.id, message: 'Начисление заняло более 5 минут.' });
    }
    if (recoveryStarts > 2) problems.push({ type: 'repeated_recovery', severity: 'warning', flowId: flow.id, message: 'Recovery запускался несколько раз.' });
    if (failures > 1) problems.push({ type: 'repeated_failures', severity: 'error', flowId: flow.id, message: 'В цепочке несколько ошибок.' });
  });
  const byReferrer = new Map();
  sortReferralEvents(events).forEach(event => {
    if (!event.referrerId && !event.referralCode) return;
    const key = event.referrerId || event.referralCode;
    byReferrer.set(key, (byReferrer.get(key) || 0) + (event.type === REFERRAL_EVENT_TYPES.QUERY_DETECTED ? 1 : 0));
  });
  byReferrer.forEach((count, key) => {
    if (count >= 30) problems.push({ type: 'possible_abuse', severity: 'warning', referrerId: key, message: 'Аномально много открытий реферальной ссылки.' });
  });
  return problems;
}

export function filterReferralEvents(events = [], filters = {}) {
  const search = safeString(filters.search || filters.email || filters.userId || filters.referrer || filters.referralFlowId, 220).toLowerCase();
  return sortReferralEvents(events).filter(event => {
    if (filters.status && filters.status !== 'all' && event.status !== filters.status) return false;
    if (filters.type && filters.type !== 'all' && event.type !== filters.type) return false;
    if (filters.referralFlowId && event.referralFlowId !== String(filters.referralFlowId)) return false;
    if (filters.referrer && event.referrerId !== String(filters.referrer)) return false;
    if (filters.userId && event.referredUserId !== String(filters.userId)) return false;
    if (search) {
      const haystack = JSON.stringify(event).toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

export function referralEventsToCsv(events = []) {
  const rows = sortReferralEvents(events);
  const headers = ['timestamp', 'referralFlowId', 'type', 'status', 'referrerId', 'referredUserId', 'referralCode', 'source', 'sessionId', 'deviceId', 'platform', 'attempt'];
  const escape = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [headers.join(','), ...rows.map(event => headers.map(key => escape(event[key])).join(','))].join('\n');
}

export function referralEventsToJson(events = []) {
  return JSON.stringify(sortReferralEvents(events), null, 2);
}
