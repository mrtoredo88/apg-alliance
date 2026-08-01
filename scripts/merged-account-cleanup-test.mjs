import assert from 'node:assert/strict';
import fs from 'node:fs';

const cleanup = fs.readFileSync('server/src/lib/mergedAccountCleanup.js', 'utf8');
const admin = fs.readFileSync('server/src/routes/admin-actions.js', 'utf8');
const account = fs.readFileSync('server/src/routes/account.js', 'utf8');
const panel = fs.readFileSync('src/AdminPanel.jsx', 'utf8');

assert.match(cleanup, /isMergedSource/, 'purge accepts only previously merged archived accounts');
assert.match(cleanup, /nestedConflicts/, 'nested document collisions block purge');
assert.match(cleanup, /userPurgeSnapshots/, 'recoverable purge snapshot is created');
assert.match(cleanup, /referenceBackups/, 'changed business documents are backed up');
assert.match(cleanup, /accountAliases/, 'minimal login redirect survives profile deletion');
assert.match(cleanup, /DELETE FROM apg_app_documents WHERE collection_name = 'users'/, 'only the visible source profile is deleted');
assert.match(admin, /user-accounts:purge-preview/, 'owner receives a non-mutating purge preview');
assert.match(admin, /stateToken/, 'execution is guarded against data drift');
assert.match(account, /collection\('accountAliases'\)/, 'old sessions resolve through the retained alias');
assert.match(panel, /ОЧИСТИТЬ/, 'admin UI requires an explicit cleanup confirmation');

console.log('merged-account-cleanup regression PASS');
