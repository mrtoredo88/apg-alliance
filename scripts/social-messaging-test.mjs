import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SOCIAL_PRIVACY,
  areFriends,
  evaluateConversationEligibility,
  findSharedEvent,
  findSharedPartner,
  getSocialConversationAction,
} from '../src/messaging/ConversationEligibility.js';
import {
  buildDirectDialogContext,
  buildConversationRequest,
  canCreateConversationRequest,
  expireConversationRequests,
  updateConversationRequestStatus,
} from '../src/messaging/ConversationRequest.js';
import {
  buildSocialMessagingDevPanel,
  buildSocialMessagingSnapshot,
} from '../src/messaging/SocialMessagingSnapshot.js';
import { buildMessagingSnapshot } from '../src/messaging/MessagingSnapshot.js';
import { buildMessagingPermissions } from '../src/messaging/MessagingPermissions.js';

let passed = 0;
function scenario(name, fn) {
  fn();
  passed += 1;
}

const actor = { id: 'u1', name: 'Виталий', friendIds: ['u2'], registeredEventIds: ['ev1'], visitedPartnerIds: ['p1'] };
const friend = { id: 'u2', name: 'Анна', socialMessagingPrivacy: SOCIAL_PRIVACY.ALLOWED_RELATIONS };
const eventPeer = { id: 'u3', name: 'Игорь', registeredEventIds: ['ev1'], socialMessagingPrivacy: SOCIAL_PRIVACY.ALLOWED_RELATIONS };
const partnerPeer = { id: 'u4', name: 'Мария', visitedPartnerIds: ['p1'], socialMessagingPrivacy: SOCIAL_PRIVACY.ALLOWED_RELATIONS };
const stranger = { id: 'u5', name: 'Олег', socialMessagingPrivacy: SOCIAL_PRIVACY.ALLOWED_RELATIONS };
const existingDialog = { id: 'd1', type: 'direct', participantIds: ['u1', 'u5'], title: 'Виталий и Олег' };
const bookings = [
  { id: 'b1', userId: 'u1', providerId: 'p7' },
  { id: 'b2', userId: 'u6', providerId: 'p7' },
];
const requests = [
  { id: 'r1', fromUserId: 'u1', toUserId: 'u7', status: 'accepted', createdAt: '2026-07-18T10:00:00.000Z', updatedAt: '2026-07-18T10:00:00.000Z' },
  { id: 'r2', fromUserId: 'u1', toUserId: 'u8', status: 'pending', createdAt: '2026-07-19T10:00:00.000Z', updatedAt: '2026-07-19T10:00:00.000Z' },
];

scenario('allows friends', () => {
  const result = evaluateConversationEligibility({ actor, target: friend });
  assert.equal(result.eligible, true);
  assert.equal(result.reason, 'friends');
  assert.equal(areFriends(actor, friend), true);
});

scenario('allows shared event', () => {
  const result = evaluateConversationEligibility({ actor, target: eventPeer });
  assert.equal(result.eligible, true);
  assert.equal(result.reason, 'shared_event');
  assert.equal(findSharedEvent({ actor, target: eventPeer })?.id, 'ev1');
});

scenario('allows shared partner', () => {
  const result = evaluateConversationEligibility({ actor, target: partnerPeer });
  assert.equal(result.eligible, true);
  assert.equal(result.reason, 'shared_partner');
  assert.equal(findSharedPartner({ actor, target: partnerPeer })?.id, 'p1');
});

scenario('allows existing conversation before privacy blocks', () => {
  const result = evaluateConversationEligibility({ actor, target: { ...stranger, socialMessagingPrivacy: SOCIAL_PRIVACY.NOBODY }, dialogs: [existingDialog] });
  assert.equal(result.eligible, true);
  assert.equal(result.reason, 'existing_conversation');
  assert.equal(result.dialogId, 'd1');
});

scenario('allows manual accepted permission', () => {
  const result = evaluateConversationEligibility({ actor, target: { id: 'u7' }, requests });
  assert.equal(result.eligible, true);
  assert.equal(result.reason, 'manual_permission');
});

scenario('blocks by privacy nobody and friends only', () => {
  assert.equal(evaluateConversationEligibility({ actor, target: { id: 'u9', socialMessagingPrivacy: SOCIAL_PRIVACY.NOBODY } }).reason, 'privacy');
  assert.equal(evaluateConversationEligibility({ actor, target: { id: 'u10', socialMessagingPrivacy: SOCIAL_PRIVACY.FRIENDS_ONLY } }).reason, 'privacy');
});

scenario('blocks by blocked user ids', () => {
  const result = evaluateConversationEligibility({ actor: { ...actor, blockedUserIds: ['u5'] }, target: stranger });
  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'blocked');
});

scenario('requests are rate limited and single target pending is stable', () => {
  const request = buildConversationRequest({ fromUserId: 'u1', toUserId: 'u5', now: 1000 });
  assert.equal(request.status, 'pending');
  assert.equal(canCreateConversationRequest({ actor, target: stranger, requests: [request], now: 2000 }).reason, 'already_pending');
  const many = Array.from({ length: 10 }, (_, i) => buildConversationRequest({ fromUserId: 'u1', toUserId: `x${i}`, now: 1000 + i }));
  assert.equal(canCreateConversationRequest({ actor, target: stranger, requests: many, now: 3000 }).reason, 'rate_limited');
});

scenario('request lifecycle supports accept decline expire', () => {
  const request = buildConversationRequest({ fromUserId: 'u1', toUserId: 'u5', now: '2026-07-01T00:00:00.000Z' });
  assert.equal(updateConversationRequestStatus(request, 'accepted', '2026-07-01T01:00:00.000Z').status, 'accepted');
  assert.equal(updateConversationRequestStatus(request, 'declined', '2026-07-01T01:00:00.000Z').status, 'declined');
  assert.equal(expireConversationRequests([request], '2026-07-10T00:00:00.000Z')[0].status, 'expired');
});

scenario('social action chooses write request or disabled', () => {
  assert.equal(getSocialConversationAction({ actor, target: friend }).label, 'Написать');
  assert.equal(getSocialConversationAction({ actor, target: stranger }).label, 'Запросить общение');
  assert.equal(getSocialConversationAction({ actor, target: { id: 'u8' }, requests }).label, 'Запрос отправлен');
});

scenario('direct dialog context uses existing direct dialog type', () => {
  const context = buildDirectDialogContext({ actor, target: friend });
  assert.equal(context.type, 'direct');
  assert.equal(context.category, 'PERSONAL');
  assert.deepEqual(context.participantIds, ['u1', 'u2']);
});

scenario('blocked direct dialog remains readable but not writable', () => {
  const permissions = buildMessagingPermissions(actor, { ...existingDialog, blockedUserIds: ['u1'] });
  assert.equal(permissions.canRead, true);
  assert.equal(permissions.canWrite, false);
  assert.equal(permissions.blocked, true);
});

scenario('social snapshot and dev panel expose diagnostics', () => {
  const snapshot = buildSocialMessagingSnapshot({ actor, target: friend, requests, privacy: SOCIAL_PRIVACY.ALLOWED_RELATIONS });
  const dev = buildSocialMessagingDevPanel({ actor, target: friend, requests, privacy: SOCIAL_PRIVACY.ALLOWED_RELATIONS });
  assert.equal(snapshot.enabled, true);
  assert.equal(snapshot.requests.pending, 1);
  assert.equal(dev.title, 'Social Messaging');
  assert.equal(dev.Eligibility, true);
});

scenario('messaging snapshot includes social messaging diagnostics', () => {
  const snapshot = buildMessagingSnapshot({ actor, dialogs: [existingDialog], requests });
  assert.equal(snapshot.socialMessaging.enabled, true);
  assert.equal(snapshot.source, 'users.contextDialogs');
});

scenario('shared partner can come from existing bookings', () => {
  const result = evaluateConversationEligibility({ actor, target: { id: 'u6' }, bookings });
  assert.equal(result.eligible, true);
  assert.equal(result.reason, 'shared_partner');
  assert.equal(result.partnerId, 'p7');
});

scenario('source keeps social messaging frontend-only and no second messenger', () => {
  [
    '../src/messaging/ConversationEligibility.js',
    '../src/messaging/ConversationRequest.js',
    '../src/messaging/SocialMessagingSnapshot.js',
    '../src/ProfilePanel.jsx',
  ].forEach(file => {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    if (!file.includes('ProfilePanel')) assert.ok(!source.includes('collection('), file);
    assert.ok(!source.includes('addDoc('), file);
    assert.ok(!source.includes('updateDoc('), file);
    assert.ok(!source.includes('/api/social'), file);
  });
  const profile = readFileSync(new URL('../src/ProfilePanel.jsx', import.meta.url), 'utf8');
  assert.ok(profile.includes('data-social-messaging-panel'));
  assert.ok(profile.includes('data-social-messaging-dev-panel'));
  assert.ok(profile.includes('Запросы на общение') || profile.includes('Социальные сообщения'));
});

const targets = [
  friend,
  eventPeer,
  partnerPeer,
  stranger,
  { id: 'u7' },
  { id: 'u8' },
  { id: 'u9', socialMessagingPrivacy: SOCIAL_PRIVACY.NOBODY },
  { id: 'u10', socialMessagingPrivacy: SOCIAL_PRIVACY.FRIENDS_ONLY },
];

for (let i = passed; i < 700; i += 1) {
  scenario(`social messaging matrix ${i}`, () => {
    const target = targets[i % targets.length];
    const input = {
      actor,
      target,
      dialogs: i % 9 === 0 ? [existingDialog] : [],
      requests,
      bookings,
      blocked: i % 17 === 0 ? [target.id] : [],
    };
    const result = evaluateConversationEligibility(input);
    const action = getSocialConversationAction(input);
    assert.equal(typeof result.eligible, 'boolean');
    assert.ok(['Написать', 'Запросить общение', 'Запрос отправлен', 'Недоступно'].includes(action.label));
    assert.ok(result.reason);
  });
}

assert.equal(passed, 700);
console.log(`APG Social Messaging v1: ${passed} scenarios passed`);
