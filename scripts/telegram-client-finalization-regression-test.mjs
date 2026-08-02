import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/ProfilePanel.jsx', import.meta.url), 'utf8');
const doneStart = source.indexOf("if (data.status === 'done')");
const authenticateAt = source.indexOf('await apgIdentity.authenticate({', doneStart);
const readyAt = source.indexOf("window.dispatchEvent(new CustomEvent('apg:auth_session_ready'", authenticateAt);
const finishAt = source.indexOf('finishAttempt();', readyAt);
const donePrefix = source.slice(doneStart, authenticateAt);

assert.ok(doneStart >= 0 && authenticateAt > doneStart, 'Telegram done flow must authenticate the client');
assert.doesNotMatch(donePrefix, /localStorage\.removeItem\('apg_tg_pending'\)/, 'pending session must survive until client authentication succeeds');
assert.doesNotMatch(donePrefix, /tgStateRef\.current = null/, 'active session must remain retryable during client authentication');
assert.ok(readyAt > authenticateAt, 'ready event must be emitted after authentication');
assert.ok(finishAt > readyAt, 'pending session must be finalized only after ready event');
assert.match(source, /if \(!data\.token\) throw new Error\('telegram_custom_token_missing'\)/, 'missing token must retry the same completed session');

console.log('Telegram client finalization regression: completed server session remains retryable until client login succeeds');
