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
    const idempotencyKey = `daily_bonus:${cleanUserId}:${cleanDateKey}`;
    if (!cleanUserId || !cleanDateKey) {
      throw Object.assign(new Error('Daily bonus identifiers are required.'), { code: 'ECONOMY_BAD_REQUEST' });
    }
    return this.adapter.transaction(async client => {
      const previous = await client.query(
        'SELECT * FROM apg_economy_operations WHERE idempotency_key = $1 LIMIT 1',
        [idempotencyKey],
      );
      if (previous.rows[0]) {
        const currentProfile = await client.query(
          'SELECT profile FROM apg_account_profiles WHERE user_id = $1 LIMIT 1',
          [cleanUserId],
        );
        const operation = mapOperation(previous.rows[0]);
        const currentBalance = integer(currentProfile.rows[0]?.profile?.keys, operation.balanceAfter);
        return {
          operation: { ...operation, balanceAfter: currentBalance },
          replayed: true,
        };
      }

      const profileResult = await client.query(
        'SELECT * FROM apg_account_profiles WHERE user_id = $1 FOR UPDATE',
        [cleanUserId],
      );
      const row = profileResult.rows[0];
      if (!row) throw Object.assign(new Error('Пользователь не найден'), { code: 'USER_NOT_FOUND' });
      const profile = mapProfile(row);
      const balanceAfter = Math.max(0, integer(profile.keys)) + delta;
      const nextProfile = { ...profile, keys: balanceAfter, lastBonusDate: cleanDateKey };
      await client.query(
        'UPDATE apg_account_profiles SET profile = $2::jsonb, updated_at = now() WHERE user_id = $1',
        [cleanUserId, JSON.stringify(nextProfile)],
      );
      const operationId = randomUUID();
      const inserted = await client.query(
        `INSERT INTO apg_economy_operations
          (id, idempotency_key, user_id, type, reason, source_type, source_id, source_label, delta, balance_after, status, metadata)
         VALUES ($1, $2, $3, 'daily_bonus', 'Ежедневный бонус', 'system', $4, 'АПГ', $5, $6, 'completed', $7::jsonb)
         RETURNING *`,
        [operationId, idempotencyKey, cleanUserId, cleanDateKey, delta, balanceAfter, JSON.stringify({ dateKey: cleanDateKey })],
      );
      return { operation: mapOperation(inserted.rows[0]), replayed: false };
    });
  }

  async history(userId, limit = 100) {
    const cleanUserId = safeString(userId, 260);
    const result = await this.adapter.query(
      `SELECT * FROM apg_economy_operations
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [cleanUserId, Math.max(1, Math.min(200, integer(limit, 100)))],
    );
    return result.rows.map(mapOperation);
  }
}
