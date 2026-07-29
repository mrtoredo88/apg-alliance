import fs from 'node:fs';
import process from 'node:process';
import { QUALITY_ROLES, CRITICAL_USER_JOURNEYS } from './catalog.mjs';
import { finding } from './core.mjs';

export function runPermissionScanner() {
  const sources = ['src/roleEngine.js', 'src/AdminPanel.jsx', 'server/src/auth/permissions.js']
    .filter(file => fs.existsSync(file))
    .map(file => fs.readFileSync(file, 'utf8'))
    .join('\n')
    .toLowerCase();
  const findings = [];
  QUALITY_ROLES.forEach(role => {
    if (!sources.includes(role)) findings.push(finding({
      scanner: 'permissions', severity: 'critical', category: 'role',
      fingerprint: `missing-role:${role}`, message: `Role has no permission contract: ${role}`, location: 'role engine',
    }));
  });
  CRITICAL_USER_JOURNEYS.forEach(journey => {
    if (!QUALITY_ROLES.includes(journey.role)) findings.push(finding({
      scanner: 'permissions', category: 'journey-role', fingerprint: `journey-role:${journey.id}`,
      message: `Unknown journey role: ${journey.role}`, location: journey.id,
    }));
  });
  return {
    id: 'permissions',
    status: findings.length ? 'FAIL' : 'PASS',
    metrics: { roles: QUALITY_ROLES.length, roleJourneys: CRITICAL_USER_JOURNEYS.length },
    findings,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runPermissionScanner();
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exitCode = 1;
}
