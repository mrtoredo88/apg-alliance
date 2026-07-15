import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const adminPanel = fs.readFileSync(path.join(root, 'src/AdminPanel.jsx'), 'utf8');
const adminActions = fs.readFileSync(path.join(root, 'server/src/routes/admin-actions.js'), 'utf8');

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

console.log('Admin loading pipeline regression passed');
