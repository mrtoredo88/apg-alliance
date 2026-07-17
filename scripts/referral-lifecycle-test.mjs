import assert from 'node:assert/strict';
import fs from 'node:fs';
import { detectReferralFromLocation, drainReferralEventQueue, getReferralContext, normalizeReferralValue, readPendingReferral, refLog, savePendingReferral } from '../src/referralDiagnostics.js';
import { buildReferralRecoveryDecision } from '../server-shared/referral-recovery.js';
import {
  REFERRAL_EVENT_TYPES,
  aggregateReferralEvents,
  buildReferralTimeline,
  detectReferralProblems,
  filterReferralEvents,
  referralEventsToCsv,
  referralEventsToJson,
} from '../server-shared/referral-observability.js';

function makeStorage() {
  const map = new Map();
  return {
    getItem: key => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: key => { map.delete(key); },
  };
}

assert.equal(detectReferralFromLocation({ search: '?ref=tg_1670282567', hash: '' }), 'tg_1670282567');
assert.equal(detectReferralFromLocation({ search: '', hash: '#/home&ref=tg_1670282567' }), 'tg_1670282567');
assert.equal(normalizeReferralValue(' tg_1670282567 '), 'tg_1670282567');
assert.equal(normalizeReferralValue('user 42'), 'user 42');
assert.equal(normalizeReferralValue('bad<value'), '');

const storage = makeStorage();
assert.equal(readPendingReferral({ locationLike: { search: '?ref=tg_1670282567', hash: '', pathname: '/' }, storage, source: 'test' }), 'tg_1670282567');
assert.equal(storage.getItem('apg_pending_ref'), 'tg_1670282567');
assert.equal(readPendingReferral({ locationLike: { search: '', hash: '', pathname: '/' }, storage, source: 'test.restore' }), 'tg_1670282567');
savePendingReferral('tg_42', 'test.save', storage);
assert.equal(storage.getItem('apg_pending_ref'), 'tg_42');

globalThis.localStorage = makeStorage();
globalThis.sessionStorage = makeStorage();
savePendingReferral('tg_1670282567', 'test.flow');
const firstContext = getReferralContext({ ref: 'tg_1670282567', source: 'test.flow' });
refLog('query detected', { value: 'tg_1670282567', source: 'test.flow' });
refLog('auth start', { value: 'tg_1670282567', provider: 'email' });
const queuedEvents = drainReferralEventQueue();
assert.ok(firstContext.referralFlowId.startsWith('ref_flow_'), 'referral flow id is created');
assert.ok(queuedEvents.some(event => event.type === REFERRAL_EVENT_TYPES.QUERY_DETECTED), 'query detected event is queued');
assert.ok(queuedEvents.every(event => event.referralFlowId === firstContext.referralFlowId), 'queued events share referralFlowId');

const userApp = fs.readFileSync('src/UserApp.jsx', 'utf8');
const emailAuth = fs.readFileSync('src/EmailAuth.jsx', 'utf8');
const userActions = fs.readFileSync('server/src/routes/user-actions.js', 'utf8');
const adminActions = fs.readFileSync('server/src/routes/admin-actions.js', 'utf8');
const adminPanel = fs.readFileSync('src/AdminPanel.jsx', 'utf8');

const storageKeysBlock = userApp.match(/const USER_AUTH_STORAGE_KEYS = \[[\s\S]*?\];/)?.[0] || '';
assert.ok(!storageKeysBlock.includes('apg_pending_ref'), 'auth cleanup must not wipe pending referral');
assert.ok(emailAuth.includes('referralSessionId: serverSession?.referralSessionId'), 'EmailAuth must pass server referral session to UserApp');
assert.ok(emailAuth.includes('referralSessionIdLocal: referralContext.sessionId'), 'EmailAuth must keep legacy referral session only as local fallback');
assert.ok(!emailAuth.includes("localStorage.removeItem('apg_pending_ref')"), 'EmailAuth must not clear referral before profile:sync confirms reward');
assert.ok(userApp.includes('...(authRefId ? { referrerId: authRefId } : {})'), 'email profile:sync must include referrerId');
assert.ok(userApp.includes('profileResult?.referralBonusAwarded'), 'email auth flow must wait for server referral award');
assert.ok(userApp.includes('syncResult?.referralBonusAwarded'), 'new user flow must clear referral only after server award');
assert.ok(emailAuth.includes('referralFlowId'), 'EmailAuth must send referral flow id');
assert.ok(userApp.includes('referralClientEvents: drainReferralEventQueue()'), 'profile:sync must flush referral client events');
assert.ok(userApp.includes("refLog('recovery completed'"), 'referral recovery completion must be diagnostically visible');
assert.ok(userApp.includes("refLog('already rewarded'"), 'idempotent repeat must be diagnostically visible');
assert.ok(userApp.includes("refLog('duplicate prevented'"), 'duplicate prevention must be diagnostically visible');
assert.ok(userApp.includes("refLog('retry after reconnect'"), 'network retry state must be diagnostically visible');
assert.ok(userActions.includes("collection('referralEvents')") || userActions.includes('recordReferralEventAsync'), 'profile:sync must write referral events best-effort');
assert.ok(adminActions.includes('referrals:diagnostics'), 'admin actions must expose referral diagnostics');
assert.ok(adminPanel.includes('Referral Diagnostics'), 'admin panel must render referral diagnostics');

const emailCrashRecovery = buildReferralRecoveryDecision({
  userId: 'email:new@example.com',
  currentReferredBy: 'tg_1670282567',
  referralBonusGranted: false,
  referrerExists: true,
  referrerRewardedUsers: [],
});
assert.equal(emailCrashRecovery.status, 'recovery_completed', 'partial email user is recovered on next profile:sync');
assert.equal(emailCrashRecovery.grantReferrerReward, true, 'recovery grants referrer once');
assert.equal(emailCrashRecovery.grantInviteeReward, false, 'recovery does not grant invitee keys twice when referredBy already exists');
assert.equal(emailCrashRecovery.markInvitedRewarded, true, 'recovery closes invited user flag');

const repeatLogin = buildReferralRecoveryDecision({
  userId: 'email:new@example.com',
  currentReferredBy: 'tg_1670282567',
  referralBonusGranted: true,
  referrerExists: true,
  referrerRewardedUsers: ['email:new@example.com'],
});
assert.equal(repeatLogin.status, 'already_rewarded', 'repeat login is idempotent');
assert.equal(repeatLogin.grantReferrerReward, false, 'repeat login cannot grant referrer twice');

const twoTabsSecondTransaction = buildReferralRecoveryDecision({
  userId: 'email:new@example.com',
  currentReferredBy: 'tg_1670282567',
  referralBonusGranted: false,
  referrerExists: true,
  referrerRewardedUsers: ['email:new@example.com'],
});
assert.equal(twoTabsSecondTransaction.status, 'duplicate_prevented', 'second concurrent tab does not increment counters again');
assert.equal(twoTabsSecondTransaction.markInvitedRewarded, true, 'second tab can close invited flag without awarding again');
assert.equal(twoTabsSecondTransaction.grantReferrerReward, false, 'second concurrent tab cannot double-award referrer');

const freshEmailRegistration = buildReferralRecoveryDecision({
  userId: 'email:fresh@example.com',
  requestedReferrerId: 'tg_1670282567',
  currentReferredBy: '',
  referralBonusGranted: false,
  referrerExists: true,
  referrerRewardedUsers: [],
});
assert.equal(freshEmailRegistration.status, 'completed', 'fresh registration attaches referral');
assert.equal(freshEmailRegistration.grantInviteeReward, true, 'fresh registration grants invitee keys');

const reconnectRecovery = buildReferralRecoveryDecision({
  userId: 'email:offline@example.com',
  currentReferredBy: 'tg_1670282567',
  referralBonusGranted: false,
  referrerExists: true,
});
assert.equal(reconnectRecovery.status, 'recovery_completed', 'reconnect profile:sync recovers unfinished referral');

const now = new Date('2026-07-17T10:10:00.000Z');
const lifecycleEvents = [
  { id: '1', timestamp: '2026-07-17T10:00:00.000Z', referralFlowId: 'flow1', referralCode: 'tg_1', referrerId: 'tg_1', type: REFERRAL_EVENT_TYPES.QUERY_DETECTED, status: 'info', source: 'test' },
  { id: '2', timestamp: '2026-07-17T10:01:00.000Z', referralFlowId: 'flow1', referralCode: 'tg_1', referredUserId: 'email:a@example.com', type: REFERRAL_EVENT_TYPES.AUTH_STARTED, status: 'started', source: 'test' },
  { id: '3', timestamp: '2026-07-17T10:02:00.000Z', referralFlowId: 'flow1', referralCode: 'tg_1', referredUserId: 'email:a@example.com', type: REFERRAL_EVENT_TYPES.USER_CREATED, status: 'completed', source: 'test' },
  { id: '4', timestamp: '2026-07-17T10:02:05.000Z', referralFlowId: 'flow1', referralCode: 'tg_1', referredUserId: 'email:a@example.com', type: REFERRAL_EVENT_TYPES.REFERRAL_ATTACHED, status: 'completed', source: 'test' },
  { id: '5', timestamp: '2026-07-17T10:02:10.000Z', referralFlowId: 'flow1', referralCode: 'tg_1', referredUserId: 'email:a@example.com', type: REFERRAL_EVENT_TYPES.REWARD_GRANTED, status: 'completed', source: 'test' },
  { id: '6', timestamp: '2026-07-17T10:00:00.000Z', referralFlowId: 'flow2', referralCode: 'tg_2', type: REFERRAL_EVENT_TYPES.AUTH_STARTED, status: 'started', source: 'test' },
];
const timeline = buildReferralTimeline(lifecycleEvents);
assert.equal(timeline[0].id, 'flow1', 'timeline is ordered by last event desc');
assert.equal(timeline.find(row => row.id === 'flow1').status, 'completed', 'rewarded flow is completed');
const dashboard = aggregateReferralEvents(lifecycleEvents, now);
assert.equal(dashboard.total.openedLinks, 1, 'dashboard counts link opens');
assert.equal(dashboard.total.authStarted, 2, 'dashboard counts auth starts');
assert.equal(dashboard.total.successfulRegistrations, 1, 'dashboard counts registrations');
assert.equal(dashboard.total.rewardsGranted, 1, 'dashboard counts rewards');
assert.equal(filterReferralEvents(lifecycleEvents, { referralFlowId: 'flow1' }).length, 5, 'diagnostics filter supports flow id');
assert.ok(referralEventsToCsv(lifecycleEvents).includes('referralFlowId'), 'csv export includes headers');
assert.equal(JSON.parse(referralEventsToJson(lifecycleEvents)).length, lifecycleEvents.length, 'json export is valid');
assert.ok(detectReferralProblems(lifecycleEvents, now).some(problem => problem.type === 'stuck_referral'), 'problem detection highlights stuck flows');

console.log('Referral lifecycle regression passed');
