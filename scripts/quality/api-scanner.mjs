import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { finding } from './core.mjs';

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

export function discoverEndpoints(root = process.cwd()) {
  const files = [...walk(path.join(root, 'api')), ...walk(path.join(root, 'server/src/routes'))]
    .filter(file => /\.(js|mjs)$/.test(file));
  const endpoints = new Map();
  files.forEach(file => {
    const source = fs.readFileSync(file, 'utf8');
    const relative = path.relative(root, file);
    if (relative.startsWith('api/')) {
      const route = `/${relative.replace(/\.(js|mjs)$/, '').replace(/\/index$/, '')}`;
      endpoints.set(route, { route, files: [relative], methods: [...new Set([...source.matchAll(/method\s*(?:===|!==)\s*['"]([A-Z]+)['"]/g)].map(match => match[1]))] });
    }
    for (const match of source.matchAll(/\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g)) {
      const route = match[2].startsWith('/') ? match[2] : `/${match[2]}`;
      const current = endpoints.get(route) || { route, files: [], methods: [] };
      current.files.push(relative);
      current.methods.push(match[1].toUpperCase());
      endpoints.set(route, current);
    }
  });
  return [...endpoints.values()].map(item => ({ ...item, files: [...new Set(item.files)], methods: [...new Set(item.methods.length ? item.methods : ['ANY'])] }));
}

export async function runApiScanner(options = {}) {
  const endpoints = discoverEndpoints(options.root);
  const baseUrl = options.baseUrl || process.env.QUALITY_API_BASE_URL || '';
  const findings = [];
  const timings = [];
  for (const endpoint of endpoints) {
    if (!endpoint.files.length) findings.push(finding({ scanner: 'api', category: 'contract', fingerprint: `orphan:${endpoint.route}`, message: 'Endpoint has no implementation file', location: endpoint.route }));
    if (!baseUrl || !endpoint.methods.some(method => ['GET', 'ANY'].includes(method))) continue;
    const startedAt = Date.now();
    const response = await fetch(new URL(endpoint.route, baseUrl), { signal: AbortSignal.timeout(10000) }).catch(error => {
      findings.push(finding({ scanner: 'api', category: 'network', fingerprint: `api-network:${endpoint.route}`, message: error.message, location: endpoint.route }));
      return null;
    });
    timings.push({ route: endpoint.route, durationMs: Date.now() - startedAt, status: response?.status || 0 });
    if (response && response.status >= 500) findings.push(finding({ scanner: 'api', category: 'http', fingerprint: `api-5xx:${endpoint.route}`, message: `HTTP ${response.status}`, location: endpoint.route }));
  }
  return {
    id: 'api',
    status: findings.some(item => ['critical', 'error'].includes(item.severity)) ? 'FAIL' : 'PASS',
    metrics: { endpoints: endpoints.length, probed: timings.length, slow: timings.filter(item => item.durationMs > 2000).length },
    endpoints,
    timings,
    findings,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runApiScanner();
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exitCode = 1;
}
