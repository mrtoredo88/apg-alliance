import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  REFERRAL_SESSION_STATUSES,
  buildReferralSessionPublic,
  isReferralSessionExpired,
  normalizeReferralSessionId,
  referralSessionExpiresAt,
} from '../server-shared/referral-session.js';
import {
  REFERRAL_EVENT_TYPES,
  buildReferralFunnel,
  buildReferralHealth,
  buildReferralSessionInspectors,
  detectIncompleteReferralSessions,
} from '../server-shared/referral-observability.js';

const validSessionId = 'refsess_0123456789abcdef01234567';
assert.equal(normalizeReferralSessionId(validSessionId), validSessionId);
assert.equal(normalizeReferralSessionId('bad'), '');
assert.equal(isReferralSessionExpired({ expiresAt: new Date('2026-01-01T00:00:00.000Z') }, new Date('2026-01-02T00:00:00.000Z')), true);
assert.equal(isReferralSessionExpired({ expiresAt: referralSessionExpiresAt(new Date('2026-01-01T00:00:00.000Z')) }, new Date('2026-01-02T00:00:00.000Z')), false);
assert.deepEqual(buildReferralSessionPublic({ id: validSessionId, referrerId: 'tg_1', status: REFERRAL_SESSION_STATUSES.active }, validSessionId), {
  id: validSessionId,
  referrerId: 'tg_1',
  flowId: '',
  deviceId: '',
  source: '',
  status: 'active',
  completed: false,
  authType: '',
  userId: '',
});

for (const type of [
  'SESSION_CREATED',
  'SESSION_RESTORED',
  'SESSION_ATTACHED',
  'SESSION_EXPIRED',
  'SESSION_COMPLETED',
  'SESSION_MISSING',
  'SESSION_TELEGRAM_LINKED',
  'SESSION_EMAIL_LINKED',
  'SESSION_PROFILE_SYNC',
]) {
  assert.ok(REFERRAL_EVENT_TYPES[type], `missing referral session event ${type}`);
}

const main = fs.readFileSync('src/main.jsx', 'utf8');
const referralDiagnostics = fs.readFileSync('src/referralDiagnostics.js', 'utf8');
const emailAuth = fs.readFileSync('src/EmailAuth.jsx', 'utf8');
const profilePanel = fs.readFileSync('src/ProfilePanel.jsx', 'utf8');
const telegramStart = fs.readFileSync('server/src/routes/telegram-auth-start.js', 'utf8');
const telegramUpdates = fs.readFileSync('server/src/lib/telegramUpdates.js', 'utf8');
const userActions = fs.readFileSync('server/src/routes/user-actions.js', 'utf8');
const emailAuthServer = fs.readFileSync('server/src/routes/email-auth.js', 'utf8');
const adminActions = fs.readFileSync('server/src/routes/admin-actions.js', 'utf8');
const adminPanel = fs.readFileSync('src/AdminPanel.jsx', 'utf8');
const server = fs.readFileSync('server/src/server.js', 'utf8');

assert.ok(server.includes('referralSessionRoutes'), 'server must register referral session endpoint');
assert.ok(main.includes('__APG_REFERRAL_SESSION_PROMISE__'), 'main must create referral session before React render');
assert.ok(referralDiagnostics.includes('apg_referral_session_id'), 'client must cache server referral session id');
assert.ok(referralDiagnostics.includes('/api/referral-session'), 'client must create/restore server referral session');
assert.ok(emailAuth.includes('referralSessionId'), 'EmailAuth must send referralSessionId');
assert.ok(emailAuthServer.includes('resolveReferralSessionReferrer'), 'email auth must resolve referrer from server session');
assert.ok(profilePanel.includes('telegram_auth_start') && profilePanel.includes('referralSessionId'), 'Telegram auth start must include referral session');
assert.ok(telegramStart.includes("collection('telegramAuthSessions')") && telegramStart.includes('referralSessionId'), 'telegram auth session must persist referral session');
assert.ok(telegramUpdates.includes('resolveReferralSessionReferrer') && telegramUpdates.includes('getEconomyReward'), 'telegram bot must resolve session and use economy rewards');
assert.ok(userActions.includes('sessionResolution.referrerId || requestedRefId'), 'profile:sync must prefer server session over legacy referrerId');
assert.ok(userActions.includes('SESSION_PROFILE_SYNC'), 'profile:sync must log session profile sync event');
assert.ok(adminActions.includes("collection('referralSessions')"), 'admin diagnostics must load referral sessions');
assert.ok(adminPanel.includes('Referral Sessions'), 'admin panel must show referral sessions');
assert.ok(adminActions.includes('buildReferralFunnel') && adminActions.includes('buildReferralHealth'), 'admin diagnostics must compute referral funnel and health');
assert.ok(adminActions.includes('detectIncompleteReferralSessions') && adminActions.includes('recoveryCandidates'), 'admin diagnostics must expose failed sessions and recovery candidates');
for (const label of ['Referral Timeline', 'Referral Funnel', 'Incomplete Sessions', 'Needs Recovery', 'Referral Health', 'Session Inspector']) {
  assert.ok(adminPanel.includes(label), `admin panel must render ${label}`);
}

const now = new Date('2026-07-17T12:00:30.000Z');
const sampleEvents = [
  { id: 'e1', type: REFERRAL_EVENT_TYPES.SESSION_CREATED, status: 'created', sessionId: validSessionId, referralFlowId: 'flow_1', referrerId: 'tg_1', timestamp: '2026-07-17T12:00:00.000Z' },
  { id: 'e2', type: REFERRAL_EVENT_TYPES.AUTH_STARTED, status: 'started', sessionId: validSessionId, referralFlowId: 'flow_1', timestamp: '2026-07-17T12:00:04.000Z' },
  { id: 'e3', type: REFERRAL_EVENT_TYPES.SESSION_PROFILE_SYNC, status: 'completed', sessionId: validSessionId, referralFlowId: 'flow_1', referredUserId: 'email:a@example.com', timestamp: '2026-07-17T12:00:12.000Z' },
  { id: 'e4', type: REFERRAL_EVENT_TYPES.SESSION_ATTACHED, status: 'completed', sessionId: validSessionId, referralFlowId: 'flow_1', referredUserId: 'email:a@example.com', timestamp: '2026-07-17T12:00:16.000Z' },
  { id: 'e5', type: REFERRAL_EVENT_TYPES.REWARD_GRANTED, status: 'completed', sessionId: validSessionId, referralFlowId: 'flow_1', referredUserId: 'email:a@example.com', timestamp: '2026-07-17T12:00:18.000Z' },
];
const sampleSessions = [{ id: validSessionId, referrerId: 'tg_1', referralFlowId: 'flow_1', createdAt: '2026-07-17T12:00:00.000Z', completed: true, completedAt: '2026-07-17T12:00:18.000Z' }];
const funnel = buildReferralFunnel(sampleEvents, now);
assert.equal(funnel.today.sessionsCreated, 1, 'funnel counts created sessions');
assert.equal(funnel.today.profileSync, 1, 'funnel counts profile sync stage');
assert.equal(funnel.today.rewardGranted, 1, 'funnel counts rewards');
assert.equal(detectIncompleteReferralSessions(sampleSessions, sampleEvents, now).length, 0, 'completed sessions are not failed sessions');
const inspectors = buildReferralSessionInspectors(sampleSessions, sampleEvents);
assert.equal(inspectors[0].rewardStatus, 'granted', 'session inspector exposes reward status');
assert.equal(inspectors[0].completionSeconds, 18, 'session inspector exposes completion time');
const health = buildReferralHealth(sampleEvents, sampleSessions, [], now);
assert.equal(health.brokenSessions, 0, 'health shows no broken completed sessions');
assert.equal(health.completedToday, 1, 'health shows completed today');

console.log('Referral Session Architecture v2 regression passed');
