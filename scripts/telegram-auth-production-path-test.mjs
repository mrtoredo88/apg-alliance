import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolve } from 'node:path';
import { compareSessionIds } from '../server/src/routes/telegram-auth-check.js';

const read = file => fs.readFileSync(resolve(file), 'utf8');
const start = read('server/src/routes/telegram-auth-start.js');
const check = read('server/src/routes/telegram-auth-check.js');
const updates = read('server/src/lib/telegramUpdates.js');
const deployment = read('.ai/13_DEPLOYMENT.md');

assert.match(start, /requestId,[\s\S]*loginSessionId: loginSessionId \|\| null,[\s\S]*telegramSessionId: state,[\s\S]*state,/, 'auth-start persists and returns correlation ids');
assert.match(updates, /authMatch[\s\S]*telegram_auth_update_received[\s\S]*status:\s*'done'/, 'auth update reaches done');
assert.match(updates, /await ref\.update\(\{[\s\S]*status:\s*'done'[\s\S]*completedAt:[\s\S]*Promise\.resolve\(\)[\s\S]*tgGetPhotoUrl/, 'done is persisted before optional avatar fetch');
assert.match(updates, /AbortSignal\.timeout\(TELEGRAM_FETCH_TIMEOUT_MS\)/, 'Telegram API calls have a bounded timeout');
assert.match(updates, /telegram_poll_fetch_failed[\s\S]*errorCode[\s\S]*lastErrorCode/, 'poll failures expose actionable diagnostics');
assert.match(updates, /conflict:\s*res\.error_code === 409/, 'webhook and polling conflict is detected');
assert.match(check, /status:\s*'expired'[\s\S]*stage:\s*'done_expired'/, 'expired sessions return a clear status and diagnostic stage');
assert.match(deployment, /Webhook НЕ устанавливать:[\s\S]*getUpdates возвращает 409/, 'production delivery contract remains polling-only');

const session = { requestId: 'req-1', loginSessionId: 'login-1', telegramSessionId: 'state-1', state: 'state-1' };
assert.deepEqual(compareSessionIds(session, session), [], 'matching auth-check correlation succeeds');
assert.deepEqual(compareSessionIds({ state: 'state-1' }, session), [], 'reload may restore by state without inventing mismatches');
assert.equal(compareSessionIds({ ...session, requestId: 'req-other' }, session)[0]?.key, 'requestId', 'explicit requestId mismatch is intentional');

console.log('telegram-auth-production-path PASS');
