import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { runApiScanner } from './api-scanner.mjs';
import { runPermissionScanner } from './permission-scanner.mjs';
import { runNavigationScanner } from './navigation-scanner.mjs';
import { runUiScanner } from './ui-scanner.mjs';
import { createQualityReport, writeQualityReport } from './core.mjs';
import { CRITICAL_USER_JOURNEYS } from './catalog.mjs';

const args = new Set(process.argv.slice(2));
const startedAt = Date.now();
const scans = [];
const commands = [
  ['unit', ['node', 'scripts/quality/quality-platform-test.mjs']],
  ['integration', ['npm', 'run', 'test:account-integration']],
  ['regression', ['npm', 'run', 'test:admin-interactions']],
  ['smoke', ['npm', 'run', 'test:auth-lifecycle']],
];

for (const [id, [command, ...commandArgs]] of commands) {
  const result = spawnSync(command, commandArgs, { encoding: 'utf8', env: process.env });
  scans.push({
    id,
    status: result.status === 0 ? 'PASS' : 'FAIL',
    metrics: { exitCode: result.status ?? 1 },
    findings: result.status === 0 ? [] : [{
      scanner: id, severity: 'critical', category: 'test', fingerprint: `test:${id}`,
      message: (result.stderr || result.stdout || `${id} failed`).slice(-2000), location: commandArgs.join(' '),
    }],
  });
}

scans.push(runPermissionScanner());
scans.push(runNavigationScanner());
scans.push(await runApiScanner());
if (args.has('--browser')) scans.push(await runUiScanner());

const report = createQualityReport({
  scans,
  startedAt,
  metadata: { criticalJourneys: CRITICAL_USER_JOURNEYS.length, browserScan: args.has('--browser') },
});
const output = writeQualityReport(report, process.env.QUALITY_REPORT_PATH || '.quality/latest.json');
const failures = scans
  .flatMap(scan => (scan.findings || []).map(item => ({
    scanner: scan.id,
    severity: item.severity,
    fingerprint: item.fingerprint,
    message: item.message,
    location: item.location,
  })))
  .filter(item => ['critical', 'error'].includes(String(item.severity || '').toLowerCase()));
console.log(JSON.stringify({ status: report.status, summary: report.summary, failures, report: output }, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
