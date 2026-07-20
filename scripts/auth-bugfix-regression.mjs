import fs from 'node:fs';
import assert from 'node:assert/strict';

function read(file) {
  const content = fs.readFileSync(file, 'utf8');
  return content;
}

const userApp = read('src/UserApp.jsx');
const profile = read('src/ProfilePanel.jsx');
const telegramCheck = read('server/src/routes/telegram-auth-check.js');
const serverEmailAuth = read('server/src/routes/email-auth.js');
const telegramAuthStart = read('server/src/routes/telegram-auth-start.js');
const telegramUpdates = read('server/src/lib/telegramUpdates.js');

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
assertContains(userApp, "traceAuthStage('logout_start'", 'logout lifecycle: trace start');
assertContains(userApp, "traceAuthStage('logout_clicked'", 'logout lifecycle: clicked');
assertContains(userApp, "traceAuthStage('logout_started'", 'logout lifecycle: started');
assertContains(userApp, "traceAuthStage('identity_cleanup'", 'logout lifecycle: identity cleanup');
assertContains(userApp, "traceAuthStage('firebase_signout_done'", 'logout lifecycle: signout complete');
assertContains(userApp, "traceAuthStage('firebase_signout'", 'logout lifecycle: signout request');
assertContains(userApp, "traceAuthStage('store_reset'", 'logout lifecycle: store reset');
assertContains(userApp, "traceAuthStage('user_state_cleared'", 'logout lifecycle: user state cleared');
assertContains(userApp, "traceAuthStage('guest_bootstrap'", 'logout lifecycle: guest bootstrap');
assertContains(userApp, "traceAuthStage('logout_complete'", 'logout lifecycle: logout complete');
assertContains(userApp, "traceAuthStage('logout_error'", 'logout lifecycle: error branch traced');
assertContains(userApp, 'localStorage.setItem(\'manualLogout\', \'true\');', 'logout lifecycle: manual logout marker');
assertContains(userApp, "traceAuthStage('guest_render'", 'logout lifecycle: guest render trace');
assertContains(userApp, "traceAuthStage('guest_state_entered'", 'logout lifecycle: guest state entered trace');
assertContains(userApp, "traceAuthStage('user_state_cleared'", 'logout lifecycle: user state cleared trace');
assertContains(userApp, 'traceAuthStage(\'loadData_aborted\'', 'logout lifecycle: loadData abort during logout flow');
assertContains(userApp, 'isAuthLoadAborted', 'logout lifecycle: runtime abort helper');
assertNo(userApp, "setError('Не удалось выйти. Проверьте подключение и попробуйте ещё раз.'", 'logout lifecycle: no hard error message');
assertContains(userApp, "traceAuthStage('auth_session_restart'", 'logout restart trace');
assertContains(userApp, 'waitForInitialFirebaseAuth(4500)', 'email restore: extended restore wait for strong identities');
assertContains(userApp, 'loadData_strong_identity_required', 'strong identity mismatch handled via guest-state fallback');
assertNo(userApp, 'window.location.reload();', 'email bootstrap path does not force full-page reload');

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
assertContains(profile, "identity_conflict", 'email link flow: identity conflict branch handled');

assertContains(telegramCheck, "identityPath: 'identity_v2'", 'backend telegram check: identity_v2 path');
assertContains(telegramCheck, 'identityResolved: true', 'backend telegram check: resolved flag');
assertContains(telegramCheck, 'customTokenIssued: true', 'backend telegram check: token issued flag');
assertContains(telegramCheck, 'createCustomToken', 'backend telegram check: firebase custom token');
assertContains(telegramCheck, 'resolveTelegramIdentity', 'backend telegram check: identity resolver');
assertContains(serverEmailAuth, "error: 'identity_conflict'", 'email link flow: explicit conflict code is returned');
assertContains(serverEmailAuth, "code: 'IDENTITY_CONFLICT'", 'email link flow: backend exports conflict classification');
assertContains(serverEmailAuth, 'async function resolveActorFromIdentity', 'email link flow: actor resolved through identity-aware helper');
assertContains(serverEmailAuth, 'identity_v2_user', 'email link flow: actor source includes identity_v2_user');
assertContains(serverEmailAuth, "if (action === 'link-email')", 'email link flow: link-email action exists');
assertContains(serverEmailAuth, "if (action === 'link-telegram')", 'email link flow: link-telegram action exists');
assertContains(profile, "action: 'link-telegram', userId: String(user.id)", 'profile: link telegram uses current user id');
assertContains(profile, "action: 'link-email', email: linkEmailValue, userId: String(user.id)", 'profile: link email uses current user id');

assertContains(telegramAuthStart, "const ownerUserId = safeString(body.ownerUserId", 'telegram auth start: ownerUserId from client is passed');
assertContains(telegramUpdates, 'resolveTelegramLinkOwner', 'telegram updates: owner resolver exists');
assertContains(telegramUpdates, "await serverFoundation.identityV2.getUser(rawOwnerUserId)", 'telegram updates: owner checks identity store first');
assertContains(telegramUpdates, "linkError = \'owner_not_found\'", 'telegram updates: owner missing handled as owner_not_found');

console.log('AUTH_REGRESSION_CONTRACT_OK');
console.log(JSON.stringify({
  ok: true,
  scenarios: [
    'logout_lifecycle',
    'logout_without_error',
    'telegram_first_login_trace',
    'telegram_repeated_login_trace',
    'guest_after_logout_without_reload',
    'auth_restore_after_logout',
    'auth_restore_after_telegram',
  ],
}, null, 2));
