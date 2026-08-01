import assert from 'node:assert/strict';
import fs from 'node:fs';

const repository = fs.readFileSync('server/src/apg/account/repositories/ProfileRepository.js', 'utf8');
const service = fs.readFileSync('server/src/apg/account/services/AccountCoreService.js', 'utf8');
const admin = fs.readFileSync('server/src/routes/admin-actions.js', 'utf8');
const people = fs.readFileSync('server/src/routes/user-actions.js', 'utf8');
const publicData = fs.readFileSync('server/src/routes/public-data.js', 'utf8');

assert.match(repository, /listActiveCanonical[\s\S]*apg_account_profiles[\s\S]*apg_app_documents/, 'active users combine Account Core and migrated users');
assert.match(repository, /DISTINCT ON \(canonical_user_id\)/, 'aliases collapse to one canonical account');
assert.match(repository, /id: canonicalId, userId: canonicalId, canonicalUserId: canonicalId/, 'admin actions address the canonical account id');
assert.match(repository, /NOT IN \('archived', 'deleted', 'blocked', 'banned', 'merged'\)/, 'inactive accounts are excluded');
assert.match(service, /listActiveProfiles[\s\S]*listActiveCanonical/, 'Account Core exposes the authoritative active-user list');
assert.match(admin, /resource === 'users'[\s\S]*listActiveProfiles[\s\S]*account-core-active-canonical/, 'admin users use Account Core instead of the legacy collection');
assert.match(people, /searchAccountProfilesForConnections[\s\S]*apg_account_profiles[\s\S]*apg_app_documents/, 'People uses the same two account sources');
assert.match(publicData, /listActiveProfiles\(1000\)[\s\S]*userCount: activeProfiles\.length[\s\S]*account-core-active-canonical/, 'public counters use the same live active-user source');

console.log('active-user-count PASS');
