import { createHash } from 'node:crypto';
import { getDb } from '../lib/documentStore.js';
import { previewMergedAccountCleanup, purgeMergedAccount } from '../lib/mergedAccountCleanup.js';

const hash = value => createHash('sha256').update(String(value || '')).digest('hex').slice(0, 12);

export default async function mergedAccountMaintenanceRoutes(fastify) {
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
