import fs from 'node:fs';
import assert from 'node:assert/strict';

const health = fs.readFileSync('src/ApgHealthPage.jsx', 'utf8');
const systemStatus = fs.readFileSync('server/src/routes/system-status.js', 'utf8');

assert.match(health, /\['runtime', 'Runtime'\]/, 'APG Health exposes Runtime tab');
assert.match(health, /Frontend version/, 'APG Health renders frontend version');
assert.match(health, /Backend version/, 'APG Health renders backend version');
assert.match(health, /Release parity/, 'APG Health renders release parity');
assert.match(health, /Telegram Auth Runtime/, 'APG Health renders Telegram auth runtime block');
assert.match(health, /Recent Telegram Auth Sessions/, 'APG Health renders recent Telegram auth sessions');
assert.match(health, /\/version\.json\?_=\$\{Date\.now\(\)\}/, 'APG Health reads frontend version.json without cache');
assert.match(health, /\$\{API_BASE_URL\}\/version\?_=\$\{Date\.now\(\)\}/, 'APG Health reads backend runtime version without cache');

assert.match(systemStatus, /runtime:\s*\{[\s\S]*backend:/, 'system-status returns backend runtime details');
assert.match(systemStatus, /telegramAuthDigest/, 'system-status builds Telegram auth digest');
assert.match(systemStatus, /telegramAuthSessions:\s*tgAuthDigest/, 'system-status returns recent Telegram auth sessions');
assert.match(systemStatus, /deliveryMode:\s*'POLLING_PRIMARY'/, 'system-status reports Telegram delivery mode');
assert.match(systemStatus, /lastErrorCode/, 'system-status exposes actionable Telegram polling error code');
assert.match(systemStatus, /pendingSessions/, 'system-status exposes pending Telegram sessions count');
assert.match(systemStatus, /lastAuthFailureReason/, 'system-status exposes latest Telegram auth failure reason');

console.log('apg-health-status regression PASS');
