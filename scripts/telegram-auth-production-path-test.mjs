import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolve } from 'node:path';
import { compareSessionIds, isTransientIdentityDatabaseError } from '../server/src/routes/telegram-auth-check.js';
import { isTransientTelegramProcessingError } from '../server/src/lib/telegramUpdates.js';

const read = file => fs.readFileSync(resolve(file), 'utf8');
const start = read('server/src/routes/telegram-auth-start.js');
const check = read('server/src/routes/telegram-auth-check.js');
const updates = read('server/src/lib/telegramUpdates.js');
const webhook = read('server/src/routes/telegram-webhook.js');
const postgresAdapter = read('server/src/apg/infrastructure/adapters/PostgresIdentityAdapter.js');

assert.match(start, /requestId,[\s\S]*loginSessionId: loginSessionId \|\| null,[\s\S]*telegramSessionId: state,[\s\S]*state,/, 'auth-start persists and returns correlation ids');
assert.match(updates, /authMatch[\s\S]*telegram_auth_update_received[\s\S]*status:\s*'done'/, 'auth update reaches done');
assert.match(updates, /await ref\.update\(\{[\s\S]*status:\s*'done'[\s\S]*completedAt:[\s\S]*Promise\.resolve\(\)[\s\S]*tgGetPhotoUrl/, 'done is persisted before optional avatar fetch');
assert.match(updates, /timeoutMs = TELEGRAM_FETCH_TIMEOUT_MS[\s\S]*AbortSignal\.timeout\(timeoutMs\)/, 'Telegram API calls have a bounded timeout');
assert.match(updates, /TELEGRAM_POLL_TIMEOUT_MS = 2500[\s\S]*TELEGRAM_POLL_ATTEMPTS = 1/, 'auth polling stays below the serverless client timeout');
assert.match(updates, /telegram_poll_fetch_failed[\s\S]*errorCode[\s\S]*lastErrorCode/, 'poll failures expose actionable diagnostics');
assert.match(updates, /const POLL_LOCK_MS = 8000;/, 'a stale poll lock recovers within seconds on the warm production instance');
assert.match(updates, /lastCheckpointAt: FieldValue\.serverTimestamp\(\)/, 'each processed Telegram update checkpoints its offset');
assert.match(updates, /throw error;[\s\S]*let failed = 0;/, 'failed sendMessage calls remain visible to the poller');
assert.match(updates, /failed \+= 1;[\s\S]*break;/, 'a failed update is retained instead of advancing the Telegram offset');
assert.match(updates, /TELEGRAM_UPDATE_PROCESS_ATTEMPTS = 3/, 'each Telegram update retries transient database disconnects in the same poll cycle');
assert.match(updates, /processTelegramUpdateWithRetry\(db, update, log\)/, 'poller uses resilient update processing');
assert.match(updates, /conflict:\s*res\.error_code === 409/, 'webhook and polling conflict is detected');
assert.match(postgresAdapter, /client\.on\('error', onClientError\)/, 'checked-out PostgreSQL clients cannot crash the Telegram poller process');
assert.match(postgresAdapter, /client\.removeListener\('error', onClientError\)/, 'transaction client listener is cleaned up before release');
assert.match(postgresAdapter, /APG_IDENTITY_POOL_SIZE \|\| 1/, 'serverless adapters default to one PostgreSQL connection');
assert.match(webhook, /await processTelegramUpdate\(db, payload, request\.log\)/, 'webhook must finish Telegram processing before the serverless request returns');
assert.match(webhook, /x-telegram-bot-api-secret-token/, 'webhook validates the Telegram secret token');
assert.match(check, /status:\s*'expired'[\s\S]*stage:\s*'done_expired'/, 'expired sessions return a clear status and diagnostic stage');
assert.doesNotMatch(check, /ref\.delete\(\)/, 'completed Telegram sessions remain retryable until their original expiry');
assert.match(check, /tokenIssuedAt:[\s\S]*resolvedUserId:/, 'successful token delivery is checkpointed idempotently');
assert.match(check, /short_poll_complete_client_should_retry/, 'auth check returns quickly and lets the client retry');

const session = { requestId: 'req-1', loginSessionId: 'login-1', telegramSessionId: 'state-1', state: 'state-1' };
assert.deepEqual(compareSessionIds(session, session), [], 'matching auth-check correlation succeeds');
assert.deepEqual(compareSessionIds({ state: 'state-1' }, session), [], 'reload may restore by state without inventing mismatches');
assert.equal(compareSessionIds({ ...session, requestId: 'req-other' }, session)[0]?.key, 'requestId', 'explicit requestId mismatch is intentional');
assert.equal(isTransientIdentityDatabaseError({ code: '53300', message: 'too many active clients' }), true, 'Odyssey pool exhaustion is retryable');
assert.equal(isTransientIdentityDatabaseError({ code: '23505', message: 'duplicate key' }), false, 'identity conflicts are not retried as pool failures');
assert.equal(isTransientTelegramProcessingError(new Error('Connection terminated unexpectedly')), true, 'database disconnect is retryable before Telegram offset advances');
assert.equal(isTransientTelegramProcessingError({ code: 'ECONNRESET', message: 'socket reset' }), true, 'socket reset is retryable');
assert.equal(isTransientTelegramProcessingError({ code: '23505', message: 'duplicate key' }), false, 'business conflicts are not blindly retried');
assert.match(check, /telegram_auth_check_identity_retry[\s\S]*continue;/, 'completed Telegram auth retries transient PostgreSQL exhaustion');

console.log('telegram-auth-production-path PASS');
