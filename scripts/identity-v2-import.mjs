import { getDb } from '../server/src/lib/firebase.js';
import { serverFoundation } from '../server/src/apg/index.js';

const LIMIT = Number(process.env.IDENTITY_IMPORT_LIMIT || process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1] || 5000);
const DRY_RUN = process.argv.includes('--dry-run');

function serializeDoc(doc) {
  return { id: doc.id, ...(doc.data() || {}) };
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

async function collectIdentityDocuments(db) {
  const [usersSnap, emailIndexSnap, authMapSnap, tgLinksSnap, canonicalSnap, linksSnap] = await Promise.all([
    db.collection('users').limit(LIMIT).get(),
    db.collection('emailIndex').limit(LIMIT).get().catch(() => ({ docs: [] })),
    db.collection('auth_map').limit(LIMIT).get().catch(() => ({ docs: [] })),
    db.collection('tgLinks').limit(LIMIT).get().catch(() => ({ docs: [] })),
    db.collection('canonicalUsers').limit(LIMIT).get().catch(() => ({ docs: [] })),
    db.collection('identityLinks').limit(LIMIT).get().catch(() => ({ docs: [] })),
  ]);
  return {
    users: usersSnap.docs.map(serializeDoc),
    emailIndex: emailIndexSnap.docs.map(serializeDoc),
    authMap: authMapSnap.docs.map(serializeDoc),
    tgLinks: tgLinksSnap.docs.map(serializeDoc),
    canonicalUsers: canonicalSnap.docs.map(serializeDoc),
    identityLinks: linksSnap.docs.map(serializeDoc),
  };
}

async function importUser(user) {
  const identity = {
    userId: user.canonicalUserId || user.id,
    canonicalUserId: user.canonicalUserId || user.id,
    user: {
      ...user,
      id: user.canonicalUserId || user.id,
      legacyId: user.id,
      email: normalizeEmail(user.email || user.linkedEmail),
      linkedEmail: normalizeEmail(user.linkedEmail || user.email),
    },
    source: 'legacy_import',
  };
  if (DRY_RUN) return identity;
  return serverFoundation.identityV2.repository.importLegacyIdentity(identity);
}

async function run() {
  const db = getDb();
  const startedAt = Date.now();
  const docs = await collectIdentityDocuments(db);
  const result = {
    dryRun: DRY_RUN,
    limit: LIMIT,
    source: Object.fromEntries(Object.entries(docs).map(([key, value]) => [key, value.length])),
    importedUsers: 0,
    importedEmails: 0,
    importedTelegram: 0,
    errors: [],
  };

  for (const user of docs.users) {
    try {
      await importUser(user);
      result.importedUsers += 1;
      if (normalizeEmail(user.email || user.linkedEmail)) result.importedEmails += 1;
      if (user.linkedTelegram?.tgId || user.linkedTelegram?.telegramId) result.importedTelegram += 1;
    } catch (error) {
      result.errors.push({ id: user.id, code: error?.code || '', message: String(error?.message || error).slice(0, 200) });
    }
  }

  result.durationMs = Date.now() - startedAt;
  result.identity = serverFoundation.identityV2.snapshot();
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length) process.exitCode = 1;
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
