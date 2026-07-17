import assert from 'node:assert/strict';
import fs from 'node:fs';

import { REFERRAL_EVENT_TYPES } from '../server-shared/referral-observability.js';
import {
  REFERRAL_ALERT_TYPES,
  buildReferralMonitoring,
  referralAlertsToCsv,
} from '../server-shared/referral-monitoring.js';

const now = new Date('2026-07-17T12:00:00.000Z');
const minutesAgo = (minutes) => new Date(now.getTime() - minutes * 60_000).toISOString();

const event = (type, overrides = {}) => ({
  id: `${type}_${overrides.sessionId || overrides.referralFlowId || Math.random()}`,
  timestamp: overrides.timestamp || minutesAgo(1),
  type,
  status: overrides.status || 'success',
  source: overrides.source || 'test',
  referralFlowId: overrides.referralFlowId || 'flow_ok',
  sessionId: overrides.sessionId || 'session_ok',
  referredUserId: overrides.referredUserId || 'user_ok',
  metadata: overrides.metadata || {},
});

const session = (id, overrides = {}) => ({
  id,
  referrerId: overrides.referrerId || 'tg_ref',
  referralFlowId: overrides.referralFlowId || id.replace('session', 'flow'),
  status: overrides.status || 'active',
  completed: overrides.completed === true,
  completedAt: overrides.completedAt || null,
  createdAt: overrides.createdAt || minutesAgo(40),
  userId: overrides.userId || '',
  authType: overrides.authType || 'email',
});

const completedEvents = [
  event(REFERRAL_EVENT_TYPES.SESSION_CREATED, { sessionId: 'session_ok', referralFlowId: 'flow_ok', timestamp: minutesAgo(20) }),
  event(REFERRAL_EVENT_TYPES.AUTH_STARTED, { sessionId: 'session_ok', referralFlowId: 'flow_ok', timestamp: minutesAgo(19) }),
  event(REFERRAL_EVENT_TYPES.AUTH_COMPLETED, { sessionId: 'session_ok', referralFlowId: 'flow_ok', timestamp: minutesAgo(18), status: 'completed' }),
  event(REFERRAL_EVENT_TYPES.PROFILE_SYNC_COMPLETED, { sessionId: 'session_ok', referralFlowId: 'flow_ok', timestamp: minutesAgo(17) }),
  event(REFERRAL_EVENT_TYPES.REFERRAL_ATTACHED, { sessionId: 'session_ok', referralFlowId: 'flow_ok', timestamp: minutesAgo(16) }),
  event(REFERRAL_EVENT_TYPES.REWARD_GRANTED, { sessionId: 'session_ok', referralFlowId: 'flow_ok', timestamp: minutesAgo(15) }),
];

function types(result) {
  return new Set(result.alerts.map(alert => alert.type));
}

{
  const result = buildReferralMonitoring({
    now,
    sessions: [session('session_ok', { referralFlowId: 'flow_ok', completed: true, completedAt: minutesAgo(15), createdAt: minutesAgo(20) })],
    events: [
      event(REFERRAL_EVENT_TYPES.QUERY_DETECTED, { sessionId: 'session_fail', referralFlowId: 'flow_fail', timestamp: minutesAgo(50) }),
      event(REFERRAL_EVENT_TYPES.QUERY_DETECTED, { sessionId: 'session_fail_2', referralFlowId: 'flow_fail_2', timestamp: minutesAgo(48) }),
      event(REFERRAL_EVENT_TYPES.QUERY_DETECTED, { sessionId: 'session_fail_3', referralFlowId: 'flow_fail_3', timestamp: minutesAgo(47) }),
      event(REFERRAL_EVENT_TYPES.SESSION_CREATED, { sessionId: 'session_fail', referralFlowId: 'flow_fail', timestamp: minutesAgo(49) }),
      ...completedEvents,
    ],
  });
  assert.equal(types(result).has(REFERRAL_ALERT_TYPES.SUCCESS_RATE_LOW), true, 'detects low success rate');
}

{
  const result = buildReferralMonitoring({
    now,
    sessions: [session('session_broken', { referralFlowId: 'flow_broken', createdAt: minutesAgo(45) })],
    events: [event(REFERRAL_EVENT_TYPES.SESSION_CREATED, { sessionId: 'session_broken', referralFlowId: 'flow_broken', timestamp: minutesAgo(45) })],
  });
  assert.equal(types(result).has(REFERRAL_ALERT_TYPES.BROKEN_SESSION), true, 'detects broken session');
  assert.equal(types(result).has(REFERRAL_ALERT_TYPES.LONG_RUNNING_SESSION), true, 'detects long running session');
}

{
  const result = buildReferralMonitoring({
    now,
    sessions: [session('session_profile', { referralFlowId: 'flow_profile', createdAt: minutesAgo(35) })],
    events: [
      event(REFERRAL_EVENT_TYPES.SESSION_CREATED, { sessionId: 'session_profile', referralFlowId: 'flow_profile', timestamp: minutesAgo(35) }),
      event(REFERRAL_EVENT_TYPES.AUTH_COMPLETED, { sessionId: 'session_profile', referralFlowId: 'flow_profile', timestamp: minutesAgo(34), status: 'completed' }),
    ],
  });
  assert.equal(types(result).has(REFERRAL_ALERT_TYPES.PROFILE_SYNC_TIMEOUT), true, 'detects missing profile sync after auth');
}

{
  const result = buildReferralMonitoring({
    now,
    sessions: [session('session_auth', { referralFlowId: 'flow_auth', createdAt: minutesAgo(20) })],
    events: [
      event(REFERRAL_EVENT_TYPES.SESSION_CREATED, { sessionId: 'session_auth', referralFlowId: 'flow_auth', timestamp: minutesAgo(20) }),
      event(REFERRAL_EVENT_TYPES.AUTH_STARTED, { sessionId: 'session_auth', referralFlowId: 'flow_auth', timestamp: minutesAgo(19) }),
    ],
  });
  assert.equal(types(result).has(REFERRAL_ALERT_TYPES.AUTH_TIMEOUT), true, 'detects auth timeout');
}

{
  const result = buildReferralMonitoring({
    now,
    sessions: [session('session_reward', { referralFlowId: 'flow_reward', createdAt: minutesAgo(8) })],
    events: [
      event(REFERRAL_EVENT_TYPES.SESSION_CREATED, { sessionId: 'session_reward', referralFlowId: 'flow_reward', timestamp: minutesAgo(8) }),
      event(REFERRAL_EVENT_TYPES.REFERRAL_ATTACHED, { sessionId: 'session_reward', referralFlowId: 'flow_reward', timestamp: minutesAgo(7) }),
    ],
  });
  assert.equal(types(result).has(REFERRAL_ALERT_TYPES.REWARD_PENDING), true, 'detects reward pending');
}

{
  const result = buildReferralMonitoring({
    now,
    events: [],
    sessions: [],
    recoveryCandidates: [{ id: 'recover_1', referrerId: 'tg_ref', referredUserId: 'user_lost', reason: 'reward missing' }],
  });
  assert.equal(types(result).has(REFERRAL_ALERT_TYPES.RECOVERY_PENDING), true, 'detects recovery pending');
}

{
  const result = buildReferralMonitoring({
    now,
    sessions: [session('session_done', { referralFlowId: 'flow_done', completed: true, completedAt: minutesAgo(1), createdAt: minutesAgo(4) })],
    events: [
      event(REFERRAL_EVENT_TYPES.SESSION_CREATED, { sessionId: 'session_done', referralFlowId: 'flow_done', timestamp: minutesAgo(4) }),
      event(REFERRAL_EVENT_TYPES.AUTH_COMPLETED, { sessionId: 'session_done', referralFlowId: 'flow_done', timestamp: minutesAgo(3), status: 'completed' }),
      event(REFERRAL_EVENT_TYPES.PROFILE_SYNC_COMPLETED, { sessionId: 'session_done', referralFlowId: 'flow_done', timestamp: minutesAgo(2) }),
      event(REFERRAL_EVENT_TYPES.REFERRAL_ATTACHED, { sessionId: 'session_done', referralFlowId: 'flow_done', timestamp: minutesAgo(2) }),
      event(REFERRAL_EVENT_TYPES.REWARD_GRANTED, { sessionId: 'session_done', referralFlowId: 'flow_done', timestamp: minutesAgo(1) }),
    ],
  });
  assert.equal(types(result).has(REFERRAL_ALERT_TYPES.BROKEN_SESSION), false, 'completed session does not stay broken');
  assert.equal(types(result).has(REFERRAL_ALERT_TYPES.REWARD_PENDING), false, 'reward pending closes after reward event');
}

{
  const result = buildReferralMonitoring({
    now,
    events: [event(REFERRAL_EVENT_TYPES.DUPLICATE_PREVENTED, { sessionId: 'session_dup', referralFlowId: 'flow_dup', timestamp: minutesAgo(2) })],
  });
  const duplicate = result.alerts.find(alert => alert.type === REFERRAL_ALERT_TYPES.DUPLICATE_ACTIVITY);
  assert.equal(Boolean(duplicate), true, 'detects duplicate prevention');
  assert.equal(duplicate.resolved, true, 'duplicate prevention is informational and resolved');
}

{
  const result = buildReferralMonitoring({
    now,
    sessions: [session('session_csv', { referralFlowId: 'flow_csv', createdAt: minutesAgo(40) })],
    events: [event(REFERRAL_EVENT_TYPES.SESSION_CREATED, { sessionId: 'session_csv', referralFlowId: 'flow_csv', timestamp: minutesAgo(40) })],
  });
  const csv = referralAlertsToCsv(result.alerts);
  assert.match(csv, /id,type,severity,createdAt/);
  assert.match(csv, /BROKEN_SESSION/);
  assert.equal(typeof result.summary.openAlerts, 'number', 'dashboard summary is calculated');
  assert.equal(['green', 'yellow', 'red'].includes(result.status), true, 'system status is calculated');
}

const adminActions = fs.readFileSync('server/src/routes/admin-actions.js', 'utf8');
assert.match(adminActions, /buildReferralMonitoring/, 'admin diagnostics includes monitoring engine');
assert.match(adminActions, /referrals:monitoring/, 'admin action includes monitoring action');

const monitoringRoute = fs.readFileSync('server/src/routes/referral-monitoring.js', 'utf8');
assert.match(monitoringRoute, /\/api\/referral-monitoring\/health/, 'health endpoint exists');
assert.match(monitoringRoute, /requireAdminPermission/, 'health endpoint is admin-protected');

const server = fs.readFileSync('server/src/server.js', 'utf8');
assert.match(server, /referralMonitoringRoutes/, 'server registers monitoring route');

const adminPanel = fs.readFileSync('src/AdminPanel.jsx', 'utf8');
assert.match(adminPanel, /Referral Monitoring/, 'admin monitoring tab exists');
assert.match(adminPanel, /System Status/, 'admin monitoring dashboard renders status');
assert.match(adminPanel, /alertExportCsv/, 'admin monitoring exports alerts CSV');

console.log('Referral Monitoring v4 regression passed');
