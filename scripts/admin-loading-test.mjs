import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const adminPanel = fs.readFileSync(path.join(root, 'src/AdminPanel.jsx'), 'utf8');
const adminActions = fs.readFileSync(path.join(root, 'server/src/routes/admin-actions.js'), 'utf8');
const adminLogin = fs.readFileSync(path.join(root, 'server/src/routes/admin-login.js'), 'utf8');
const adminSecurity = fs.readFileSync(path.join(root, 'server/src/lib/adminSecurity.js'), 'utf8');

const bootstrapSlice = adminPanel.slice(
  adminPanel.indexOf('const specs = ['),
  adminPanel.indexOf('const results = await Promise.all(specs.map(readCollection));'),
);

for (const resource of ['partners', 'experts', 'events']) {
  assert.ok(
    bootstrapSlice.includes(`fetchAdminEntityList('${resource}', 1000)`),
    `Admin bootstrap must load ${resource} through entity:list, not direct client Firestore.`,
  );
  assert.ok(
    !bootstrapSlice.includes(`collection(db, '${resource}')`),
    `Admin bootstrap must not call direct getDocs(collection(db, '${resource}')).`,
  );
  assert.match(
    adminActions,
    new RegExp(`${resource}: \\{ orderBy: null, limit: 1000 \\}`),
    `Backend entity:list must allow ${resource}.`,
  );
}

assert.ok(adminPanel.includes('durationMs: Math.round(performance.now() - startedAt)'), 'Admin loader must record per-source duration diagnostics.');
assert.ok(adminPanel.includes('timings: Object.fromEntries'), 'Admin loader must expose timings in adminLoadInfo.');
assert.ok(adminPanel.includes('adminTokenCacheRef'), 'Admin API loaders must share a short-lived Firebase token cache.');
assert.ok(adminPanel.includes("stage: tokenBundle.cached ? 'token_reused' : 'token_received'"), 'Admin auth diagnostics must expose token reuse.');
assert.ok(adminLogin.includes('const combinedUser = { ...persistedUser, ...user, id:'), 'Admin login must combine canonical and persisted identity data before checking roles.');
assert.ok(adminLogin.includes('const role = getPrimaryRole(combinedUser);'), 'Admin login must resolve the role from the complete canonical identity.');
assert.ok(adminLogin.includes('const uid = String(userId || combinedUser.id'), 'Native APG admin sessions must use the canonical Identity user id.');
assert.ok(adminLogin.includes('combinedUser.firebaseUid') && adminLogin.includes('combinedUser.authUid'), 'Legacy credential ids must remain available during the native Identity transition.');
assert.ok(adminSecurity.includes('findUserByIdentityUid'), 'AdminGuard must resolve native APG session identities by canonical uid.');

console.log('Admin loading pipeline regression passed');
