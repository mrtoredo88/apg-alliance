import { randomUUID } from 'node:crypto';
import { mapProfile, parseJson, safeString } from './AccountRepositoryUtils.js';

function integer(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function mapOperation(row) {
  if (!row) return null;
  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    userId: row.user_id,
    type: row.type,
    reason: row.reason,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceLabel: row.source_label,
    delta: integer(row.delta),
    balanceAfter: integer(row.balance_after),
    status: row.status,
    metadata: parseJson(row.metadata, {}),
    createdAt: row.created_at,
  };
}

export class EconomyRepository {
  constructor(adapter) {
    this.adapter = adapter;
    this.name = 'EconomyRepository';
  }

  async awardVisit({
    userId,
    subjectType,
    subjectId,
    subjectLabel = '',
    idempotencyKey,
    requestedKeys = 0,
    reputation = 0,
    dateKey = '',
    scanDate = '',
  } = {}) {
    const cleanUserId = safeString(userId, 260);
    const cleanSubjectType = subjectType === 'expert' ? 'expert' : 'partner';
    const cleanSubjectId = safeString(subjectId, 260);
    const cleanIdempotencyKey = safeString(idempotencyKey, 500);
    if (!cleanUserId || !cleanSubjectId || !cleanIdempotencyKey) {
      throw Object.assign(new Error('Economy visit identifiers are required.'), { code: 'ECONOMY_BAD_REQUEST' });
    }

    return this.adapter.transaction(async client => {
      const previousResult = await client.query(
        'SELECT * FROM apg_economy_operations WHERE idempotency_key = $1 LIMIT 1',
        [cleanIdempotencyKey],
      );
      if (previousResult.rows[0]) {
        return { operation: mapOperation(previousResult.rows[0]), replayed: true, alreadyAwarded: integer(previousResult.rows[0].delta) === 0 };
      }

      const profileResult = await client.query(
        'SELECT * FROM apg_account_profiles WHERE user_id = $1 FOR UPDATE',
        [cleanUserId],
      );
      const row = profileResult.rows[0];
      if (!row) throw Object.assign(new Error('Пользователь не найден'), { code: 'USER_NOT_FOUND' });

      const profile = mapProfile(row);
      const previousReward = await client.query(
        `SELECT operation_id FROM apg_economy_visit_rewards
         WHERE user_id = $1 AND subject_type = $2 AND subject_id = $3 LIMIT 1`,
        [cleanUserId, cleanSubjectType, cleanSubjectId],
      );
      const legacyScans = cleanSubjectType === 'expert' ? profile.scannedExperts : profile.scannedPartners;
      const alreadyAwarded = Boolean(previousReward.rows[0])
        || (cleanSubjectType === 'expert'
          ? integer(legacyScans?.[cleanSubjectId]) > 0
          : Boolean(legacyScans?.[cleanSubjectId]));
      const delta = alreadyAwarded ? 0 : Math.max(0, integer(requestedKeys));
      const balanceBefore = Math.max(0, integer(profile.keys));
      const balanceAfter = balanceBefore + delta;
      const previousDates = Array.isArray(profile.scanDates) ? profile.scanDates.map(String) : [];
      const alreadyToday = dateKey && profile.lastScanDate === dateKey;
      const yesterday = dateKey ? new Date(`${dateKey}T12:00:00Z`) : null;
      if (yesterday) yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayKey = yesterday?.toISOString().slice(0, 10) || '';
      const streak = alreadyToday
        ? Math.max(0, integer(profile.streak))
        : profile.lastScanDate === yesterdayKey
          ? Math.max(0, integer(profile.streak)) + 1
          : 1;
      const nextDates = scanDate && !previousDates.includes(scanDate)
        ? [...previousDates.slice(-89), scanDate]
        : previousDates;
      const visitCounts = { ...(profile.visitCounts || {}) };
      visitCounts[cleanSubjectId] = Math.max(0, integer(visitCounts[cleanSubjectId])) + 1;
      const scannedField = cleanSubjectType === 'expert' ? 'scannedExperts' : 'scannedPartners';
      const scanned = { ...(profile[scannedField] || {}) };
      scanned[cleanSubjectId] = cleanSubjectType === 'expert'
        ? Math.max(0, integer(scanned[cleanSubjectId])) + 1
        : true;
      const nextProfile = {
        ...profile,
        keys: balanceAfter,
        reputation: Math.max(0, integer(profile.reputation)) + (alreadyAwarded ? 0 : Math.max(0, integer(reputation))),
        lastScanDate: dateKey || profile.lastScanDate || '',
        streak,
        scanDates: nextDates,
        visitCounts,
        [scannedField]: scanned,
      };

      await client.query(
        `UPDATE apg_account_profiles
         SET profile = $2::jsonb, updated_at = now()
         WHERE user_id = $1`,
        [cleanUserId, JSON.stringify(nextProfile)],
      );

      const operationId = randomUUID();
      const operationResult = await client.query(
        `INSERT INTO apg_economy_operations
          (id, idempotency_key, user_id, type, reason, source_type, source_id, source_label, delta, balance_after, status, metadata)
         VALUES ($1, $2, $3, 'visit_reward', $4, $5, $6, $7, $8, $9, 'completed', $10::jsonb)
         RETURNING *`,
        [
          operationId,
          cleanIdempotencyKey,
          cleanUserId,
          alreadyAwarded ? 'Повторный визит без повторного начисления' : 'Награда за визит',
          cleanSubjectType,
          cleanSubjectId,
          safeString(subjectLabel, 220),
          delta,
          balanceAfter,
          JSON.stringify({ alreadyAwarded, visitCount: visitCounts[cleanSubjectId] }),
        ],
      );
      if (!alreadyAwarded) {
        await client.query(
          `INSERT INTO apg_economy_visit_rewards (user_id, subject_type, subject_id, operation_id)
           VALUES ($1, $2, $3, $4)`,
          [cleanUserId, cleanSubjectType, cleanSubjectId, operationId],
        );
      }
      return { operation: mapOperation(operationResult.rows[0]), replayed: false, alreadyAwarded, streak, scanDates: nextDates, visitCount: visitCounts[cleanSubjectId] };
    });
  }

  async awardDailyBonus({ userId, dateKey, keys = 1 } = {}) {
    const cleanUserId = safeString(userId, 260);
    const cleanDateKey = safeString(dateKey, 20);
    const delta = Math.max(0, integer(keys, 1));
    if (!cleanUserId || !cleanDateKey) {
      throw Object.assign(new Error('Daily bonus identifiers are required.'), { code: 'ECONOMY_BAD_REQUEST' });
    }
    return this.adapter.transaction(async client => {
      const profileResult = await client.query(
        `WITH requested AS (
           SELECT COALESCE(
             (SELECT canonical_user_id FROM apg_identity_users WHERE id = $1 LIMIT 1),
             $1
           ) AS canonical_id
         )
         SELECT *
         FROM apg_account_profiles, requested
         WHERE user_id = requested.canonical_id OR canonical_user_id = requested.canonical_id
         ORDER BY (user_id = canonical_user_id) DESC, (user_id = requested.canonical_id) DESC, updated_at DESC
         LIMIT 1 FOR UPDATE`,
        [cleanUserId],
      );
      const row = profileResult.rows[0];
      if (!row) throw Object.assign(new Error('Пользователь не найден'), { code: 'USER_NOT_FOUND' });
      const resolvedUserId = row.user_id;
      const idempotencyKey = `daily_bonus:${resolvedUserId}:${cleanDateKey}`;
      const previous = await client.query(
        `SELECT * FROM apg_economy_operations
         WHERE idempotency_key = $1 OR (
           type = 'daily_bonus' AND source_id = $2 AND user_id IN (
             SELECT $3
             UNION SELECT id FROM apg_identity_users WHERE canonical_user_id = $3
           )
         )
         ORDER BY created_at ASC LIMIT 1`,
        [idempotencyKey, cleanDateKey, resolvedUserId],
      );
      if (previous.rows[0]) {
        const operation = mapOperation(previous.rows[0]);
        let currentBalance = integer(row.profile?.keys, operation.balanceAfter);
        const latestOperation = await client.query(
          `SELECT balance_after FROM apg_economy_operations
           WHERE user_id = $1 AND status = 'completed'
           ORDER BY created_at DESC
           LIMIT 1`,
          [resolvedUserId],
        );
        const ledgerBalance = integer(latestOperation.rows[0]?.balance_after, currentBalance);
        const balanceReconciled = currentBalance !== ledgerBalance;
        if (balanceReconciled) {
          currentBalance = ledgerBalance;
          const repairedProfile = {
            ...(row.profile || {}),
            keys: currentBalance,
            lastBonusDate: cleanDateKey,
          };
          await client.query(
            'UPDATE apg_account_profiles SET profile = $2::jsonb, updated_at = now() WHERE user_id = $1',
            [resolvedUserId, JSON.stringify(repairedProfile)],
          );
        }
        return {
          operation: { ...operation, balanceAfter: currentBalance },
          replayed: true,
          repaired: balanceReconciled,
        };
      }

      const profile = mapProfile(row);
      const balanceAfter = Math.max(0, integer(profile.keys)) + delta;
      const nextProfile = { ...profile, keys: balanceAfter, lastBonusDate: cleanDateKey };
      await client.query(
        'UPDATE apg_account_profiles SET profile = $2::jsonb, updated_at = now() WHERE user_id = $1',
        [resolvedUserId, JSON.stringify(nextProfile)],
      );
      const operationId = randomUUID();
      const inserted = await client.query(
        `INSERT INTO apg_economy_operations
          (id, idempotency_key, user_id, type, reason, source_type, source_id, source_label, delta, balance_after, status, metadata)
         VALUES ($1, $2, $3, 'daily_bonus', 'Ежедневный бонус', 'system', $4, 'АПГ', $5, $6, 'completed', $7::jsonb)
         RETURNING *`,
        [operationId, idempotencyKey, resolvedUserId, cleanDateKey, delta, balanceAfter, JSON.stringify({ dateKey: cleanDateKey })],
      );
      return { operation: mapOperation(inserted.rows[0]), replayed: false };
    });
  }

  async awardAction({
    userId,
    actionType,
    sourceType = 'system',
    sourceId = '',
    sourceLabel = 'АПГ',
    idempotencyKey,
    keys = 0,
    reputation = 0,
    reason = 'Награда за действие',
    metadata = {},
  } = {}) {
    const cleanUserId = safeString(userId, 260);
    const cleanActionType = safeString(actionType, 80);
    const cleanIdempotencyKey = safeString(idempotencyKey, 500);
    const delta = Math.max(0, integer(keys));
    const reputationDelta = Math.max(0, integer(reputation));
    if (!cleanUserId || !cleanActionType || !cleanIdempotencyKey) {
      throw Object.assign(new Error('Economy action identifiers are required.'), { code: 'ECONOMY_BAD_REQUEST' });
    }

    return this.adapter.transaction(async client => {
      const previous = await client.query(
        'SELECT * FROM apg_economy_operations WHERE idempotency_key = $1 LIMIT 1',
        [cleanIdempotencyKey],
      );
      if (previous.rows[0]) return { operation: mapOperation(previous.rows[0]), replayed: true };

      const profileResult = await client.query(
        `WITH requested AS (
           SELECT COALESCE(
             (SELECT canonical_user_id FROM apg_identity_users WHERE id = $1 LIMIT 1),
             $1
           ) AS canonical_id
         )
         SELECT *
         FROM apg_account_profiles, requested
         WHERE user_id = requested.canonical_id OR canonical_user_id = requested.canonical_id
         ORDER BY (user_id = canonical_user_id) DESC, (user_id = requested.canonical_id) DESC, updated_at DESC
         LIMIT 1 FOR UPDATE`,
        [cleanUserId],
      );
      const row = profileResult.rows[0];
      if (!row) throw Object.assign(new Error('Пользователь не найден'), { code: 'USER_NOT_FOUND' });

      const resolvedUserId = row.user_id;
      const profile = mapProfile(row);
      const balanceAfter = Math.max(0, integer(profile.keys)) + delta;
      const nextProfile = {
        ...profile,
        keys: balanceAfter,
        reputation: Math.max(0, integer(profile.reputation)) + reputationDelta,
      };
      await client.query(
        'UPDATE apg_account_profiles SET profile = $2::jsonb, updated_at = now() WHERE user_id = $1',
        [resolvedUserId, JSON.stringify(nextProfile)],
      );
      const operationId = randomUUID();
      const inserted = await client.query(
        `INSERT INTO apg_economy_operations
          (id, idempotency_key, user_id, type, reason, source_type, source_id, source_label, delta, balance_after, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'completed', $11::jsonb)
         RETURNING *`,
        [
          operationId,
          cleanIdempotencyKey,
          resolvedUserId,
          cleanActionType,
          safeString(reason, 500),
          safeString(sourceType, 80),
          safeString(sourceId, 260),
          safeString(sourceLabel, 220),
          delta,
          balanceAfter,
          JSON.stringify({ ...metadata, reputation: reputationDelta }),
        ],
      );
      return { operation: mapOperation(inserted.rows[0]), replayed: false };
    });
  }

  async setBalance({
    userId,
    balance,
    delta,
    reason = 'Корректировка баланса администратором',
    actorId = '',
    idempotencyKey = '',
  } = {}) {
    const cleanUserId = safeString(userId, 260);
    const hasAbsoluteBalance = balance !== undefined && balance !== null;
    const requestedBalance = integer(balance, -1);
    const requestedDelta = integer(delta);
    const cleanIdempotencyKey = safeString(idempotencyKey, 500)
      || `admin_balance:${cleanUserId}:${hasAbsoluteBalance ? requestedBalance : `delta:${requestedDelta}`}:${Date.now()}`;
    if (!cleanUserId || (hasAbsoluteBalance && requestedBalance < 0) || (!hasAbsoluteBalance && requestedDelta === 0)) {
      throw Object.assign(new Error('Valid economy user and balance are required.'), { code: 'ECONOMY_BAD_REQUEST' });
    }

    return this.adapter.transaction(async client => {
      const previous = await client.query(
        'SELECT * FROM apg_economy_operations WHERE idempotency_key = $1 LIMIT 1',
        [cleanIdempotencyKey],
      );
      if (previous.rows[0]) {
        return { operation: mapOperation(previous.rows[0]), replayed: true };
      }

      const profileResult = await client.query(
        `WITH requested AS (
           SELECT COALESCE(
             (SELECT canonical_user_id FROM apg_identity_users WHERE id = $1 LIMIT 1),
             $1
           ) AS canonical_id
         )
         SELECT *
         FROM apg_account_profiles, requested
         WHERE user_id = requested.canonical_id OR canonical_user_id = requested.canonical_id
         ORDER BY (user_id = canonical_user_id) DESC, (user_id = requested.canonical_id) DESC, updated_at DESC
         LIMIT 1 FOR UPDATE`,
        [cleanUserId],
      );
      const row = profileResult.rows[0];
      if (!row) throw Object.assign(new Error('Пользователь не найден'), { code: 'USER_NOT_FOUND' });

      const resolvedUserId = row.user_id;
      const profile = mapProfile(row);
      const balanceBefore = Math.max(0, integer(profile.keys));
      const targetBalance = hasAbsoluteBalance
        ? requestedBalance
        : Math.max(0, balanceBefore + requestedDelta);
      const operationDelta = targetBalance - balanceBefore;
      const nextProfile = { ...profile, keys: targetBalance };
      await client.query(
        'UPDATE apg_account_profiles SET profile = $2::jsonb, updated_at = now() WHERE user_id = $1',
        [resolvedUserId, JSON.stringify(nextProfile)],
      );

      const operationId = randomUUID();
      const operationResult = await client.query(
        `INSERT INTO apg_economy_operations
          (id, idempotency_key, user_id, type, reason, source_type, source_id, source_label, delta, balance_after, status, metadata)
         VALUES ($1, $2, $3, 'admin_adjustment', $4, 'admin', $5, 'Админка АПГ', $6, $7, 'completed', $8::jsonb)
         RETURNING *`,
        [
          operationId,
          cleanIdempotencyKey,
          resolvedUserId,
          safeString(reason, 500),
          safeString(actorId, 260),
          operationDelta,
          targetBalance,
          JSON.stringify({ requestedUserId: cleanUserId, actorId: safeString(actorId, 260) }),
        ],
      );
      return {
        operation: mapOperation(operationResult.rows[0]),
        replayed: false,
        userId: resolvedUserId,
        balanceBefore,
        balanceAfter: targetBalance,
      };
    });
  }

  async history(userId, limit = 100) {
    const cleanUserId = safeString(userId, 260);
    return this.adapter.transaction(async client => {
      const profileResult = await client.query(
        `WITH requested AS (
           SELECT COALESCE(
             (SELECT canonical_user_id FROM apg_identity_users WHERE id = $1 LIMIT 1),
             $1
           ) AS canonical_id
         )
         SELECT *
         FROM apg_account_profiles, requested
         WHERE user_id = requested.canonical_id OR canonical_user_id = requested.canonical_id
         ORDER BY (user_id = canonical_user_id) DESC, (user_id = requested.canonical_id) DESC, updated_at DESC
         LIMIT 1 FOR UPDATE`,
        [cleanUserId],
      );
      const resolvedUserId = profileResult.rows[0]?.user_id || cleanUserId;
      const result = await client.query(
        `SELECT * FROM apg_economy_operations
         WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [resolvedUserId, Math.max(1, Math.min(200, integer(limit, 100)))],
      );
      const latestCompleted = result.rows.find(row => row.status === 'completed');
      const currentProfile = profileResult.rows[0]?.profile || {};
      const currentBalance = integer(currentProfile.keys);
      const ledgerBalance = integer(latestCompleted?.balance_after, currentBalance);
      if (profileResult.rows[0] && currentBalance !== ledgerBalance) {
        await client.query(
          'UPDATE apg_account_profiles SET profile = $2::jsonb, updated_at = now() WHERE user_id = $1',
          [resolvedUserId, JSON.stringify({ ...currentProfile, keys: ledgerBalance })],
        );
      }
      return result.rows.map(mapOperation);
    });
  }
}
