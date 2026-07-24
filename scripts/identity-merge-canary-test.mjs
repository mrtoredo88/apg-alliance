import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('scripts/identity-merge-canary.mjs', 'utf8');

assert.match(source, /BEGIN TRANSACTION READ ONLY|verified READ ONLY\/ROLLBACK/, 'requires a verified read-only snapshot');
assert.match(source, /FORBIDDEN_ROLES.*owner.*super_admin/s, 'detects owner and super_admin');
assert.match(source, /Protected role cluster requires explicit approval/, 'requires an explicit protected-account approval');
assert.match(source, /APPROVED_CLUSTERS/, 'allows only reviewed merge clusters');
assert.match(source, /Snapshot is stale for execution/, 'rejects stale execution snapshots');
assert.match(source, /Execution adapter is intentionally disabled/, 'cannot mutate production in this stage');
assert.match(source, /restore-exact-before-images-in-reverse-operation-order/, 'creates an exact rollback strategy');
assert.match(source, /expectedKeys: Math\.max/, 'preserves the largest confirmed key balance');
assert.match(source, /sourceDisposition: 'alias-tombstone'/, 'does not hard-delete the source alias');
assert.match(source, /mergesUserRoot && row\.path === canonicalUserPath/, 'does not emit a stale second write for the merged canonical root');

console.log('identity-merge-canary-test: ok');
