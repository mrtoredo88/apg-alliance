import assert from 'node:assert/strict';
import fs from 'node:fs';

const identityAdapter = fs.readFileSync('server/src/apg/infrastructure/adapters/PostgresIdentityAdapter.js', 'utf8');
const accountAdapter = fs.readFileSync('server/src/apg/account/adapters/PostgresAccountAdapter.js', 'utf8');
const identityService = fs.readFileSync('server/src/apg/identity/ApgIdentityV2Service.js', 'utf8');
const emailRoute = fs.readFileSync('server/src/routes/email-auth.js', 'utf8');
const emailUi = fs.readFileSync('src/EmailAuth.jsx', 'utf8');
const cabinetRepository = fs.readFileSync('server/src/apg/account/repositories/CabinetRepository.js', 'utf8');
const userActions = fs.readFileSync('server/src/routes/user-actions.js', 'utf8');

assert.match(identityAdapter, /pg_advisory_lock\(hashtext\(\$1\)\)/, 'identity schema startup is serialized across instances');
assert.match(identityAdapter, /pg_advisory_unlock\(hashtext\(\$1\)\)/, 'schema startup always releases its advisory lock');
assert.match(accountAdapter, /runSchemaMigration\('apg:account-core-schema'/, 'account schema startup uses a distinct distributed lock');
assert.match(identityService, /code === '40P01' \|\| code === '40001'/, 'email identity retries PostgreSQL deadlocks and serialization failures');
assert.match(identityService, /attempt < 2/, 'email identity retries are bounded');
assert.match(emailRoute, /EMAIL_AUTH_TEMPORARILY_UNAVAILABLE/, 'raw database errors are mapped to a stable public auth error');
assert.match(emailUi, /sendInFlightRef\.current/, 'OTP sending remains guarded against repeat clicks');
assert.match(emailUi, /verifyInFlightRef\.current/, 'OTP verification remains guarded against repeat clicks');
assert.match(cabinetRepository, /claimOwnedEntitiesByEmail/, 'a verified owner email can materialize its partner cabinet at runtime');
assert.match(cabinetRepository, /ownerEmail.*connectionEmail/, 'both supported partner contact email fields are resolved');
assert.match(userActions, /claimOwnedEntitiesByEmail\(\{ userId, email: verifiedOwnerEmail \}\)/, 'profile sync claims matching cabinets before the next account load');

console.log('email-auth-deadlock-regression-test: ok');
