import assert from 'node:assert/strict';
import { CRITICAL_USER_JOURNEYS, QUALITY_ROLES, QUALITY_ROUTES, QUALITY_VIEWPORTS } from './catalog.mjs';
import { createQualityReport, groupRootCauses } from './core.mjs';
import { discoverEndpoints } from './api-scanner.mjs';
import { runPermissionScanner } from './permission-scanner.mjs';
import { runNavigationScanner } from './navigation-scanner.mjs';

assert.ok(CRITICAL_USER_JOURNEYS.length >= 30 && CRITICAL_USER_JOURNEYS.length <= 50);
assert.equal(new Set(CRITICAL_USER_JOURNEYS.map(item => item.id)).size, CRITICAL_USER_JOURNEYS.length);
assert.deepEqual(QUALITY_ROLES, ['owner', 'admin', 'moderator', 'partner', 'expert', 'user']);
assert.ok(QUALITY_ROUTES.length >= 10);
assert.deepEqual(QUALITY_VIEWPORTS.map(item => item.id), ['mobile', 'desktop']);
assert.ok(discoverEndpoints().length > 20, 'API scanner must discover the application endpoints');
assert.equal(runPermissionScanner().status, 'PASS');
assert.equal(runNavigationScanner().status, 'PASS');

const rootCauses = groupRootCauses([
  { scanner: 'ui', category: 'dialog', fingerprint: 'dialog:disabled', message: 'Dialog action disabled', location: '/admin/users' },
  { scanner: 'ui', category: 'dialog', fingerprint: 'dialog:disabled', message: 'Dialog action disabled', location: '/admin/events' },
]);
assert.equal(rootCauses.length, 1);
assert.equal(rootCauses[0].occurrences, 2);
assert.equal(createQualityReport({ scans: [{ id: 'contract', status: 'PASS', findings: [] }] }).status, 'PASS');
console.log(`APG Quality Platform v1 contract passed: ${CRITICAL_USER_JOURNEYS.length} critical journeys`);
