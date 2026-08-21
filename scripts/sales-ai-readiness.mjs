import assert from 'node:assert/strict';
import fs from 'node:fs';
import process from 'node:process';
import { buildScoutQuery } from '../server/src/lib/salesScout.js';

const checks = [];
const check = (id, fn) => {
  try {
    fn();
    checks.push({ id, status: 'PASS' });
  } catch (error) {
    checks.push({ id, status: 'FAIL', message: error?.message || String(error) });
  }
};

check('server-route-file', () => assert.ok(fs.existsSync('server/src/routes/sales-ai.js')));
check('scout-provider-file', () => assert.ok(fs.existsSync('server/src/lib/salesScout.js')));
check('admin-page-file', () => assert.ok(fs.existsSync('src/salesAi/SalesAiAdminPage.jsx')));
check('dashboard-file', () => assert.ok(fs.existsSync('src/salesAi/SalesAiDashboard.jsx')));
check('safe-env-template', () => {
  const template = fs.readFileSync('server/.env.example', 'utf8');
  assert.match(template, /^TWOGIS_API_KEY=/m);
  assert.doesNotMatch(template, /TWOGIS_API_KEY=\S{8,}/);
});
check('env-is-ignored', () => {
  const ignored = fs.readFileSync('server/.gitignore', 'utf8');
  assert.match(ignored, /(^|\n)\.env(\n|$)/);
});
check('server-registration', () => {
  const source = fs.readFileSync('server/src/server.js', 'utf8');
  assert.match(source, /sales-ai/);
});
check('admin-route-registration', () => {
  const source = fs.readFileSync('src/App.jsx', 'utf8');
  assert.match(source, /\/admin\/sales-ai/);
  assert.match(source, /SalesAiAdminPage/);
});
check('deploy-secret-passthrough', () => {
  const source = fs.readFileSync('server/deploy.sh', 'utf8');
  assert.match(source, /get_env TWOGIS_API_KEY/);
  assert.match(source, /--environment TWOGIS_API_KEY=/);
});
check('2gis-query-contract', () => {
  const query = buildScoutQuery({ city: 'Зеленоград', district: 'Крюково', category: 'food', query: 'семейные' });
  assert.match(query, /Зеленоград/);
  assert.match(query, /Крюково/);
  assert.match(query, /кафе ресторан/);
});
check('no-embedded-2gis-secret', () => {
  const files = [
    'server/src/lib/salesScout.js',
    'server/src/routes/sales-ai.js',
    'src/salesAi/SalesAiDashboard.jsx',
    'server/deploy.sh',
    'server/.env.example',
  ];
  const source = files.map(file => fs.readFileSync(file, 'utf8')).join('\n');
  assert.doesNotMatch(source, /TWOGIS_API_KEY\s*=\s*['\"][^'\"]+['\"]/);
  assert.doesNotMatch(source, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
});

const failed = checks.filter(item => item.status !== 'PASS');
const result = {
  status: failed.length ? 'FAIL' : 'PASS',
  checks,
  deploymentSecretPresent: Boolean(process.env.TWOGIS_API_KEY || process.env.DGIS_API_KEY),
  note: 'Live 2GIS network call is intentionally not performed by readiness check.',
};

console.log(JSON.stringify(result, null, 2));
if (failed.length) process.exitCode = 1;
