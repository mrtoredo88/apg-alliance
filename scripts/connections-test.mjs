import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  CONNECTION_SOURCE,
  CONNECTION_STATUS,
  buildConnectionSharedContext,
  connectionId,
  createConnectionContext,
  normalizeConnectionSource,
  normalizeConnectionStatus,
  socialDirectDialogId,
  socialRequestId,
} from '../server-shared/social-messaging.js';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const server = read('server/src/routes/user-actions.js');
const shared = read('server-shared/social-messaging.js');
const profile = read('src/ProfilePanel.jsx');
const userApp = read('src/UserApp.jsx');
const rules = read('firestore.rules');
const pkg = JSON.parse(read('package.json'));

const scenarios = Array.from({ length: 1000 }, (_, index) => {
  const left = `user_${index % 97}`;
  const right = `user_${(index * 17 + 5) % 113}`;
  const source = [CONNECTION_SOURCE.MANUAL, CONNECTION_SOURCE.QR, CONNECTION_SOURCE.EVENT, CONNECTION_SOURCE.PARTNER, CONNECTION_SOURCE.EXPERT, CONNECTION_SOURCE.NETWORKING][index % 6];
  return { index, left, right: right === left ? `${right}_other` : right, source };
});

for (const scenario of scenarios) {
  const requestId = socialRequestId(scenario.left, scenario.right);
  const dialogId = socialDirectDialogId(scenario.left, scenario.right);
  const cid = connectionId(scenario.left, scenario.right);
  assert.match(requestId, /^social__/);
  assert.match(dialogId, /^direct__/);
  assert.match(cid, /^connection__/);
  assert.equal(socialRequestId(scenario.right, scenario.left), requestId, 'request pair is stable');
  assert.equal(socialDirectDialogId(scenario.right, scenario.left), dialogId, 'direct dialog pair is stable');
  assert.equal(connectionId(scenario.right, scenario.left), cid, 'connection pair is stable');
  const context = createConnectionContext({ source: scenario.source, sourceId: `src_${scenario.index}`, sourceTitle: `Source ${scenario.index}` });
  assert.equal(context.source, scenario.source);
  assert.ok(context.sourceLabel);
  assert.equal(normalizeConnectionSource(context.source), scenario.source);
  assert.equal(normalizeConnectionStatus(scenario.index % 4 === 0 ? 'accepted' : 'pending'), scenario.index % 4 === 0 ? CONNECTION_STATUS.CONNECTED : CONNECTION_STATUS.PENDING);
  const sharedContext = buildConnectionSharedContext(
    { registeredEventIds: ['event-a', `event-${scenario.index}`], visitedPartnerIds: ['partner-a'], connectionIds: ['mutual-a'] },
    { eventIds: ['event-a'], partnerIds: ['partner-a', 'partner-b'], friendIds: ['mutual-a', 'mutual-b'] },
  );
  assert.deepEqual(sharedContext.events, ['event-a']);
  assert.deepEqual(sharedContext.partners, ['partner-a']);
  assert.deepEqual(sharedContext.contacts, ['mutual-a']);
}

[
  'connections:check',
  'connections:list',
  'connections:request',
  'connections:accept',
  'connections:decline',
  'connections:block',
  'mirrorConnection',
  'connectionStatus',
  'digital_handshake',
  'ensureDirectDialogForPair',
  'writeSocialNotification',
].forEach(marker => assert.ok(server.includes(marker), `server marker missing: ${marker}`));

[
  'CONNECTION_STATUS',
  'CONNECTION_SOURCE',
  'createConnectionContext',
  'buildConnectionSharedContext',
  'socialPublicUser',
].forEach(marker => assert.ok(shared.includes(marker), `shared marker missing: ${marker}`));

[
  'data-connections-panel',
  'data-connections-dev-panel',
  'data-my-contacts-button',
  'data-business-card-modal',
  'QRCodeSVG',
  "userAction('connections:list')",
  "userAction('connections:request'",
  "userAction('connections:check'",
  "userAction(action, { requestId })",
].forEach(marker => assert.ok(profile.includes(marker), `profile marker missing: ${marker}`));

[
  "section === 'profile' && id",
  "type: 'profile-user'",
  'initialConnectionTargetId',
  'connectionContext',
].forEach(marker => assert.ok(userApp.includes(marker), `UserApp marker missing: ${marker}`));

assert.ok(rules.includes('match /connections/{connectionId}'), 'connections owner mirror rule is missing');
assert.ok(rules.includes("['socialMessagingRequests', 'blockedUsers', 'connections']"), 'connections must be excluded from generic writable subcollections');
assert.ok(rules.includes('.data.userId == userId'), 'owner rule must support identity-core userId mappings');
assert.ok(rules.includes('.data.canonicalUserId == userId'), 'owner rule must support canonical identity mappings');
assert.equal(pkg.scripts['test:connections'], 'node scripts/connections-test.mjs');

[
  '/api/connections',
  'collection(db, \'connections\'',
  'addDoc(collection(db, \'connections\'',
  'createConversationEngine',
].forEach(forbidden => {
  assert.equal(server.includes(forbidden) || profile.includes(forbidden), false, `forbidden duplicate system marker found: ${forbidden}`);
});

console.log(`APG Connections v1 regression passed: ${scenarios.length} scenarios`);
