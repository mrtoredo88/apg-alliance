import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';

const ROOT = process.cwd();
const CANONICAL_ID = 'email:gordeeva.tatyana@mail.ru';
const TG_ID = 'tg_875814883';
const BLOCKED_VK_ID = '15065594';
const BEFORE_KEYS = 5;
const RESTORED_KEYS = 20;
const REASON = 'Administrative recovery of historical key balance after identity/profile restoration. Approved by APG owner. Historical balance restored manually after account recovery.';

function loadServiceAccount() {
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(ROOT, 'server/firebase-service-account.json');
  return JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
}

function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function serialize(value) {
  if (value instanceof Timestamp) return { __type: 'timestamp', value: value.toDate().toISOString() };
  if (value && typeof value.toDate === 'function') return { __type: 'timestamp', value: value.toDate().toISOString() };
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  return value;
}

function deserialize(value) {
  if (Array.isArray(value)) return value.map(deserialize);
  if (value && typeof value === 'object') {
    if (value.__type === 'timestamp') return Timestamp.fromDate(new Date(value.value));
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deserialize(item)]));
  }
  return value;
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(serialize(data), null, 2)}\n`);
}

async function readDoc(db, collection, id) {
  const snap = await db.collection(collection).doc(id).get();
  return { path: `${collection}/${id}`, exists: snap.exists, data: snap.exists ? snap.data() : null };
}

function omitOperationalKeys(data = {}) {
  const copy = { ...data };
  delete copy.keys;
  delete copy.updatedAt;
  return JSON.stringify(serialize(copy));
}

async function countMatchingRefs(db) {
  const out = {};
  for (const collection of ['contextDialogs', 'bookings', 'notifications']) {
    const snap = await db.collection(collection).limit(5000).get();
    let count = 0;
    snap.forEach(doc => {
      const text = JSON.stringify({ id: doc.id, ...serialize(doc.data()) });
      if (text.includes(CANONICAL_ID) || text.includes(TG_ID)) count += 1;
    });
    out[collection] = count;
  }
  return out;
}

async function rollback(db, rollbackPath) {
  const rollbackData = JSON.parse(await readFile(rollbackPath, 'utf8'));
  assert.equal(rollbackData.allowedUserId, CANONICAL_ID, 'rollback allowlist mismatch');
  const userRef = db.collection('users').doc(CANONICAL_ID);
  await db.runTransaction(async tx => {
    const snap = await tx.get(userRef);
    assert.equal(snap.exists, true, 'canonical user must exist for rollback');
    tx.set(userRef, {
      keys: rollbackData.rollback.keys,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  console.log(JSON.stringify({ ok: true, rolledBackUserId: CANONICAL_ID, keys: rollbackData.rollback.keys, rollbackPath }, null, 2));
}

async function main() {
  if (!getApps().length) initializeApp({ credential: cert(loadServiceAccount()) });
  const db = getFirestore();
  const rollbackArgIndex = process.argv.indexOf('--rollback');
  if (rollbackArgIndex !== -1) {
    const rollbackPath = process.argv[rollbackArgIndex + 1];
    if (!rollbackPath || !existsSync(rollbackPath)) throw new Error('Rollback path is required.');
    await rollback(db, rollbackPath);
    return;
  }

  const outDir = path.join(ROOT, 'backups/recovery/tatyana-admin-balance', timestampSlug());
  await mkdir(outDir, { recursive: true });

  const before = {
    canonical: await readDoc(db, 'users', CANONICAL_ID),
    tgUser: await readDoc(db, 'users', TG_ID),
    blockedVkUser: await readDoc(db, 'users', BLOCKED_VK_ID),
    tgLinks: await readDoc(db, 'tgLinks', TG_ID),
    identityLinks: await readDoc(db, 'identityLinks', CANONICAL_ID),
    canonicalUsers: await readDoc(db, 'canonicalUsers', CANONICAL_ID),
    refs: await countMatchingRefs(db),
  };

  assert.equal(before.canonical.exists, true, 'canonical user must exist');
  assert.equal(before.tgLinks.data?.userId, CANONICAL_ID, 'Telegram link must point to canonical');
  assert.equal(before.identityLinks.data?.canonicalUserId, CANONICAL_ID, 'identity must remain canonical');
  assert.equal(Number(before.canonical.data?.keys || 0), BEFORE_KEYS, 'optimistic lock failed: current keys must be 5 before admin recovery');
  assert.equal(before.canonical.data?.displayName, 'Татьяна Гордеева', 'profile must already be restored');
  assert.equal(before.tgUser.data?.canonicalUserId, CANONICAL_ID, 'legacy Telegram must point to canonical');

  const diff = {
    users: {
      [CANONICAL_ID]: {
        keys: { before: BEFORE_KEYS, after: RESTORED_KEYS },
      },
    },
    audit: {
      adminActivity: 'create one audit entry',
      accountRecoveryAudit: 'create one recovery entry',
    },
  };
  const rollbackData = {
    generatedAt: new Date().toISOString(),
    allowedUserId: CANONICAL_ID,
    rollback: { keys: BEFORE_KEYS },
    noOtherFields: true,
  };

  await writeJson(path.join(outDir, 'before.json'), before);
  await writeJson(path.join(outDir, 'diff.json'), diff);
  await writeJson(path.join(outDir, 'rollback.json'), rollbackData);
  console.log(JSON.stringify({ stage: 'dry-run', backupPath: outDir, diff, reason: REASON }, null, 2));

  const userRef = db.collection('users').doc(CANONICAL_ID);
  const auditRef = db.collection('adminActivity').doc();
  const recoveryRef = db.collection('accountRecoveryAudit').doc();
  await db.runTransaction(async tx => {
    const snap = await tx.get(userRef);
    assert.equal(snap.exists, true, 'canonical user must exist');
    assert.equal(Number(snap.data()?.keys || 0), BEFORE_KEYS, 'optimistic lock failed during apply');
    tx.set(userRef, {
      keys: RESTORED_KEYS,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    const auditBase = {
      action: 'account:adminBalanceRecovery',
      targetType: 'users',
      targetId: CANONICAL_ID,
      label: 'Administrative key balance recovery: Tatyana Gordeeva',
      actorId: 'apg-owner-approved-recovery',
      actorUid: '',
      actorName: 'APG Owner',
      role: 'owner',
      result: 'success',
      details: {
        reason: REASON,
        beforeKeys: BEFORE_KEYS,
        afterKeys: RESTORED_KEYS,
        changedFields: ['keys'],
        legacyTelegramUserId: TG_ID,
        blockedVkUserId: BLOCKED_VK_ID,
        blockedVkUserUsed: false,
        backupPath: outDir,
      },
      appVersion: '',
      ip: '',
      userAgent: 'codex-controlled-admin-recovery',
      idempotencyKey: `tatyana-admin-balance-${RESTORED_KEYS}`,
      createdAt: FieldValue.serverTimestamp(),
    };
    tx.set(auditRef, auditBase);
    tx.set(recoveryRef, {
      ...auditBase,
      collection: 'accountRecoveryAudit',
      rollbackPath: path.join(outDir, 'rollback.json'),
    });
  });

  const after = {
    canonical: await readDoc(db, 'users', CANONICAL_ID),
    tgUser: await readDoc(db, 'users', TG_ID),
    blockedVkUser: await readDoc(db, 'users', BLOCKED_VK_ID),
    tgLinks: await readDoc(db, 'tgLinks', TG_ID),
    identityLinks: await readDoc(db, 'identityLinks', CANONICAL_ID),
    canonicalUsers: await readDoc(db, 'canonicalUsers', CANONICAL_ID),
    refs: await countMatchingRefs(db),
    audit: {
      adminActivityPath: auditRef.path,
      accountRecoveryAuditPath: recoveryRef.path,
    },
  };

  assert.equal(Number(after.canonical.data?.keys || 0), RESTORED_KEYS, 'keys must be restored to 20');
  assert.equal(after.canonical.data?.displayName, before.canonical.data?.displayName, 'displayName must not change');
  assert.equal(Boolean(after.canonical.data?.photo), Boolean(before.canonical.data?.photo), 'photo presence must not change');
  assert.deepEqual(after.canonical.data?.roles, before.canonical.data?.roles, 'roles must not change');
  assert.deepEqual(after.canonical.data?.partnerCabinetIds, before.canonical.data?.partnerCabinetIds, 'partner cabinet must not change');
  assert.equal(after.tgLinks.data?.userId, before.tgLinks.data?.userId, 'tgLinks must not change');
  assert.equal(after.identityLinks.data?.canonicalUserId, before.identityLinks.data?.canonicalUserId, 'identityLinks must not change');
  assert.equal(after.tgUser.data?.canonicalUserId, before.tgUser.data?.canonicalUserId, 'legacy Telegram must not change');
  assert.equal(after.blockedVkUser.data?.updatedAt?.toMillis?.(), before.blockedVkUser.data?.updatedAt?.toMillis?.(), '15065594 must not change');
  assert.deepEqual(after.refs, before.refs, 'dialogs/bookings/notifications counts must not change');
  assert.equal(omitOperationalKeys(after.canonical.data), omitOperationalKeys(before.canonical.data), 'only keys and updatedAt may change on canonical user');

  await writeJson(path.join(outDir, 'after.json'), after);
  const report = {
    completedAt: new Date().toISOString(),
    verdict: 'TATYANA_ADMIN_BALANCE_RECOVERY_APPLIED',
    canonicalUserId: CANONICAL_ID,
    changedDocuments: [userRef.path, auditRef.path, recoveryRef.path],
    changedUserFields: ['keys', 'updatedAt'],
    beforeKeys: BEFORE_KEYS,
    afterKeys: RESTORED_KEYS,
    backupPath: outDir,
    rollbackPath: path.join(outDir, 'rollback.json'),
    reason: REASON,
    verification: {
      emailLoginCanonicalExpected: true,
      telegramLoginCanonical: after.tgLinks.data?.userId === CANONICAL_ID && after.tgUser.data?.canonicalUserId === CANONICAL_ID,
      canonicalProfile: after.canonical.data?.canonicalUserId === CANONICAL_ID,
      partnerCabinetPreserved: JSON.stringify(after.canonical.data?.partnerCabinetIds || []) === JSON.stringify(before.canonical.data?.partnerCabinetIds || []),
      adminRolePreserved: Array.isArray(after.canonical.data?.roles) && after.canonical.data.roles.includes('super_admin'),
      photoPreserved: Boolean(after.canonical.data?.photo) === Boolean(before.canonical.data?.photo),
      displayNamePreserved: after.canonical.data?.displayName === before.canonical.data?.displayName,
      dialogsPreserved: after.refs.contextDialogs === before.refs.contextDialogs,
      notificationsPreserved: after.refs.notifications === before.refs.notifications,
      friendsPreserved: JSON.stringify(after.canonical.data?.friends || []) === JSON.stringify(before.canonical.data?.friends || []),
      onlyCanonicalKeysChanged: omitOperationalKeys(after.canonical.data) === omitOperationalKeys(before.canonical.data),
      blockedVkUserUntouched: after.blockedVkUser.data?.updatedAt?.toMillis?.() === before.blockedVkUser.data?.updatedAt?.toMillis?.(),
    },
  };
  await writeJson(path.join(outDir, 'recovery-report.json'), report);
  console.log(JSON.stringify({ stage: 'applied', ...report }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
