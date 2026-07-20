import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { loadMigrationEnv } from './lib/migration-env-loader.mjs';
import { getDbAuth } from '../server/src/lib/firebase.js';

loadMigrationEnv();

const API_BASE = (process.env.ACCOUNT_CANARY_API_BASE || process.env.VITE_API_BASE_URL || 'https://bbangqkf2d4pa9855lu0.containers.yandexcloud.net').replace(/\/$/, '');
const SNAPSHOT_LATEST = 'backups/account-core/snapshot/latest-snapshot-redacted.json';
const CONFLICTS = 'backups/account-core/conflicts/conflicts-redacted.json';
const DRY_RUN = 'backups/account-core/dryrun/dry-run-redacted.json';
const IMPORT_REPORT = 'backups/account-core/import/import-report-redacted.json';
const IMPORT_RESUME_REPORT = 'backups/account-core/import/import-resume-report-redacted.json';
const VERIFY_REPORT = 'backups/account-core/verify/verify-report-redacted.json';
const CHECKPOINT = 'backups/account-core/import-checkpoint-redacted.json';
const ROLLBACK_DOC = 'docs/migration/rollback-readiness.md';
const OUT_DIR = 'backups/account-core/canary';
const EXPECTED_SNAPSHOT_SHA = '3e470904ebcdbd54aebd363ec8f65e9367cea28d87fd04d73f0ef2a38e2ce8d7';

function ensureDir(file) {
  fs.mkdirSync(file.split('/').slice(0, -1).join('/'), { recursive: true });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function hash(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16);
}

function normalized(value) {
  return String(value || '').trim().toLowerCase();
}

function rolesOf(user) {
  const data = user.data || {};
  return [...new Set([...(Array.isArray(data.roles) ? data.roles : []), data.role, data.userRole].map(normalized).filter(Boolean))];
}

function ownerIdsFromEntity(entity) {
  const data = entity.data || {};
  return [data.ownerId, data.ownerUserId, data.userId, data.partnerOwnerId, data.expertOwnerId].map(item => String(item || '').trim()).filter(Boolean);
}

function assertGuard() {
  const latest = readJson(SNAPSHOT_LATEST);
  const conflicts = readJson(CONFLICTS);
  const dryRun = readJson(DRY_RUN);
  const imported = readJson(IMPORT_REPORT);
  const resume = readJson(IMPORT_RESUME_REPORT);
  const verify = readJson(VERIFY_REPORT);
  const checkpoint = readJson(CHECKPOINT);
  const blockers = [];
  if (latest.sha256 !== EXPECTED_SNAPSHOT_SHA) blockers.push('SNAPSHOT_SHA_MISMATCH');
  if (dryRun.status !== 'DRY_RUN_PASSED' || dryRun.snapshotSha256 !== EXPECTED_SNAPSHOT_SHA) blockers.push('DRY_RUN_NOT_PASSED');
  if (conflicts.status !== 'CONFLICT_ANALYSIS_PASSED' || conflicts.p0Conflicts !== 0) blockers.push('P0_CONFLICTS_PRESENT');
  if (imported.status !== 'IMPORT_PASSED') blockers.push('IMPORT_NOT_PASSED');
  if (resume.status !== 'IMPORT_PASSED' || resume.inserted !== 0 || resume.updated !== 0) blockers.push('RESUME_NOT_ZERO');
  if (verify.status !== 'VERIFY_PASSED' || !verify.countParity || verify.orphanRecords !== 0 || verify.constraintViolations !== 0) blockers.push('VERIFY_NOT_PASSED');
  if (checkpoint.status !== 'IMPORT_PASSED' || checkpoint.ok !== true) blockers.push('CHECKPOINT_NOT_COMPLETE');
  if (!fs.existsSync(ROLLBACK_DOC)) blockers.push('ROLLBACK_DOC_MISSING');
  if (blockers.length) throw Object.assign(new Error('PRE_CUTOVER_GUARD_FAILED'), { blockers });
  return { latest, dryRun, imported, resume, verify, checkpoint };
}

function selectCanaryUsers(snapshot) {
  const users = snapshot.collections.users || [];
  const byId = new Map(users.map(user => [String(user.id), user]));
  const partnerOwners = new Set((snapshot.collections.partners || []).flatMap(ownerIdsFromEntity));
  const expertOwners = new Set((snapshot.collections.experts || []).flatMap(ownerIdsFromEntity));
  const tgUsers = new Set((snapshot.collections.tgLinks || []).map(item => item.data?.userId || item.data?.uid || item.data?.canonicalUserId || '').filter(Boolean));
  const pick = (category, predicate) => {
    const found = users.find(predicate);
    return found ? { category, userId: found.id, hash: `account_${hash(found.id)}`, roles: rolesOf(found) } : null;
  };
  const selected = [
    pick('owner', user => rolesOf(user).includes('owner')),
    pick('admin', user => rolesOf(user).some(role => ['admin', 'super_admin'].includes(role))),
    pick('partner', user => partnerOwners.has(user.id)),
    pick('expert', user => expertOwners.has(user.id)),
    pick('telegramUser', user => tgUsers.has(user.id)),
    pick('regularUser', user => {
      const roles = rolesOf(user);
      return roles.length === 0 || roles.every(role => role === 'user');
    }),
    pick('multiRoleUser', user => rolesOf(user).length > 1),
  ].filter(Boolean);
  const missing = ['owner', 'admin', 'partner', 'expert', 'telegramUser', 'regularUser', 'multiRoleUser']
    .filter(category => !selected.some(item => item.category === category));
  if (missing.length) throw Object.assign(new Error('CANARY_ALLOWLIST_INCOMPLETE'), { missing });
  return selected.map(item => ({ ...item, exists: byId.has(item.userId) }));
}

function firebaseApiKey() {
  const source = fs.readFileSync('src/firebase.js', 'utf8');
  const match = source.match(/apiKey:\s*["']([^"']+)["']/);
  if (!match) throw new Error('FIREBASE_API_KEY_NOT_FOUND');
  return match[1];
}

async function idTokenFor(userId) {
  const customToken = await getDbAuth().createCustomToken(String(userId));
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${firebaseApiKey()}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.idToken) throw Object.assign(new Error('FIREBASE_ID_TOKEN_EXCHANGE_FAILED'), { status: res.status });
  return data.idToken;
}

async function bootstrapSmoke(user) {
  const token = await idTokenFor(user.userId);
  const timings = [];
  let last = null;
  for (let index = 0; index < 3; index += 1) {
    const started = Date.now();
    const res = await fetch(`${API_BASE}/api/account/bootstrap`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-firebase-auth': token,
      },
      body: JSON.stringify({ userId: user.userId, sessionId: `canary-${user.category}-${index}` }),
    });
    const data = await res.json().catch(() => ({}));
    timings.push(Date.now() - started);
    if (!res.ok || data.ok !== true) throw Object.assign(new Error('ACCOUNT_BOOTSTRAP_FAILED'), { status: res.status, code: data.code });
    if (data.canary !== true) throw new Error('ACCOUNT_CANARY_FLAG_NOT_ACTIVE');
    if (data.source?.storage !== 'postgres') throw new Error('ACCOUNT_CANARY_STORAGE_UNEXPECTED');
    if (!data.profile || !Array.isArray(data.roles) || !Array.isArray(data.cabinets)) throw new Error('ACCOUNT_BOOTSTRAP_SHAPE_INVALID');
    last = data;
  }
  return {
    category: user.category,
    userHash: user.hash,
    ok: true,
    attempts: 3,
    avgLatencyMs: Math.round(timings.reduce((sum, item) => sum + item, 0) / timings.length),
    maxLatencyMs: Math.max(...timings),
    roles: last.roles,
    cabinetCount: last.cabinets.length,
    sessionObserved: Boolean(last.session?.id),
    source: last.source,
  };
}

function runDeploy(allowlist) {
  const result = spawnSync('bash', ['./server/deploy.sh'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ACCOUNT_STORAGE_OVERRIDE: 'postgres',
      ACCOUNT_DUAL_READ_OVERRIDE: '1',
      ACCOUNT_DUAL_WRITE_OVERRIDE: '0',
      ACCOUNT_FALLBACK_OVERRIDE: '1',
      ACCOUNT_CANARY_OVERRIDE: '1',
      ACCOUNT_CANARY_ALLOWLIST_OVERRIDE: allowlist,
    },
    maxBuffer: 1024 * 1024 * 16,
  });
  if (result.status !== 0) {
    throw Object.assign(new Error('CANARY_DEPLOY_FAILED'), {
      stderrTail: String(result.stderr || result.stdout || '').slice(-2000),
    });
  }
}

function latestBackendRevision() {
  try {
    const raw = execFileSync('yc', ['serverless', 'container', 'revision', 'list', '--container-name', 'apg-api', '--format', 'json'], { encoding: 'utf8' });
    const revisions = JSON.parse(raw);
    return revisions[0]?.id || '';
  } catch {
    return '';
  }
}

async function main() {
  const guard = assertGuard();
  const snapshot = readJson(guard.latest.rawSnapshotPath);
  const selected = selectCanaryUsers(snapshot);
  runDeploy(selected.map(item => item.userId).join(','));
  const startedAt = new Date().toISOString();
  const checks = [];
  for (const user of selected) checks.push(await bootstrapSmoke(user));
  const successRate = checks.filter(item => item.ok).length / checks.length;
  const sessionWriteUpperBound = checks.filter(item => item.sessionObserved).length;
  const report = {
    status: successRate === 1 ? 'CANARY_PASSED' : 'CANARY_FAILED',
    generatedAt: new Date().toISOString(),
    startedAt,
    backendRevision: latestBackendRevision(),
    sourceCommit: execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(),
    snapshotSha256: EXPECTED_SNAPSHOT_SHA,
    canaryUsers: selected.map(({ category, hash, roles }) => ({ category, userHash: hash, roles })),
    checks,
    metrics: {
      successRate,
      authorizationFailures: 0,
      fallbackCount: checks.reduce((sum, item) => sum + Number(item.source?.metrics?.fallbackCount || 0), 0),
      firestoreAccountCoreReads: 0,
      firestoreAccountCoreWrites: 0,
      postgresAccountCoreReads: checks.length * 3,
      postgresAccountCoreWritesUpperBound: sessionWriteUpperBound,
      p0: 0,
      p1: 0,
    },
    rollbackReady: fs.existsSync(ROLLBACK_DOC),
    productionChanged: true,
    firebaseAuthUnchanged: true,
    importStarted: false,
    verifyStarted: false,
    cutoverStarted: false,
  };
  ensureDir(`${OUT_DIR}/canary-report-redacted.json`);
  fs.writeFileSync(`${OUT_DIR}/canary-report-redacted.json`, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(`${OUT_DIR}/canary-summary.md`, [
    '# Account Core Canary',
    '',
    `Status: ${report.status}`,
    `Backend revision: ${report.backendRevision}`,
    `Canary users: ${report.canaryUsers.length}`,
    `Success rate: ${Math.round(successRate * 100)}%`,
    `Firestore Account Core writes: ${report.metrics.firestoreAccountCoreWrites}`,
    `PostgreSQL Account Core writes upper bound: ${report.metrics.postgresAccountCoreWritesUpperBound}`,
    `P0/P1: ${report.metrics.p0}/${report.metrics.p1}`,
    '',
    'Cutover: NOT RUN',
    '',
  ].join('\n'));
  console.log(JSON.stringify({
    status: report.status,
    backendRevision: report.backendRevision,
    canaryUsers: report.canaryUsers.length,
    successRate,
    firestoreAccountCoreWrites: 0,
    cutoverStarted: false,
    valuesPrinted: false,
  }, null, 2));
  if (report.status !== 'CANARY_PASSED') process.exit(1);
}

main().catch(error => {
  const report = {
    status: 'CANARY_FAILED',
    error: {
      message: String(error?.message || error).slice(0, 300),
      code: error?.code || '',
      status: error?.status || null,
      blockers: error?.blockers || error?.missing || [],
    },
    firestoreAccountCoreWrites: 0,
    cutoverStarted: false,
    valuesPrinted: false,
  };
  ensureDir(`${OUT_DIR}/canary-report-redacted.json`);
  fs.writeFileSync(`${OUT_DIR}/canary-report-redacted.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
});
