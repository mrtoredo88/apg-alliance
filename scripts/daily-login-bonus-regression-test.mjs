import assert from 'node:assert/strict';
import { EconomyRepository } from '../server/src/apg/account/repositories/EconomyRepository.js';

const state = {
  profile: { user_id: 'canonical-user', canonical_user_id: 'canonical-user', profile: { keys: 54 } },
  operations: [],
};

const client = {
  async query(sql, params = []) {
    if (sql.includes('FROM apg_account_profiles, requested')) return { rows: [state.profile] };
    if (sql.includes("type = 'daily_bonus'") && sql.includes('ORDER BY created_at ASC')) {
      const [idempotencyKey, dateKey, canonicalId] = params;
      const found = state.operations.find(operation => operation.idempotency_key === idempotencyKey
        || (operation.source_id === dateKey && operation.user_id === canonicalId));
      return { rows: found ? [found] : [] };
    }
    if (sql.includes('SELECT balance_after FROM apg_economy_operations')) {
      return { rows: state.operations.length ? [state.operations.at(-1)] : [] };
    }
    if (sql.includes('UPDATE apg_account_profiles')) {
      state.profile.profile = JSON.parse(params[1]);
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO apg_economy_operations')) {
      const operation = {
        id: params[0], idempotency_key: params[1], user_id: params[2],
        type: 'daily_bonus', reason: 'Ежедневный бонус', source_type: 'system',
        source_id: params[3], source_label: 'АПГ', delta: params[4],
        balance_after: params[5], status: 'completed', metadata: JSON.parse(params[6]),
        created_at: new Date().toISOString(),
      };
      state.operations.push(operation);
      return { rows: [operation] };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  },
};

const economy = new EconomyRepository({ transaction: callback => callback(client) });
const first = await economy.awardDailyBonus({ userId: 'canonical-user', dateKey: '2026-08-02', keys: 1 });
assert.equal(first.replayed, false);
assert.equal(state.profile.profile.keys, 55);
assert.equal(state.operations.length, 1);

const repeated = await economy.awardDailyBonus({ userId: 'canonical-user', dateKey: '2026-08-02', keys: 1 });
assert.equal(repeated.replayed, true);
assert.equal(state.profile.profile.keys, 55);
assert.equal(state.operations.length, 1, 'repeated login on the same day must not add another key');

const linkedAlias = await economy.awardDailyBonus({ userId: 'linked-alias', dateKey: '2026-08-02', keys: 1 });
assert.equal(linkedAlias.replayed, true);
assert.equal(state.profile.profile.keys, 55);
assert.equal(state.operations.length, 1, 'linked identity must share the canonical daily idempotency key');

const nextDay = await economy.awardDailyBonus({ userId: 'linked-alias', dateKey: '2026-08-03', keys: 1 });
assert.equal(nextDay.replayed, false);
assert.equal(state.profile.profile.keys, 56);
assert.equal(state.operations.length, 2, 'next Moscow calendar day must add exactly one key');

console.log('Daily login bonus regression: once per canonical user per Moscow day passed');
