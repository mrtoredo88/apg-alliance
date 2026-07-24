import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isIgnorableErrorPayload } from '../server-shared/error-log.js';

const client = readFileSync(new URL('../src/errorLogger.js', import.meta.url), 'utf8');
const userApp = readFileSync(new URL('../src/UserApp.jsx', import.meta.url), 'utf8');

assert.equal(isIgnorableErrorPayload({
  message: 'Telegram не привязан к профилю.',
  source: 'ProfilePanel.telegramAvatar.refresh',
}), true);
assert.match(client, /transientNetworkError/);
assert.ok(client.includes('`network|${String(message).slice(0, 120)}`'));
assert.ok(client.includes("transientNetworkError ? 'warning'"));
assert.match(userApp, /PUBLIC_BOOTSTRAP_RETRIES = 1/);
assert.ok(userApp.includes('setTimeout(resolve, 350)'));
const existingSyncPayload = userApp.slice(
  userApp.indexOf('const syncExistingPayload = {'),
  userApp.indexOf('if (isAuthLoadAborted(runId,', userApp.indexOf('const syncExistingPayload = {')),
);
assert.equal(existingSyncPayload.includes('userId:'), false, 'background profile sync must use the authenticated actor');

console.log('ERROR_OBSERVABILITY_REGRESSION_OK');
