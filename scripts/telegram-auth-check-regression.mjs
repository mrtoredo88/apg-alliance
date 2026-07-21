import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolve } from 'node:path';
import { compareSessionIds } from '../server/src/routes/telegram-auth-check.js';

const source = fs.readFileSync(resolve('server/src/routes/telegram-auth-check.js'), 'utf8');

function assertContains(label, token, message) {
  assert.ok(source.includes(token), `${label}: ${message}`);
}

// Contract assertions for compare behavior
assertContains('contract', "const explicitRequestId = safeString(request.query?.requestId, 180);", 'explicit requestId should be read from query/body contract');
assertContains('contract', "const requestId = safeString(explicitRequestId || request.headers['x-request-id'], 180);", 'header request-id should be fallback only');
assertContains('contract', 'const hasExplicitRequestId = typeof query.requestId === \'string\' && query.requestId.trim().length > 0;', 'explicit requestId guard required');
assertContains('contract', 'if (hasExplicitRequestId && normalized.requestId && stored.requestId && normalized.requestId !== stored.requestId) {', 'requestId mismatch must be validated only when explicitly provided');

const baseSession = {
  requestId: 'server_request_id',
  loginSessionId: 'login_123',
  telegramSessionId: 'tg_state_123',
  state: 'tg_state_123',
};

const cases = [
  {
    name: 'normal linking uses application ids only',
    query: {
      requestId: '',
      loginSessionId: 'login_123',
      telegramSessionId: 'tg_state_123',
      state: 'tg_state_123',
    },
    expected: 0,
  },
  {
    name: 'parallel attempt second state',
    query: {
      requestId: '',
      loginSessionId: 'login_456',
      telegramSessionId: 'tg_state_456',
      state: 'tg_state_456',
    },
    expected: 2,
  },
  {
    name: 'stale polling after second attempt by mismatched loginSessionId',
    query: {
      requestId: '',
      loginSessionId: 'login_old',
      telegramSessionId: 'tg_state_123',
      state: 'tg_state_123',
    },
    expected: 1,
  },
  {
    name: 'polling without client requestId',
    query: {
      requestId: '',
      loginSessionId: 'login_123',
      telegramSessionId: 'tg_state_123',
      state: 'tg_state_123',
    },
    expected: 0,
  },
  {
    name: 'polling with explicit requestId matching',
    query: {
      requestId: 'server_request_id',
      loginSessionId: 'login_123',
      telegramSessionId: 'tg_state_123',
      state: 'tg_state_123',
    },
    expected: 0,
  },
  {
    name: 'polling with explicit requestId mismatching',
    query: {
      requestId: 'other_request_id',
      loginSessionId: 'login_123',
      telegramSessionId: 'tg_state_123',
      state: 'tg_state_123',
    },
    expected: 1,
  },
];

const results = [];

for (const item of cases) {
  const mismatches = compareSessionIds(item.query, baseSession);
  assert.equal(mismatches.length, item.expected, `${item.name}: expected ${item.expected} mismatches, got ${mismatches.length}`);
  results.push({
    name: item.name,
    mismatches,
  });
}

// Infrastructure request-id should not affect session validation when client requestId absent
const infraOnly = compareSessionIds({
  requestId: '',
  loginSessionId: 'login_123',
  telegramSessionId: 'tg_state_123',
  state: 'tg_state_123',
}, {
  requestId: 'infra_request_id',
  loginSessionId: 'login_123',
  telegramSessionId: 'tg_state_123',
  state: 'tg_state_123',
});
assert.equal(infraOnly.length, 0, 'infrastructure-generated request-id only should not trigger mismatch');

console.log('TELEGRAM_AUTH_CHECK_REGRESSION_OK');
console.log(JSON.stringify({
  results,
}, null, 2));
