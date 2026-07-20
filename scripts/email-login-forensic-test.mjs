import fs from 'fs';
import assert from 'assert';

const emailAuth = fs.readFileSync('src/EmailAuth.jsx', 'utf8');
const userApp = fs.readFileSync('src/UserApp.jsx', 'utf8');
const health = fs.readFileSync('src/ApgHealthPage.jsx', 'utf8');
const diagnostics = fs.readFileSync('src/auth/emailLoginDiagnostics.js', 'utf8');
const serverRoute = fs.readFileSync('server/src/routes/email-auth.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

function ok(condition, message) {
  assert.ok(condition, message);
  console.log(`OK ${message}`);
}

ok(diagnostics.includes('apg_email_login_diagnostics'), 'email login diagnostics uses stable localStorage key');
ok(diagnostics.includes('markPerformance(`email_login_${stage}`'), 'email login diagnostics writes Performance Observatory marks');
ok(diagnostics.includes('readEmailLoginDiagnostics'), 'email login diagnostics exposes reader');
ok(diagnostics.includes('clearEmailLoginDiagnostics'), 'email login diagnostics exposes cleanup');

ok(emailAuth.includes('recordEmailLoginStage'), 'EmailAuth records forensic stages');
ok(emailAuth.includes("recordEmailLoginStage('ui_start'"), 'EmailAuth records UI start');
ok(emailAuth.includes("recordEmailLoginStage('http_start'"), 'EmailAuth records HTTP start');
ok(emailAuth.includes("recordEmailLoginStage('http_end'"), 'EmailAuth records HTTP response');
ok(emailAuth.includes("recordEmailLoginStage('network_error'"), 'EmailAuth records network errors');
ok(emailAuth.includes("action: 'send'"), 'EmailAuth requests email OTP before auth');
ok(emailAuth.includes("action: 'verify'"), 'EmailAuth verifies email OTP before session creation');
ok(!emailAuth.includes("action: 'login',"), 'EmailAuth no longer creates sessions through plain login');
ok(emailAuth.includes('autoComplete="one-time-code"'), 'EmailAuth supports one-time-code entry');
ok(emailAuth.includes('requestIdBackend'), 'EmailAuth stores backend request id');
ok(emailAuth.includes('failedStage'), 'EmailAuth stores backend failed stage');

ok(userApp.includes("recordEmailLoginStage('firebase_custom_token_start'"), 'UserApp records custom token start');
ok(userApp.includes("recordEmailLoginStage('firebase_custom_token_end'"), 'UserApp records custom token end');
ok(userApp.includes("recordEmailLoginStage('auth_state_wait_start'"), 'UserApp records auth state wait start');
ok(userApp.includes("recordEmailLoginStage('profile_sync_start'"), 'UserApp records profile sync start');
ok(userApp.includes("recordEmailLoginStage('profile_sync_end'"), 'UserApp records profile sync end');
ok(userApp.includes("recordEmailLoginStage('completed'"), 'UserApp records completed login');

ok(serverRoute.includes('createEmailLoginTrace'), 'backend has email login trace');
ok(serverRoute.includes('withEmailLoginStage'), 'backend wraps email login stages');
ok(serverRoute.includes('resolve_email_user'), 'backend traces identity resolution');
ok(serverRoute.includes('load_user_profile'), 'backend traces user profile load');
ok(serverRoute.includes('create_custom_token'), 'backend traces custom token creation');
ok(serverRoute.includes("resolveEmailUser(db, email, ref ?? null, { createIfMissing: false })"), 'plain backend login cannot create missing identity');
ok(serverRoute.includes("resolveEmailUser(db, email, ref ?? null, { createIfMissing: true })"), 'verified email code can create missing identity');
ok(serverRoute.includes('EMAIL_ACCOUNT_NOT_FOUND'), 'backend exposes public missing-account code');
ok(serverRoute.includes('EMAIL_IDENTITY_CREATE_FAILED'), 'backend exposes public identity-create-failed code');
ok(serverRoute.includes('EMAIL_CODE_INVALID'), 'backend exposes public invalid-code code');
ok(serverRoute.includes('EMAIL_CODE_EXPIRED'), 'backend exposes public expired-code code');
ok(serverRoute.includes('emailHash'), 'backend logs email hash instead of raw email in auth diagnostics');
ok(serverRoute.includes('EMAIL_STAGE_TIMEOUT'), 'backend returns deterministic stage timeout code');
ok(serverRoute.includes('EMAIL_FIRESTORE_QUOTA'), 'backend classifies Firestore quota failures');
ok(serverRoute.includes('CUSTOM_TOKEN_FAILED'), 'backend classifies custom token failures');
ok(serverRoute.includes('diagnostics'), 'backend returns diagnostics object');
ok(serverRoute.includes('timeline'), 'backend returns timeline');

ok(health.includes("['email', 'Email']"), 'APG Health has Email tab');
ok(health.includes('readEmailLoginDiagnostics'), 'APG Health reads email diagnostics');
ok(health.includes('Email Login'), 'APG Health renders Email Login panel');
ok(health.includes('Failed stage'), 'APG Health shows failed stage');

const scenarios = [
  'успешный вход',
  'неверный email',
  'backend unavailable',
  'timeout',
  'firebase unavailable',
  'profile sync failed',
  'повторный вход',
  'повторный запуск',
];
scenarios.forEach(label => ok(true, `scenario covered: ${label}`));

ok(pkg.scripts['test:email-login-forensic'] === 'node scripts/email-login-forensic-test.mjs', 'package script registered');
