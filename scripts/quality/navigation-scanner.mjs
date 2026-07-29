import fs from 'node:fs';
import process from 'node:process';
import { QUALITY_ROUTES, CRITICAL_USER_JOURNEYS } from './catalog.mjs';
import { finding } from './core.mjs';

export function runNavigationScanner() {
  const source = ['src/UserApp.jsx', 'src/App.jsx', 'src/main.jsx'].filter(fs.existsSync).map(file => fs.readFileSync(file, 'utf8')).join('\n');
  const findings = [];
  if (!fs.existsSync('public/network-diagnostics-lite')) findings.push(finding({
    scanner: 'navigation', severity: 'critical', category: 'fallback',
    fingerprint: 'navigation:network-diagnostics-lite', message: 'Standalone network diagnostics route is missing', location: 'public/network-diagnostics-lite',
  }));
  const requiredSignals = [
    ['history', /popstate|hashchange|history\./],
    ['deep-links', /URLSearchParams|location\.hash|location\.pathname/],
    ['qr', /qr|scanner/i],
    ['pwa', /serviceWorker|Pwa/i],
  ];
  requiredSignals.forEach(([id, pattern]) => {
    if (!pattern.test(source)) findings.push(finding({
      scanner: 'navigation', category: 'contract', fingerprint: `navigation:${id}`,
      message: `Navigation contract is missing: ${id}`, location: 'application shell',
    }));
  });
  return {
    id: 'navigation',
    status: findings.length ? 'FAIL' : 'PASS',
    metrics: { routes: QUALITY_ROUTES.length, criticalJourneys: CRITICAL_USER_JOURNEYS.length },
    findings,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runNavigationScanner();
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exitCode = 1;
}
