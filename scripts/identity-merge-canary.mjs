import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FORBIDDEN_ROLES = new Set(['owner', 'super_admin']);
const MAX_SNAPSHOT_AGE_MS = 15 * 60 * 1000;

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : String(process.argv[index + 1] || fallback);
}

function has(name) {
  return process.argv.includes(`--${name}`);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function sha256(value) {
  const input = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(stable(value)));
  return crypto.createHash('sha256').update(input).digest('hex');
}

function unique(values = []) {
  const seen = new Set();
  return values.filter(value => {
    const key = JSON.stringify(stable(value));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function replaceExact(value, sourceId, canonicalId) {
  if (value === sourceId) return canonicalId;
  if (Array.isArray(value)) return unique(value.map(item => replaceExact(item, sourceId, canonicalId)));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceExact(item, sourceId, canonicalId)]));
}

function timestamp(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function richer(left, right) {
  if (right === undefined || right === null || right === '') return left;
  if (left === undefined || left === null || left === '') return right;
  if (Array.isArray(left) || Array.isArray(right)) return unique([...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])]);
  if (typeof left === 'object' && typeof right === 'object') return mergeObjects(left, right);
  return String(right).length > String(left).length ? right : left;
}

function mergeObjects(target = {}, source = {}) {
  const result = { ...target };
  for (const [key, value] of Object.entries(source || {})) result[key] = richer(result[key], value);
  return result;
}

function userRoles(snapshot, ids) {
  const roles = [];
  for (const row of snapshot.identityUsers || []) {
    if (!ids.includes(row.id)) continue;
    roles.push(row.role, ...(Array.isArray(row.roles) ? row.roles : []));
  }
  for (const row of snapshot.identityRoles || []) {
    if (!ids.includes(row.user_id)) continue;
    roles.push(row.primary_role, ...(Array.isArray(row.roles) ? row.roles : []));
  }
  for (const row of snapshot.accountRoles || []) {
    if (!ids.includes(row.user_id)) continue;
    roles.push(row.primary_role, ...(Array.isArray(row.roles) ? row.roles : []));
  }
  for (const row of snapshot.documents || []) {
    if (row.collection_path !== 'users' || !ids.includes(row.document_id)) continue;
    roles.push(row.data?.role, row.data?.userRole, ...(Array.isArray(row.data?.roles) ? row.data.roles : []));
  }
  return [...new Set(roles.map(value => String(value || '').toLowerCase()).filter(Boolean))];
}

function planDocuments(snapshot, sourceId, canonicalId) {
  const byPath = new Map((snapshot.documents || []).map(row => [row.path, row]));
  const operations = [];
  const conflicts = [];
  const sourceUserPath = `users/${sourceId}`;
  const canonicalUserPath = `users/${canonicalId}`;
  const mergesUserRoot = byPath.has(sourceUserPath) && byPath.has(canonicalUserPath);

  for (const row of snapshot.documents || []) {
    const nextData = replaceExact(row.data, sourceId, canonicalId);
    let nextPath = row.path;
    if (row.path === sourceUserPath) {
      const canonical = byPath.get(canonicalUserPath);
      if (!canonical) {
        conflicts.push({ code: 'CANONICAL_USER_DOCUMENT_MISSING', sourcePath: row.path, targetPath: `users/${canonicalId}` });
        continue;
      }
      const merged = mergeObjects(row.data || {}, canonical.data || {});
      merged.userId = canonicalId;
      merged.canonicalUserId = canonicalId;
      merged.keys = Math.max(Number(row.data?.keys || 0), Number(canonical.data?.keys || 0));
      merged.roles = unique([...(Array.isArray(row.data?.roles) ? row.data.roles : []), ...(Array.isArray(canonical.data?.roles) ? canonical.data.roles : [])]);
      operations.push({
        kind: 'document-merge',
        sourcePath: row.path,
        targetPath: canonical.path,
        beforeTarget: canonical.data,
        afterTarget: replaceExact(merged, sourceId, canonicalId),
        sourceDisposition: 'alias-tombstone',
      });
      continue;
    }
    // The root merge already applies replaceExact to the canonical document.
    // Emitting a second update with the original before-image would make a
    // transactional executor correctly report drift after the merge.
    if (mergesUserRoot && row.path === canonicalUserPath) continue;
    if (row.path.startsWith(`users/${sourceId}/`)) {
      nextPath = `users/${canonicalId}/${row.path.slice(`users/${sourceId}/`.length)}`;
      const collision = byPath.get(nextPath);
      if (collision && collision.path !== row.path) {
        if (sha256(collision.data) === sha256(nextData)) {
          operations.push({ kind: 'document-deduplicate', sourcePath: row.path, targetPath: nextPath, identical: true });
        } else {
          conflicts.push({
            code: 'NESTED_DOCUMENT_COLLISION',
            sourcePath: row.path,
            targetPath: nextPath,
            sourceHash: sha256(nextData),
            targetHash: sha256(collision.data),
          });
        }
        continue;
      }
      operations.push({ kind: 'document-move', sourcePath: row.path, targetPath: nextPath, before: row.data, after: nextData });
      continue;
    }
    if (sha256(row.data) !== sha256(nextData)) {
      operations.push({ kind: 'document-update', path: row.path, before: row.data, after: nextData });
    }
  }
  return { operations, conflicts };
}

function planTables(snapshot, sourceId, canonicalId) {
  const operations = [];
  const tableSets = [
    ['apg_identity_links', snapshot.identityLinks, ['user_id', 'canonical_user_id']],
    ['apg_identity_email_index', snapshot.emailIndex, ['user_id', 'canonical_user_id']],
    ['apg_account_sessions', snapshot.accountSessions, ['user_id', 'firebase_uid']],
    ['apg_account_telegram_links', snapshot.telegramLinks, ['user_id', 'canonical_user_id']],
    ['apg_account_cabinets', snapshot.cabinets, ['user_id']],
  ];
  for (const [table, rows = [], fields] of tableSets) {
    for (const row of rows) {
      const after = { ...row };
      let changed = false;
      for (const field of fields) {
        if (after[field] === sourceId) {
          after[field] = canonicalId;
          changed = true;
        }
      }
      if (changed) operations.push({ kind: 'table-update', table, before: row, after });
    }
  }

  const sourceProfile = (snapshot.accountProfiles || []).find(row => row.user_id === sourceId);
  const targetProfile = (snapshot.accountProfiles || []).find(row => row.user_id === canonicalId);
  if (sourceProfile && targetProfile) {
    const after = mergeObjects(sourceProfile, targetProfile);
    after.user_id = canonicalId;
    after.canonical_user_id = canonicalId;
    after.profile = replaceExact(mergeObjects(sourceProfile.profile || {}, targetProfile.profile || {}), sourceId, canonicalId);
    after.profile.keys = Math.max(Number(sourceProfile.profile?.keys || 0), Number(targetProfile.profile?.keys || 0));
    operations.push({
      kind: 'account-profile-merge',
      table: 'apg_account_profiles',
      sourceUserId: sourceId,
      targetUserId: canonicalId,
      beforeSource: sourceProfile,
      beforeTarget: targetProfile,
      afterTarget: after,
      sourceDisposition: 'alias-tombstone',
    });
  }
  return operations;
}

function buildRollback(snapshotFile, snapshot, plan) {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    cluster: plan.cluster,
    snapshotFile: path.resolve(snapshotFile),
    snapshotSha256: sha256(fs.readFileSync(snapshotFile)),
    canonicalUserId: plan.canonicalUserId,
    sourceUserIds: plan.sourceUserIds,
    strategy: 'restore-exact-before-images-in-reverse-operation-order',
    operations: [...plan.operations].reverse().map(operation => ({
      kind: operation.kind,
      path: operation.path,
      sourcePath: operation.sourcePath,
      targetPath: operation.targetPath,
      table: operation.table,
      restore: {
        before: operation.before,
        beforeSource: operation.beforeSource,
        beforeTarget: operation.beforeTarget,
      },
    })),
    snapshot,
  };
}

function assertSafe(snapshotFile, payload, plan, execute) {
  if (payload.ok !== true || payload.readOnly !== true || payload.transactionEnd !== 'ROLLBACK') {
    throw new Error('Snapshot is not a verified READ ONLY/ROLLBACK artifact.');
  }
  const ids = [plan.canonicalUserId, ...plan.sourceUserIds];
  const roles = userRoles(payload.snapshot || {}, ids);
  const forbidden = roles.filter(role => FORBIDDEN_ROLES.has(role));
  if (forbidden.length) throw new Error(`Protected role cluster is forbidden: ${forbidden.join(', ')}`);
  if (plan.cluster !== 'daria') throw new Error(`Only the approved non-admin canary cluster is supported, got: ${plan.cluster}`);
  if (plan.sourceUserIds.length !== 1) throw new Error('Canary requires exactly one source alias.');
  if (plan.conflicts.length) throw new Error(`Dry-run has ${plan.conflicts.length} unresolved conflicts.`);
  if (execute) {
    const age = Date.now() - timestamp(payload.generatedAt);
    if (age < 0 || age > MAX_SNAPSHOT_AGE_MS) throw new Error(`Snapshot is stale for execution (${Math.round(age / 60000)} minutes).`);
    const expectedApproval = `MERGE:${plan.cluster}:${sha256(fs.readFileSync(snapshotFile)).slice(0, 16)}`;
    if (arg('approval') !== expectedApproval) throw new Error(`Execution approval mismatch. Required: ${expectedApproval}`);
    throw new Error('Execution adapter is intentionally disabled until the dry-run receives explicit approval.');
  }
}

const snapshotFile = path.resolve(arg('snapshot'));
if (!snapshotFile || !fs.existsSync(snapshotFile)) throw new Error('Use --snapshot <verified-read-only-snapshot.json>.');
const payload = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
const cluster = arg('cluster', payload.cluster);
const execute = has('execute');
const dryRun = !execute || has('dry-run');
const canonicalUserId = String(payload.canonicalUserId || '');
const sourceUserIds = Array.isArray(payload.sourceUserIds) ? payload.sourceUserIds.map(String) : [];
if (!canonicalUserId || !sourceUserIds.length) throw new Error('Snapshot does not define canonical/source user IDs.');

const documentPlan = planDocuments(payload.snapshot || {}, sourceUserIds[0], canonicalUserId);
const tableOperations = planTables(payload.snapshot || {}, sourceUserIds[0], canonicalUserId);
const operations = [...documentPlan.operations, ...tableOperations];
const plan = {
  version: 1,
  generatedAt: new Date().toISOString(),
  mode: dryRun ? 'DRY_RUN' : 'EXECUTE',
  productionChanged: false,
  cluster,
  canonicalUserId,
  sourceUserIds,
  snapshotFile,
  snapshotSha256: sha256(fs.readFileSync(snapshotFile)),
  operations,
  conflicts: documentPlan.conflicts,
  summary: {
    operations: operations.length,
    documentMerges: operations.filter(row => row.kind === 'document-merge').length,
    documentMoves: operations.filter(row => row.kind === 'document-move').length,
    documentUpdates: operations.filter(row => row.kind === 'document-update').length,
    documentDeduplications: operations.filter(row => row.kind === 'document-deduplicate').length,
    tableUpdates: operations.filter(row => row.kind === 'table-update').length,
    accountProfileMerges: operations.filter(row => row.kind === 'account-profile-merge').length,
    conflicts: documentPlan.conflicts.length,
  },
  invariants: {
    expectedCanonicalUserId: canonicalUserId,
    expectedEmail: 'daria_samarina@mail.ru',
    expectedTelegramId: '1424650385',
    expectedUsername: 'dariasamarina83',
    expectedKeys: 67,
    protectedRolesAbsent: true,
    sourceOnlyReferencesAfterMerge: 0,
    uniqueDocumentCountMustNotDecrease: true,
  },
};

assertSafe(snapshotFile, payload, plan, execute);

const outputDir = path.resolve(arg('output-dir', 'backups/audits/canary-daria'));
fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
const planFile = path.join(outputDir, 'merge-plan.json');
const rollbackFile = path.join(outputDir, 'rollback-manifest.json');
fs.writeFileSync(planFile, `${JSON.stringify(plan, null, 2)}\n`, { mode: 0o600 });
fs.writeFileSync(rollbackFile, `${JSON.stringify(buildRollback(snapshotFile, payload.snapshot || {}, plan), null, 2)}\n`, { mode: 0o600 });

console.log(JSON.stringify({
  ok: true,
  mode: plan.mode,
  productionChanged: false,
  cluster,
  canonicalUserId,
  sourceUserIds,
  snapshotSha256: plan.snapshotSha256,
  summary: plan.summary,
  invariants: plan.invariants,
  planFile,
  rollbackFile,
  executionEnabled: false,
}, null, 2));
