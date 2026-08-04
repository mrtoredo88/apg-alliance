import assert from 'node:assert/strict';
import { EconomyRepository } from '../server/src/apg/account/repositories/EconomyRepository.js';

const state = {
  profile: {
    user_id: 'canonical-owner',
    canonical_user_id: 'canonical-owner',
    profile: { keys: 37, scannedPartners: { happiness: true }, visitCounts: { happiness: 1 } },
  },
  operations: [{
    id: 'failed-old-rule',
    idempotency_key: 'legacy-visit:linked-owner:partner:happiness',
    user_id: 'canonical-owner',
    type: 'visit_reward',
    source_type: 'partner',
    source_id: 'happiness',
    delta: 0,
    balance_after: 37,
    status: 'completed',
    metadata: {},
    created_at: '2026-08-04T08:00:00.000Z',
  }],
  latestVisitReward: null,
};

const client = {
  async query(sql, params = []) {
    if (sql.includes('FROM apg_account_profiles, requested')) return { rows: [state.profile] };
    if (sql.includes('WHERE idempotency_key = $1 LIMIT 1')) {
      const operation = state.operations.find(item => item.idempotency_key === params[0]);
      return { rows: operation ? [operation] : [] };
    }
    if (sql.includes("type = 'visit_reward'") && sql.includes("metadata->>'dateKey'")) {
      const [userId, subjectType, subjectId, dateKey] = params;
      const operation = state.operations.find(item => item.user_id === userId
        && item.type === 'visit_reward'
        && item.source_type === subjectType
        && item.source_id === subjectId
        && item.delta > 0
        && item.metadata?.dateKey === dateKey);
      return { rows: operation ? [{ id: operation.id }] : [] };
    }
    if (sql.includes('UPDATE apg_account_profiles')) {
      state.profile.profile = JSON.parse(params[1]);
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO apg_economy_operations')) {
      const operation = {
        id: params[0], idempotency_key: params[1], user_id: params[2],
        type: 'visit_reward', reason: params[3], source_type: params[4],
        source_id: params[5], source_label: params[6], delta: params[7],
        balance_after: params[8], status: 'completed', metadata: JSON.parse(params[9]),
        created_at: new Date().toISOString(),
      };
      state.operations.push(operation);
      return { rows: [operation] };
    }
    if (sql.includes('INSERT INTO apg_economy_visit_rewards')) {
      state.latestVisitReward = { userId: params[0], subjectType: params[1], subjectId: params[2], operationId: params[3] };
      return { rows: [] };
    }
    throw new Error(`Unexpected SQL in visit reward regression: ${sql}`);
  },
};

const economy = new EconomyRepository({ transaction: callback => callback(client) });
const first = await economy.awardVisit({
  userId: 'linked-owner', subjectType: 'partner', subjectId: 'happiness', subjectLabel: 'Счастье есть',
  idempotencyKey: 'legacy-visit:linked-owner:partner:happiness:2026-08-04',
  requestedKeys: 2, dateKey: '2026-08-04', scanDate: '2026-08-04',
});
assert.equal(first.operation.userId, 'canonical-owner', 'linked identity must award the canonical account');
assert.equal(first.operation.delta, 2, 'a historic visit or a zero-value failed attempt must not block today reward');
assert.equal(first.operation.balanceAfter, 39);
assert.equal(state.profile.profile.keys, 39);
assert.equal(state.latestVisitReward.userId, 'canonical-owner');

const replay = await economy.awardVisit({
  userId: 'linked-owner', subjectType: 'partner', subjectId: 'happiness', subjectLabel: 'Счастье есть',
  idempotencyKey: 'legacy-visit:linked-owner:partner:happiness:2026-08-04',
  requestedKeys: 2, dateKey: '2026-08-04', scanDate: '2026-08-04',
});
assert.equal(replay.replayed, true);
assert.equal(state.profile.profile.keys, 39, 'same-day retry must not add keys twice');

const nextDay = await economy.awardVisit({
  userId: 'another-linked-owner', subjectType: 'partner', subjectId: 'happiness', subjectLabel: 'Счастье есть',
  idempotencyKey: 'legacy-visit:another-linked-owner:partner:happiness:2026-08-05',
  requestedKeys: 2, dateKey: '2026-08-05', scanDate: '2026-08-05',
});
assert.equal(nextDay.operation.delta, 2);
assert.equal(nextDay.operation.balanceAfter, 41, 'a new Moscow calendar day must award again');

console.log('Visit reward regression: canonical balance, daily replay and next-day award passed');
