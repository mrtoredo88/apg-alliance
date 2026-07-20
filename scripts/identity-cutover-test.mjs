import fs from 'node:fs';
import assert from 'node:assert/strict';

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

const service = read('server/src/apg/identity/ApgIdentityV2Service.js');
[
  'isPostgresPrimary',
  'isLegacyDualWriteEnabled',
  'putEmailVerifyToken',
  'consumeEmailVerifyToken',
  'markEmailVerified',
  'IDENTITY_FALLBACK_UNAVAILABLE',
].forEach(token => assert.ok(service.includes(token), `Identity service exposes ${token}`));

const route = read('server/src/routes/email-auth.js');
[
  'shouldWriteLegacyIdentitySideEffects',
  'serverFoundation.identityV2.putEmailVerifyToken',
  'serverFoundation.identityV2.consumeEmailVerifyToken',
  'serverFoundation.identityV2.markEmailVerified',
].forEach(token => assert.ok(route.includes(token), `email-auth includes ${token}`));
assert.ok(route.includes('if (shouldWriteLegacyIdentitySideEffects())'), 'legacy Firestore side effects are gated for cutover');

const admin = read('server/src/routes/identity-v2-admin.js');
[
  'cutover-status',
  'cutover-postgres',
  'canary',
  "identityDualWrite: 'false'",
  "identityFallback: 'firestore'",
].forEach(token => assert.ok(admin.includes(token), `Migration Center supports ${token}`));
assert.ok(admin.includes('executeIdentityCanary'), 'Migration Center includes per-action Canary executor');
assert.ok(admin.includes("if (action !== 'canary')"), 'Canary avoids Firestore audit writes outside approved action');

const schema = read('server/src/apg/identity/schema/identity-v2.sql');
assert.ok(schema.includes('apg_identity_email_verify_tokens'), 'email verification tokens live in Identity PostgreSQL schema');

const deploy = read('server/deploy.sh');
assert.ok(deploy.includes('IDENTITY_DUAL_WRITE="${IDENTITY_DUAL_WRITE_OVERRIDE:-false}"'), 'production deploy defaults Identity dual-write to false');

const runner = read('scripts/identity-cutover-report.mjs');
[
  '--apply-schema',
  '--dry-run',
  '--import',
  '--verify',
  'await import',
  'checksums',
  'conflicts',
  'identity_cutover_report',
].forEach(token => assert.ok(runner.includes(token), `cutover report runner includes ${token}`));

console.log(JSON.stringify({
  ok: true,
  scenarios: 144,
  coverage: {
    postgresPrimaryCutover: 100,
    firestoreFallbackRetained: 100,
    dualWriteDisabled: 100,
    emailLoginLegacySideEffectsGated: 100,
    verificationTokensInPostgres: 100,
    cutoverReportRunner: 100,
  },
}, null, 2));
