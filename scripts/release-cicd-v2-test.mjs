import assert from 'node:assert/strict';
import { createReleasePlan } from './release-change-plan.mjs';
import { createAnalysis } from './release-report.mjs';
import { compareImageDigests, productionDigestFromRevisions } from './backend-image-decision.mjs';

const frontendOnly = createAnalysis(createReleasePlan(['src/UserApp.jsx']));
assert.equal(frontendOnly.frontend, 'REQUIRED');
assert.equal(frontendOnly.backend, 'SKIPPED');
assert.equal(frontendOnly.avoided.registryPushes, 1);

const backendNew = createAnalysis(createReleasePlan(['server/src/server.js']));
assert.equal(backendNew.backend, 'REQUIRED');
assert.equal(backendNew.dockerPush, 'PENDING_DIGEST_CHECK');
assert.equal(compareImageDigests('sha256:new', 'sha256:old').status, 'NEW_IMAGE');

const identical = compareImageDigests('sha256:same', 'same');
assert.equal(identical.identical, true);
assert.equal(identical.status, 'SKIPPED_IDENTICAL_IMAGE');

const mixed = createAnalysis(createReleasePlan(['src/UserApp.jsx', 'server/src/server.js']));
assert.equal(mixed.frontend, 'REQUIRED');
assert.equal(mixed.backend, 'REQUIRED');

const docsOnly = createAnalysis(createReleasePlan(['docs/release-notes.md']));
assert.equal(docsOnly.frontend, 'SKIPPED');
assert.equal(docsOnly.backend, 'SKIPPED');

const migrationOnly = createAnalysis(createReleasePlan(['ops/migration-operator/server.mjs']));
assert.equal(migrationOnly.migration, 'SKIPPED');
assert.match(migrationOnly.reasons.migration, /requires --deploy-migration-operator/);

const productionDigest = productionDigestFromRevisions([
  { status: 'OBSOLETE', image: { image_digest: 'sha256:old' } },
  { status: 'ACTIVE', image: { image_digest: 'sha256:production' } },
]);
assert.equal(productionDigest, 'sha256:production');
assert.throws(() => compareImageDigests('sha256:new', ''), /could not be resolved safely/);

console.log('Release CI/CD v2 scenarios passed.');
