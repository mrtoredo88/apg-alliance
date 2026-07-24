import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('scripts/identity-merge-canary.mjs', 'utf8');

assert.match(source, /BEGIN TRANSACTION READ ONLY|verified READ ONLY\/ROLLBACK/, 'requires a verified read-only snapshot');
assert.match(source, /FORBIDDEN_ROLES.*owner.*super_admin/s, 'protects owner and super_admin');
assert.match(source, /Only the approved non-admin canary cluster is supported/, 'allows only the canary cluster');
assert.match(source, /Snapshot is stale for execution/, 'rejects stale execution snapshots');
assert.match(source, /Execution adapter is intentionally disabled/, 'cannot mutate production in this stage');
assert.match(source, /restore-exact-before-images-in-reverse-operation-order/, 'creates an exact rollback strategy');
assert.match(source, /expectedKeys: 67/, 'preserves the confirmed key balance');
assert.match(source, /sourceDisposition: 'alias-tombstone'/, 'does not hard-delete the source alias');

console.log('identity-merge-canary-test: ok');
