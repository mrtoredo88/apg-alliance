import fs from 'node:fs';
import path from 'node:path';

export function finding(input = {}) {
  return {
    scanner: input.scanner || 'unknown',
    severity: input.severity || 'error',
    category: input.category || 'runtime',
    fingerprint: input.fingerprint || `${input.category || 'runtime'}:${input.message || 'unknown'}`,
    message: input.message || 'Unknown quality finding',
    location: input.location || '',
    evidence: input.evidence || null,
  };
}

export function groupRootCauses(findings = []) {
  const groups = new Map();
  findings.forEach(item => {
    const key = item.fingerprint || `${item.category}:${item.message}`;
    const current = groups.get(key) || {
      fingerprint: key,
      category: item.category,
      severity: item.severity,
      probableRootCause: item.message,
      occurrences: 0,
      scanners: new Set(),
      locations: new Set(),
    };
    current.occurrences += 1;
    current.scanners.add(item.scanner);
    if (item.location) current.locations.add(item.location);
    if (item.severity === 'critical') current.severity = 'critical';
    groups.set(key, current);
  });
  return [...groups.values()]
    .map(group => ({ ...group, scanners: [...group.scanners], locations: [...group.locations].slice(0, 20) }))
    .sort((a, b) => b.occurrences - a.occurrences);
}

export function createQualityReport({ scans = [], startedAt, metadata = {} } = {}) {
  const findings = scans.flatMap(scan => scan.findings || []).map(finding);
  const critical = findings.filter(item => item.severity === 'critical').length;
  const errors = findings.filter(item => item.severity === 'error').length;
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    durationMs: Math.max(0, Date.now() - Number(startedAt || Date.now())),
    status: critical || errors ? 'FAIL' : 'PASS',
    summary: {
      scanners: scans.length,
      passed: scans.filter(scan => scan.status === 'PASS').length,
      findings: findings.length,
      critical,
      errors,
      warnings: findings.filter(item => item.severity === 'warning').length,
      rootCauses: groupRootCauses(findings).length,
    },
    scans,
    rootCauses: groupRootCauses(findings),
    metadata,
  };
}

export function writeQualityReport(report, target = '.quality/latest.json') {
  const absolute = path.resolve(target);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(report, null, 2)}\n`);
  return absolute;
}
