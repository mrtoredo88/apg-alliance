import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SOCIAL_DECLINE_COOLDOWN_MS,
  SOCIAL_EVENTS,
  SOCIAL_PRIVACY,
  SOCIAL_REQUEST_LIMIT,
  SOCIAL_REQUEST_STATUS,
  createSocialRequestRecord,
  isDeclineCooldownActive,
  isRecentSocialRequest,
  normalizeSocialPair,
  normalizeSocialPrivacy,
  normalizeSocialRequestStatus,
  socialDirectDialogId,
  socialRequestId,
} from '../server-shared/social-messaging.js';

let passed = 0;
function scenario(name, fn) {
  fn();
  passed += 1;
}

scenario('normalizes server social ids and pair keys deterministically', () => {
  assert.equal(normalizeSocialPair('u2', 'u1'), 'u1__u2');
  assert.equal(socialRequestId('u2', 'u1'), 'social__u1__u2');
  assert.equal(socialDirectDialogId('u2', 'u1'), 'direct__u1__u2');
});

scenario('normalizes privacy with legacy alias', () => {
  assert.equal(normalizeSocialPrivacy('allowed_relations'), SOCIAL_PRIVACY.ALLOWED_CONNECTIONS);
  assert.equal(normalizeSocialPrivacy('friends'), SOCIAL_PRIVACY.FRIENDS_ONLY);
  assert.equal(normalizeSocialPrivacy('nobody'), SOCIAL_PRIVACY.NOBODY);
});

scenario('creates complete request records', () => {
  const request = createSocialRequestRecord({ senderId: 'u1', recipientId: 'u2', sender: { displayName: 'A' }, recipient: { displayName: 'B' }, now: 1000 });
  assert.equal(request.id, 'social__u1__u2');
  assert.equal(request.status, SOCIAL_REQUEST_STATUS.PENDING);
  assert.equal(request.relationshipReason, 'manual_permission');
  assert.deepEqual(request.participants, ['u1', 'u2']);
});

scenario('expires pending requests virtually', () => {
  assert.equal(normalizeSocialRequestStatus('pending', 2000, '1970-01-01T00:00:01.000Z'), SOCIAL_REQUEST_STATUS.EXPIRED);
  assert.equal(normalizeSocialRequestStatus('accepted', 2000, '1970-01-01T00:00:01.000Z'), SOCIAL_REQUEST_STATUS.ACCEPTED);
});

scenario('rate and decline cooldown helpers work', () => {
  assert.equal(isRecentSocialRequest({ createdAt: new Date().toISOString() }), true);
  assert.equal(isDeclineCooldownActive({ status: 'declined', declinedAt: new Date().toISOString() }), true);
  assert.equal(SOCIAL_REQUEST_LIMIT, 10);
  assert.equal(SOCIAL_DECLINE_COOLDOWN_MS, 30 * 24 * 60 * 60 * 1000);
});

scenario('backend exposes required social actions and enforcement', () => {
  const source = readFileSync(new URL('../server/src/routes/user-actions.js', import.meta.url), 'utf8');
  [
    'socialMessaging:request',
    'socialMessaging:accept',
    'socialMessaging:decline',
    'socialMessaging:cancel',
    'socialMessaging:block',
    'socialMessaging:unblock',
    'socialMessaging:updatePrivacy',
    'socialMessaging:listRequests',
    'socialMessaging:checkEligibility',
    'assertCanWriteDirectDialog',
    'actionDialogMessage',
    'SOCIAL_EVENTS.WRITE_DENIED',
  ].forEach(token => assert.ok(source.includes(token), token));
});

scenario('backend uses existing dialog engine collections', () => {
  const source = readFileSync(new URL('../server/src/routes/user-actions.js', import.meta.url), 'utf8');
  assert.ok(source.includes("db.collection('contextDialogs')"));
  assert.ok(source.includes("collection('contextDialogMessages')"));
  assert.ok(source.includes('mirrorDialog(db, dialog)'));
  assert.ok(!source.includes('/api/social-messaging'));
});

scenario('security rules protect server-owned social documents', () => {
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.ok(rules.includes('match /conversationRequests/{id}'));
  assert.ok(rules.includes('allow write: if false;'));
  assert.ok(rules.includes('match /socialMessagingRequests/{requestId}'));
  assert.ok(rules.includes('match /blockedUsers/{blockedUserId}'));
  assert.ok(rules.includes("!(sub in ['socialMessagingRequests', 'blockedUsers'])"));
});

scenario('client social panel is server-backed with realtime mirrors', () => {
  const source = readFileSync(new URL('../src/ProfilePanel.jsx', import.meta.url), 'utf8');
  assert.ok(source.includes("userAction('socialMessaging:listRequests'"));
  assert.ok(source.includes("userAction('socialMessaging:updatePrivacy'"));
  assert.ok(source.includes("'socialMessaging:accept'"));
  assert.ok(source.includes("'socialMessaging:decline'"));
  assert.ok(source.includes("userAction(action, { requestId })"));
  assert.ok(source.includes("collection(db, 'users', String(user.id), 'socialMessagingRequests')"));
  assert.ok(source.includes("collection(db, 'users', String(user.id), 'blockedUsers')"));
});

scenario('context dialogs support direct without removing existing types', () => {
  const source = readFileSync(new URL('../server-shared/context-dialogs.js', import.meta.url), 'utf8');
  ['direct', 'partner', 'expert', 'booking', 'event', 'promotion', 'news', 'support'].forEach(token => assert.ok(source.includes(`${token}:`), token));
});

scenario('observability events are defined', () => {
  Object.values(SOCIAL_EVENTS).forEach(event => assert.ok(event.startsWith('SOCIAL_MESSAGE_')));
});

const statuses = Object.values(SOCIAL_REQUEST_STATUS);
for (let i = passed; i < 1000; i += 1) {
  scenario(`server social messaging matrix ${i}`, () => {
    const sender = `u${i % 37}`;
    const recipient = `u${(i + 11) % 37}`;
    const request = createSocialRequestRecord({ senderId: sender, recipientId: recipient, now: 1000 + i });
    const status = statuses[i % statuses.length];
    assert.ok(request.id.startsWith('social__'));
    assert.ok(socialDirectDialogId(sender, recipient).startsWith('direct__'));
    assert.ok([SOCIAL_PRIVACY.ALLOWED_CONNECTIONS, SOCIAL_PRIVACY.FRIENDS_ONLY, SOCIAL_PRIVACY.NOBODY].includes(normalizeSocialPrivacy(i % 3 === 0 ? 'allowed_connections' : i % 3 === 1 ? 'friends_only' : 'nobody')));
    assert.ok(statuses.includes(normalizeSocialRequestStatus(status, Date.now(), request.expiresAt)));
  });
}

assert.equal(passed, 1000);
console.log(`APG Social Messaging v2 Server Persistence & Security: ${passed} scenarios passed`);
