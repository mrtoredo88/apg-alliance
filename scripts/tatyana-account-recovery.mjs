import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';

const CANONICAL_ID = 'email:gordeeva.tatyana@mail.ru';
const TG_ID = 'tg_875814883';
const EXPECTED_CONFIRMED_BALANCE = 5;
const ROOT = process.cwd();

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

async function readDoc(db, collection, id) {
  const snap = await db.collection(collection).doc(id).get();
  return { path: `${collection}/${id}`, exists: snap.exists, data: snap.exists ? snap.data() : null };
}

function valueScore(value) {
  if (value === null || value === undefined) return 0;
  if (Array.isArray(value)) return value.length;
  if (typeof value === 'object') return Object.keys(value).length;
  const text = String(value || '').trim();
  if (!text) return 0;
  if (/^[^@\s]+@[^@\s]+$/.test(text)) return 1;
  return text.includes(' ') ? text.length + 20 : text.length;
}

function isEmailLocalPart(value) {
  return String(value || '').trim().toLowerCase() === CANONICAL_ID.slice(6).split('@')[0];
}

function chooseRicher(current, candidate) {
  if (candidate === undefined || candidate === null || candidate === '') return current;
  if (current === undefined || current === null || current === '') return candidate;
  if (isEmailLocalPart(current) && !isEmailLocalPart(candidate)) return candidate;
  return valueScore(candidate) > valueScore(current) ? candidate : current;
}

function unionArray(left, right) {
  return Array.from(new Set([...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])].map(item => String(item)).filter(Boolean)));
}

function buildRecoveryPatch(canonical, tg) {
  const patch = {};
  for (const key of ['displayName', 'firstName', 'lastName', 'photo', 'bio', 'about', 'username', 'locale', 'timezone', 'gender', 'birthday']) {
    const next = chooseRicher(canonical[key], tg[key]);
    if (next !== canonical[key] && next !== undefined) patch[key] = next;
  }
  if (Number(canonical.keys || 0) < EXPECTED_CONFIRMED_BALANCE) patch.keys = EXPECTED_CONFIRMED_BALANCE;
  const maxReputation = Math.max(Number(canonical.reputation || 0), Number(tg.reputation || 0));
  if (maxReputation !== Number(canonical.reputation || 0)) patch.reputation = maxReputation;
  const completedTasks = unionArray(canonical.completedTasks, tg.completedTasks);
  if (completedTasks.length !== (Array.isArray(canonical.completedTasks) ? canonical.completedTasks.length : 0)) patch.completedTasks = completedTasks;
  for (const key of ['friends', 'friendIds', 'connectionIds', 'socialConnectionIds']) {
    const merged = unionArray(canonical[key], tg[key]);
    if (merged.length) patch[key] = merged;
  }
  patch.updatedAt = FieldValue.serverTimestamp();
  return patch;
}

function diffFromPatch(before, patch) {
  const diff = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'updatedAt') continue;
    diff[key] = { before: serialize(before[key] ?? null), after: serialize(value) };
  }
  return diff;
}

async function countRefs(db) {
  const collections = ['contextDialogs', 'bookings', 'notifications'];
  const refs = {};
  for (const collection of collections) {
    const snap = await db.collection(collection).limit(5000).get();
    let total = 0;
    snap.forEach(doc => {
      const text = JSON.stringify({ id: doc.id, ...serialize(doc.data()) });
      if (text.includes(CANONICAL_ID) || text.includes(TG_ID)) total += 1;
    });
    refs[collection] = total;
  }
  return refs;
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(serialize(data), null, 2)}\n`);
}

async function rollback(db, rollbackPath) {
  const rollbackData = JSON.parse(await readFile(rollbackPath, 'utf8'));
  const batch = db.batch();
  for (const item of rollbackData.restoreDocs || []) {
    const [collection, ...rest] = item.path.split('/');
    const ref = db.collection(collection).doc(rest.join('/'));
    if (item.exists) batch.set(ref, deserialize(item.data || {}), { merge: false });
    else batch.delete(ref);
  }
  await batch.commit();
  console.log(JSON.stringify({ ok: true, rolledBackFrom: rollbackPath }, null, 2));
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

  const outDir = path.join(ROOT, 'backups/recovery/tatyana', timestampSlug());
  await mkdir(outDir, { recursive: true });
  const docs = {
    canonical: await readDoc(db, 'users', CANONICAL_ID),
    tgUser: await readDoc(db, 'users', TG_ID),
    tgLinks: await readDoc(db, 'tgLinks', TG_ID),
    identityLinks: await readDoc(db, 'identityLinks', CANONICAL_ID),
    emailIndex: await readDoc(db, 'emailIndex', 'gordeeva.tatyana@mail.ru'),
    canonicalUsers: await readDoc(db, 'canonicalUsers', CANONICAL_ID),
  };

  assert.equal(docs.canonical.exists, true, 'canonical user must exist');
  assert.equal(docs.tgUser.exists, true, 'legacy Telegram user must exist');
  assert.equal(docs.tgLinks.data?.userId, CANONICAL_ID, 'Telegram link must point to canonical');
  assert.equal(docs.identityLinks.data?.canonicalUserId, CANONICAL_ID, 'identity link must point to canonical');
  assert.equal(docs.tgUser.data?.identityStatus, 'legacy_linked', 'legacy Telegram user must remain linked legacy');

  const refsBefore = await countRefs(db);
  await writeJson(path.join(outDir, 'before.json'), docs);
  await writeJson(path.join(outDir, 'canonical-user.json'), docs.canonical);
  await writeJson(path.join(outDir, 'tg-user.json'), docs.tgUser);
  await writeJson(path.join(outDir, 'tgLinks.json'), docs.tgLinks);
  await writeJson(path.join(outDir, 'identityLinks.json'), docs.identityLinks);
  await writeJson(path.join(outDir, 'rollback.json'), {
    generatedAt: new Date().toISOString(),
    restoreDocs: [docs.canonical, docs.tgUser, docs.tgLinks, docs.identityLinks],
  });

  const patch = buildRecoveryPatch(docs.canonical.data, docs.tgUser.data);
  const dryRun = {
    generatedAt: new Date().toISOString(),
    mode: 'dry-run-then-apply',
    canonicalUserId: CANONICAL_ID,
    legacyTelegramUserId: TG_ID,
    diff: diffFromPatch(docs.canonical.data, patch),
    notes: {
      RESTORED_CONFIRMED_BALANCE: EXPECTED_CONFIRMED_BALANCE,
      USER_EXPECTED_BALANCE: 'approximately 20',
      ADDITIONAL_LEDGER_REQUIRED: true,
      vkUser15065594Used: false,
    },
  };
  await writeJson(path.join(outDir, 'dry-run.json'), dryRun);
  console.log(JSON.stringify({ stage: 'dry-run', backupPath: outDir, diff: dryRun.diff, notes: dryRun.notes }, null, 2));

  await db.collection('users').doc(CANONICAL_ID).set(patch, { merge: true });
  await db.collection('users').doc(TG_ID).set({
    identityStatus: 'legacy_linked',
    canonicalUserId: CANONICAL_ID,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  const after = {
    canonical: await readDoc(db, 'users', CANONICAL_ID),
    tgUser: await readDoc(db, 'users', TG_ID),
    refsAfter: await countRefs(db),
  };
  assert.equal(after.canonical.data.displayName, 'Татьяна Гордеева', 'displayName must be restored');
  assert.equal(after.canonical.data.firstName, 'Татьяна', 'firstName must be restored');
  assert.ok(after.canonical.data.photo, 'photo must be present');
  assert.equal(Number(after.canonical.data.keys || 0), EXPECTED_CONFIRMED_BALANCE, 'keys must match confirmed balance');
  assert.deepEqual(after.canonical.data.roles, docs.canonical.data.roles, 'roles must remain unchanged');
  assert.deepEqual(after.canonical.data.partnerCabinetIds, docs.canonical.data.partnerCabinetIds, 'partner cabinet ids must remain unchanged');
  assert.equal(after.tgUser.data.identityStatus, 'legacy_linked', 'legacy user must remain linked');
  assert.deepEqual(after.refsAfter, refsBefore, 'dialogs/bookings/notifications reference counts must remain unchanged');

  const report = {
    completedAt: new Date().toISOString(),
    canonicalUserId: CANONICAL_ID,
    legacyTelegramUserId: TG_ID,
    backupPath: outDir,
    rollbackPath: path.join(outDir, 'rollback.json'),
    appliedPatch: diffFromPatch(docs.canonical.data, patch),
    verification: {
      emailIdentityFoundExpected: true,
      telegramLinkCanonical: after.tgUser.data.canonicalUserId === CANONICAL_ID && docs.tgLinks.data.userId === CANONICAL_ID,
      displayNameRestored: after.canonical.data.displayName === 'Татьяна Гордеева',
      photoPresent: Boolean(after.canonical.data.photo),
      keysConfirmed: Number(after.canonical.data.keys || 0) === EXPECTED_CONFIRMED_BALANCE,
      rolesUnchanged: JSON.stringify(after.canonical.data.roles) === JSON.stringify(docs.canonical.data.roles),
      partnerCabinetPreserved: JSON.stringify(after.canonical.data.partnerCabinetIds) === JSON.stringify(docs.canonical.data.partnerCabinetIds),
      dialogsBookingsNotificationsPreserved: JSON.stringify(after.refsAfter) === JSON.stringify(refsBefore),
      user15065594Untouched: true,
    },
    ledger: {
      RESTORED_CONFIRMED_BALANCE: EXPECTED_CONFIRMED_BALANCE,
      USER_EXPECTED_BALANCE: 'approximately 20',
      ADDITIONAL_LEDGER_REQUIRED: true,
    },
  };
  await writeJson(path.join(outDir, 'recovery-report.json'), report);
  console.log(JSON.stringify({ stage: 'applied', ...report }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
