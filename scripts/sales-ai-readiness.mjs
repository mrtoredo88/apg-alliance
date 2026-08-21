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
check('agent-route-file', () => assert.ok(fs.existsSync('server/src/routes/sales-ai-agents.js')));
check('agent-core-file', () => assert.ok(fs.existsSync('server/src/lib/salesAgents.js')));
check('scout-provider-file', () => assert.ok(fs.existsSync('server/src/lib/salesScout.js')));
check('admin-page-file', () => assert.ok(fs.existsSync('src/salesAi/SalesAiAdminPage.jsx')));
check('dashboard-file', () => assert.ok(fs.existsSync('src/salesAi/SalesAiDashboard.jsx')));
check('agent-ops-file', () => assert.ok(fs.existsSync('src/salesAi/SalesAiAgentOps.jsx')));
check('pipeline-test-file', () => assert.ok(fs.existsSync('scripts/sales-ai-pipeline-test.mjs')));

check('safe-env-template', () => {
  const template = fs.readFileSync('server/.env.example', 'utf8');
  const line = template.split(/\r?\n/).find(item => item.startsWith('TWOGIS_API_KEY='));
  assert.equal(line, 'TWOGIS_API_KEY=');
});

check('env-is-ignored', () => {
  const ignored = fs.readFileSync('server/.gitignore', 'utf8').split(/\r?\n/).map(item => item.trim());
  assert.ok(ignored.includes('.env'));
});

check('server-registration', () => {
  const source = fs.readFileSync('server/src/server.js', 'utf8');
  assert.ok(source.includes('salesAiRoutes'));
  assert.ok(source.includes('salesAiAgentRoutes'));
});

check('admin-route-registration', () => {
  const source = fs.readFileSync('src/App.jsx', 'utf8');
  assert.ok(source.includes('/admin/sales-ai'));
  assert.ok(source.includes('/admin/sales-ai/agents'));
  assert.ok(source.includes('SalesAiAdminPage'));
});

check('admin-entry-point', () => {
  const source = fs.readFileSync('src/App.jsx', 'utf8');
  assert.ok(source.includes('AdminPanelWithSalesAiShortcut'));
  assert.ok(source.includes('AI-отдел продаж'));
  assert.ok(source.includes('href="/admin/sales-ai"'));
});

check('five-agent-contract', () => {
  const scout = fs.readFileSync('server/src/lib/salesScout.js', 'utf8');
  const agents = fs.readFileSync('server/src/lib/salesAgents.js', 'utf8');
  const routes = fs.readFileSync('server/src/routes/sales-ai-agents.js', 'utf8');
  assert.ok(scout.includes('runSalesScout'));
  assert.ok(agents.includes('analyzeLead'));
  assert.ok(agents.includes('buildSalesOffer'));
  assert.ok(agents.includes('buildCommunicatorDraft'));
  assert.ok(agents.includes('buildManagerSummary'));
  assert.ok(routes.includes('communication:record'));
  assert.ok(routes.includes('manager:summary'));
});

check('human-in-the-loop-communication', () => {
  const ui = fs.readFileSync('src/salesAi/SalesAiAgentOps.jsx', 'utf8');
  assert.ok(ui.includes('ничего не отправляет без человека') || ui.includes('AI готовит черновики'));
  for (const forbidden of ['sendEmail', 'sendTelegram', 'sendVk']) assert.equal(ui.includes(forbidden), false);
});

check('deploy-secret-passthrough', () => {
  const source = fs.readFileSync('server/deploy.sh', 'utf8');
  assert.ok(source.includes('get_env TWOGIS_API_KEY'));
  assert.ok(source.includes('TWOGIS_API_KEY_VALUE'));
  assert.ok(source.includes('--environment TWOGIS_API_KEY="$TWOGIS_API_KEY_VALUE"'));
});

check('2gis-query-contract', () => {
  const query = buildScoutQuery({ city: 'Зеленоград', district: 'Крюково', category: 'food', query: 'семейные' });
  assert.match(query, /Зеленоград/);
  assert.match(query, /Крюково/);
  assert.match(query, /кафе ресторан/);
});

check('no-embedded-2gis-secret', () => {
  const scout = fs.readFileSync('server/src/lib/salesScout.js', 'utf8');
  const envTemplate = fs.readFileSync('server/.env.example', 'utf8');
  assert.equal(envTemplate.split(/\r?\n/).find(item => item.startsWith('TWOGIS_API_KEY=')), 'TWOGIS_API_KEY=');
  assert.equal(/TWOGIS_API_KEY\s*=\s*['"][^'"]+['"]/.test(scout), false);
  assert.equal(/DGIS_API_KEY\s*=\s*['"][^'"]+['"]/.test(scout), false);
});

const failed = checks.filter(item => item.status !== 'PASS');
const result = {
  status: failed.length ? 'FAIL' : 'PASS',
  checks,
  failed,
  deploymentSecretPresent: Boolean(process.env.TWOGIS_API_KEY || process.env.DGIS_API_KEY),
  note: 'Live 2GIS network call is intentionally not performed by readiness check.',
};

console.log(JSON.stringify(result, null, 2));
if (failed.length) process.exitCode = 1;
