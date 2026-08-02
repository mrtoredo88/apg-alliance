import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isIgnorableErrorPayload } from '../server-shared/error-log.js';
import { isErrorActionable, isExpectedAdminAccessNoise } from '../server-shared/error-policy.js';

const client = readFileSync(new URL('../src/errorLogger.js', import.meta.url), 'utf8');
const adminPanel = readFileSync(new URL('../src/AdminPanel.jsx', import.meta.url), 'utf8');
const userApp = readFileSync(new URL('../src/UserApp.jsx', import.meta.url), 'utf8');
const userActions = readFileSync(new URL('../server/src/routes/user-actions.js', import.meta.url), 'utf8');

assert.equal(isIgnorableErrorPayload({
  message: 'Telegram не привязан к профилю.',
  source: 'ProfilePanel.telegramAvatar.refresh',
}), true);
assert.equal(isExpectedAdminAccessNoise({
  message: 'APP_DATA_QUERY_FAILED: Нет доступа к данным.',
  source: 'AdminPanel.fetchData.notifications.attempt1',
}), true);
assert.equal(isIgnorableErrorPayload({
  message: 'Нет доступа к данным.',
  source: 'AdminPanel.fetchData.customTasks.attempt1',
}), true);
assert.equal(isExpectedAdminAccessNoise({
  message: 'Нет доступа к данным.',
  source: 'PartnerPage.fetchReviews',
}), false, 'Real user-facing access failures must remain visible.');
assert.equal(isErrorActionable({
  message: 'Current failure', version: 'newbuild1', resolved: false, archived: false,
}, { currentVersion: 'newbuild1' }), true);
assert.equal(isErrorActionable({
  message: 'Old failure', version: 'oldbuild1', resolved: false, archived: false,
}, { currentVersion: 'newbuild1' }), false);
assert.equal(isErrorActionable({
  message: 'Нет доступа к данным.', source: 'AdminPanel.fetchData.notifications.attempt1', version: 'newbuild1',
}, { currentVersion: 'newbuild1' }), false);
assert.match(client, /transientNetworkError/);
assert.match(client, /isExpectedAdminAccessNoise/);
assert.match(adminPanel, /typeof __APG_BUILD_VERSION__ !== 'undefined'/, 'Admin error policy must use the real production build version.');
assert.ok(client.includes('`network|${String(message).slice(0, 120)}`'));
assert.ok(client.includes("transientNetworkError ? 'warning'"));
assert.match(userApp, /PUBLIC_BOOTSTRAP_RETRIES = 1/);
assert.ok(userApp.includes('setTimeout(resolve, 350)'));
const existingSyncPayload = userApp.slice(
  userApp.indexOf('const syncExistingPayload = {'),
  userApp.indexOf('if (isAuthLoadAborted(runId,', userApp.indexOf('const syncExistingPayload = {')),
);
assert.equal(existingSyncPayload.includes('userId:'), false, 'background profile sync must use the authenticated actor');
assert.match(userActions, /async function assertOwn\(actor, userId\)/, 'Ownership checks must resolve legacy identity aliases asynchronously.');
assert.match(userActions, /identityV2\.getUser\(target\)/, 'Ownership checks must resolve aliases through Identity V2.');
assert.match(userActions, /if \(resolved === actor\.userId \|\| resolved === actor\.uid\) return actor\.userId;/, 'A verified alias must write to the canonical actor profile.');
assert.doesNotMatch(userActions, /const userId = assertOwn\(/, 'Every ownership check must await alias resolution.');

console.log('ERROR_OBSERVABILITY_REGRESSION_OK');
