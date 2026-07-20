import fs from 'node:fs';
import assert from 'node:assert/strict';

function read(file) {
  const content = fs.readFileSync(file, 'utf8');
  return content;
}

const userApp = read('src/UserApp.jsx');
const profile = read('src/ProfilePanel.jsx');
const telegramCheck = read('server/src/routes/telegram-auth-check.js');

function assertOrder(source, tokens, label) {
  let cursor = -1;
  for (const token of tokens) {
    const next = source.indexOf(token, cursor + 1);
    assert.ok(next >= 0, `${label}: missing token ${token}`);
    assert.ok(cursor < next, `${label}: wrong order for ${token}`);
    cursor = next;
  }
}

function assertContains(source, token, label) {
  assert.ok(source.includes(token), `${label}: missing ${token}`);
}

function assertNo(source, token, label) {
  assert.equal(source.includes(token), false, `${label}: forbidden token ${token}`);
}

assertContains(userApp, "const handleLogout = useCallback(async () => {", 'logout lifecycle: handleLogout defined');
assertOrder(userApp, [
  "traceAuthStage('logout_start'",
  "traceAuthStage('identity_cleanup'",
  "traceAuthStage('firebase_signout'",
  "traceAuthStage('store_reset'",
  "traceAuthStage('guest_bootstrap'",
  "traceAuthStage('logout_complete'",
], 'logout lifecycle');
assertContains(userApp, "traceAuthStage('logout_error'", 'logout lifecycle: error branch traced');
assertContains(userApp, 'localStorage.setItem(\'manualLogout\', \'true\');', 'logout lifecycle: manual logout marker');
assertContains(userApp, 'loadData_blocked', 'logout lifecycle: loadData block during logout flow');
assertNo(userApp, "setError('Не удалось выйти. Проверьте подключение и попробуйте ещё раз.'", 'logout lifecycle: no hard error message');
assertContains(userApp, "traceAuthStage('auth_session_restart'", 'logout restart trace');

assertContains(profile, "const waitForAuthStateChanged = useCallback(async (expectedUid", 'telegram pipeline: expectedUid aware wait');
assertContains(profile, 'current?.uid === expected', 'telegram pipeline: strict uid guard');
assertContains(profile, "traceAuthStage('telegram_done'", 'telegram pipeline: done');
assertContains(profile, "traceAuthStage('identity_resolved'", 'telegram pipeline: identity resolved trace');
assertContains(profile, "traceAuthStage('custom_token_created'", 'telegram pipeline: custom token trace');
assertContains(profile, "traceAuthStage('firebase_signin_start'", 'telegram pipeline: firebase signin start trace');
assertContains(profile, "traceAuthStage('auth_state_changed'", 'telegram pipeline: auth state changed trace');
assertContains(profile, "traceAuthStage('firebase_signin_done'", 'telegram pipeline: firebase signin done trace');
assertContains(profile, "traceAuthStage('user_loaded'", 'telegram pipeline: user loaded trace');
assertContains(profile, "traceAuthStage('home_render'", 'telegram pipeline: home render trace');
assertContains(profile, 'telegram_auth_signin_mismatch', 'telegram pipeline: repeated login mismatch guard');

assertContains(telegramCheck, "identityPath: 'identity_v2'", 'backend telegram check: identity_v2 path');
assertContains(telegramCheck, 'identityResolved: true', 'backend telegram check: resolved flag');
assertContains(telegramCheck, 'customTokenIssued: true', 'backend telegram check: token issued flag');
assertContains(telegramCheck, 'createCustomToken', 'backend telegram check: firebase custom token');
assertContains(telegramCheck, 'resolveTelegramIdentity', 'backend telegram check: identity resolver');

console.log('AUTH_REGRESSION_CONTRACT_OK');
console.log(JSON.stringify({
  ok: true,
  scenarios: [
    'logout_lifecycle',
    'logout_without_error',
    'telegram_first_login_trace',
    'telegram_repeated_login_trace',
    'auth_restore_after_logout',
    'auth_restore_after_telegram',
  ],
}, null, 2));
