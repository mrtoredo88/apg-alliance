import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EconomyRepository } from '../server/src/apg/account/repositories/EconomyRepository.js';

const state = {
  profile: { user_id: 'darya-canonical', canonical_user_id: 'darya-canonical', profile: { keys: 51 } },
  operations: [],
};

const client = {
  async query(sql, params) {
    if (sql.includes('idempotency_key = $1')) {
      return { rows: state.operations.filter(item => item.idempotency_key === params[0]).slice(0, 1) };
    }
    if (sql.includes('FROM apg_account_profiles')) return { rows: [state.profile] };
    if (sql.includes('UPDATE apg_account_profiles')) {
      state.profile.profile = JSON.parse(params[1]);
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO apg_economy_operations')) {
      const row = {
        id: params[0],
        idempotency_key: params[1],
        user_id: params[2],
        type: 'admin_adjustment',
        reason: params[3],
        source_type: 'admin',
        source_id: params[4],
        source_label: 'Админка АПГ',
        delta: params[5],
        balance_after: params[6],
        status: 'completed',
        metadata: JSON.parse(params[7]),
        created_at: new Date().toISOString(),
      };
      state.operations.push(row);
      return { rows: [row] };
    }
    throw new Error(`Unexpected SQL in balance regression: ${sql}`);
  },
};

const economy = new EconomyRepository({ transaction: callback => callback(client) });
const corrected = await economy.setBalance({
  userId: 'darya-canonical',
  balance: 75,
  actorId: 'owner',
  reason: 'Подтверждённая корректировка',
  idempotencyKey: 'darya-balance-75',
});
assert.equal(corrected.balanceBefore, 51);
assert.equal(corrected.balanceAfter, 75);
assert.equal(corrected.operation.delta, 24);
assert.equal(state.profile.profile.keys, 75);
assert.equal(state.operations.length, 1);

const replay = await economy.setBalance({
  userId: 'darya-canonical',
  balance: 75,
  actorId: 'owner',
  reason: 'Подтверждённая корректировка',
  idempotencyKey: 'darya-balance-75',
});
assert.equal(replay.replayed, true);
assert.equal(state.operations.length, 1, 'retry must not create a second balance operation');

const adminActions = fs.readFileSync(new URL('../server/src/routes/admin-actions.js', import.meta.url), 'utf8');
const adminPanel = fs.readFileSync(new URL('../src/AdminPanel.jsx', import.meta.url), 'utf8');
const userActions = fs.readFileSync(new URL('../server/src/routes/user-actions.js', import.meta.url), 'utf8');
const accountSchema = fs.readFileSync(new URL('../server/src/apg/account/schema/account-core.sql', import.meta.url), 'utf8');
assert.match(adminActions, /setEconomyBalance\(\{/);
assert.match(adminActions, /patch\.keys = economyResult\.balanceAfter/);
assert.match(adminActions, /delete increments\.keys/);
assert.match(adminActions, /Изменять баланс ключей может только owner/);
assert.match(adminActions, /keyBalanceMismatch: legacyKeys !== canonicalKeys/);
assert.match(adminActions, /keys: canonicalKeys/);
assert.match(adminActions, /bulk_economy:\$\{actor\.uid\}:\$\{id\}/);
assert.match(adminActions, /balance: patch\.keys/);
assert.match(adminActions, /keys: economy\.balance/);
assert.match(adminPanel, /Показан фактический баланс Account Core/);
assert.match(userActions, /APG_DAILY_LOGIN_BONUS_ENABLED === 'true'/, 'login bonus must be opt-in so session restore cannot change balances');
assert.match(accountSchema, /economy-repair-daily-login-v1:/, 'daily-login repair must be idempotent');
assert.match(accountSchema, /b\.created_at > a\.last_admin_at/, 'repair must preserve balances superseded by later admin adjustments');
assert.match(accountSchema, /'system_repair'/, 'repair must be recorded in the canonical ledger');

console.log('Admin key balance regression: Account Core, ledger, mirror and idempotency passed');
