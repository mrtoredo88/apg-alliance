import assert from 'node:assert/strict';
import { createReleasePlan } from './release-change-plan.mjs';

const frontendOnly = createReleasePlan(['src/UserApp.jsx']);
assert.equal(frontendOnly.frontend, true);
assert.equal(frontendOnly.backend, false);
assert.equal(frontendOnly.migrationOperator, false);

const cssOnly = createReleasePlan(['src/index.css']);
assert.equal(cssOnly.frontend, true);
assert.equal(cssOnly.backend, false);

const backendOnly = createReleasePlan(['server/src/routes/public-data.js']);
assert.equal(backendOnly.frontend, false);
assert.equal(backendOnly.backend, true);

const mixed = createReleasePlan(['src/UserApp.jsx', 'server/src/routes/public-data.js']);
assert.equal(mixed.frontend, true);
assert.equal(mixed.backend, true);

const migrationOnly = createReleasePlan(['ops/migration-operator/server.mjs']);
assert.equal(migrationOnly.frontend, false);
assert.equal(migrationOnly.backend, false);
assert.equal(migrationOnly.migrationOperator, true);

const sharedMigrationAndBackend = createReleasePlan(['server/src/apg/account/schema/account-core.sql']);
assert.equal(sharedMigrationAndBackend.backend, true);
assert.equal(sharedMigrationAndBackend.migrationOperator, true);

const rootDependencies = createReleasePlan(['package-lock.json']);
assert.equal(rootDependencies.frontend, true);
assert.equal(rootDependencies.backend, false);
assert.equal(rootDependencies.migrationOperator, true);

const docsOnly = createReleasePlan(['docs/notes.md']);
assert.equal(docsOnly.frontend, false);
assert.equal(docsOnly.backend, false);
assert.equal(docsOnly.migrationOperator, false);

const frontendDeployOnly = createReleasePlan(['deploy-frontend.sh']);
assert.equal(frontendDeployOnly.frontend, true);
assert.equal(frontendDeployOnly.backend, false);

const releaseInfraOnly = createReleasePlan(['scripts/release-change-plan.mjs']);
assert.equal(releaseInfraOnly.frontend, false);
assert.equal(releaseInfraOnly.backend, false);

console.log('Release change plan scenarios passed.');
