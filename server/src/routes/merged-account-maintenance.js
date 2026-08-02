import { createHash } from 'node:crypto';
import { getDb } from '../lib/documentStore.js';
import { previewMergedAccountCleanup, purgeMergedAccount } from '../lib/mergedAccountCleanup.js';
import { serverFoundation } from '../apg/index.js';

const hash = value => createHash('sha256').update(String(value || '')).digest('hex').slice(0, 12);

export default async function mergedAccountMaintenanceRoutes(fastify) {
  fastify.get('/api/maintenance/economy-daily-bonus-impact', async (request, reply) => {
    const secret = String(request.headers['x-cron-secret'] || '');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return reply.code(403).send({ ok: false, error: 'Forbidden' });
    }
    const adapter = serverFoundation.data.adapter?.adapter;
    if (!adapter?.query) return reply.code(503).send({ ok: false, error: 'Postgres unavailable' });
    const result = await adapter.query(`
      WITH last_admin AS (
        SELECT user_id, max(created_at) AS last_admin_at
        FROM apg_economy_operations
        WHERE status = 'completed' AND type = 'admin_adjustment'
        GROUP BY user_id
      ), bonuses AS (
        SELECT b.*, a.last_admin_at,
          (a.last_admin_at IS NULL OR b.created_at > a.last_admin_at) AS reversible
        FROM apg_economy_operations b
        LEFT JOIN last_admin a ON a.user_id = b.user_id
        WHERE b.status = 'completed' AND b.type = 'daily_bonus'
      ), refundable AS (
        SELECT user_id, sum(delta)::integer AS refundable_keys
        FROM bonuses WHERE reversible GROUP BY user_id
      )
      SELECT
        count(*)::integer AS operations,
        count(DISTINCT user_id)::integer AS affected_users,
        count(*) FILTER (WHERE created_at >= now() - interval '7 days')::integer AS operations_7d,
        count(DISTINCT user_id) FILTER (WHERE created_at >= now() - interval '7 days')::integer AS affected_users_7d,
        count(*) FILTER (WHERE reversible)::integer AS reversible_operations,
        count(DISTINCT user_id) FILTER (WHERE reversible)::integer AS reversible_users,
        count(DISTINCT user_id) FILTER (WHERE last_admin_at IS NOT NULL)::integer AS users_with_admin_adjustment,
        COALESCE((SELECT sum(refundable_keys)::integer FROM refundable), 0) AS refundable_keys,
        (SELECT count(*)::integer FROM apg_economy_operations
          WHERE idempotency_key LIKE 'restore-valid-daily-login-v1:%') AS restored_users,
        (SELECT max(CASE WHEN COALESCE(p.profile->>'keys', '') ~ '^[0-9]+$'
          THEN (p.profile->>'keys')::integer ELSE NULL END)
          FROM apg_account_profiles p
          WHERE lower(COALESCE(p.email, p.profile->>'email', p.profile->>'linkedEmail', '')) = 'mrtoredo88@mail.ru'
            OR p.user_id IN (SELECT canonical_user_id FROM apg_identity_email_index WHERE lower(email) = 'mrtoredo88@mail.ru')) AS verified_owner_balance,
        min(created_at) AS first_operation_at,
        max(created_at) AS last_operation_at
      FROM bonuses
    `);
    return reply.send({ ok: true, ...result.rows[0] });
  });

  fastify.post('/api/maintenance/merged-account-preview', async (request, reply) => {
    const secret = String(request.headers['x-cron-secret'] || request.body?.secret || '');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return reply.code(403).send({ ok: false, error: 'Forbidden' });
    }
    const users = await getDb().collection('users').limit(10000).get();
    const candidates = users.docs
      .map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter(user => user.archived === true && (user.mergedInto || user.dataMigratedInto) && ['merged', 'legacy_linked'].includes(String(user.accountStatus || user.identityStatus || '').toLowerCase()));
    const previews = [];
    const errors = [];
    for (const user of candidates) {
      try {
        previews.push((await previewMergedAccountCleanup([user.id]))[0]);
      } catch (error) {
        errors.push({ sourceHash: hash(user.id), targetHash: hash(user.mergedInto || user.dataMigratedInto), code: String(error?.code || 'PREVIEW_FAILED') });
      }
    }
    return reply.send({
      ok: true,
      productionWrites: 0,
      candidates: previews.length,
      safe: previews.filter(item => item.safeToPurge).length,
      blocked: previews.filter(item => !item.safeToPurge).length + errors.length,
      movableReferences: previews.reduce((sum, item) => sum + item.movableReferences.length, 0),
      historicalReferences: previews.reduce((sum, item) => sum + item.historicalReferences.length, 0),
      nestedDocuments: previews.reduce((sum, item) => sum + item.nested.length, 0),
      nestedConflicts: previews.reduce((sum, item) => sum + item.nestedConflicts.length, 0),
      errors,
      rows: previews.map(item => ({ sourceHash: hash(item.sourceId), targetHash: hash(item.targetId), safe: item.safeToPurge, movableReferences: item.movableReferences.length, historicalReferences: item.historicalReferences.length, nestedDocuments: item.nested.length, nestedConflicts: item.nestedConflicts.length })),
    });
  });

  fastify.post('/api/maintenance/merged-account-purge', async (request, reply) => {
    const secret = String(request.headers['x-cron-secret'] || request.body?.secret || '');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return reply.code(403).send({ ok: false, error: 'Forbidden' });
    if (request.body?.confirm !== 'PURGE_ALL_MERGED_ACCOUNTS_WITH_SNAPSHOTS') return reply.code(400).send({ ok: false, error: 'Explicit confirmation required' });
    const reason = String(request.body?.reason || '').trim();
    if (reason.length < 3) return reply.code(400).send({ ok: false, error: 'Reason required' });
    const users = await getDb().collection('users').limit(10000).get();
    const candidates = users.docs
      .map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter(user => user.archived === true && (user.mergedInto || user.dataMigratedInto) && ['merged', 'legacy_linked'].includes(String(user.accountStatus || user.identityStatus || '').toLowerCase()));
    const previews = [];
    for (const user of candidates) previews.push((await previewMergedAccountCleanup([user.id]))[0]);
    previews.sort((left, right) => (right.chain?.length || 0) - (left.chain?.length || 0));
    const results = [];
    for (const preview of previews) {
      const freshPreview = (await previewMergedAccountCleanup([preview.sourceId]))[0];
      results.push(await purgeMergedAccount({ sourceId: freshPreview.sourceId, stateToken: freshPreview.stateToken, actorId: 'maintenance-approved-owner', reason }));
    }
    return reply.send({ ok: true, purged: results.length, results: results.map(item => ({ sourceHash: hash(item.sourceId), targetHash: hash(item.targetId), snapshotId: item.snapshotId, movedReferences: item.movedReferences, movedNested: item.movedNested })) });
  });
}
