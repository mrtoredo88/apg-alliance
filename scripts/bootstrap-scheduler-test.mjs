import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${message}`);
  }
}

const files = [
  'src/bootstrap/BootstrapScheduler.js',
  'src/bootstrap/BootstrapTask.js',
  'src/bootstrap/BootstrapQueue.js',
  'src/bootstrap/BootstrapMetrics.js',
  'src/bootstrap/index.js',
];

for (const file of files) {
  assert(existsSync(join(root, file)), `${file} exists`);
}

const scheduler = read('src/bootstrap/BootstrapScheduler.js');
const task = read('src/bootstrap/BootstrapTask.js');
const queue = read('src/bootstrap/BootstrapQueue.js');
const metrics = read('src/bootstrap/BootstrapMetrics.js');
const main = read('src/main.jsx');
const userApp = read('src/UserApp.jsx');
const perfMetrics = read('src/performance/PerformanceMetrics.js');
const perfReport = read('src/performance/PerformanceReport.js');
const health = read('src/ApgHealthPage.jsx');
const packageJson = read('package.json');

assert(task.includes('CRITICAL') && task.includes('INTERACTIVE') && task.includes('IDLE'), 'three bootstrap priorities are defined');
assert(queue.includes('requestIdleCallback'), 'idle queue uses requestIdleCallback when available');
assert(queue.includes('setTimeout'), 'idle queue has safe fallback');
assert(scheduler.includes('registerBootstrapTask'), 'scheduler registers tasks');
assert(scheduler.includes('startBootstrapScheduler'), 'scheduler can start');
assert(scheduler.includes('timeoutMs'), 'scheduler supports task timeout');
assert(metrics.includes('bootstrap_') && metrics.includes('durationMs'), 'bootstrap metrics mark queue durations');

assert(main.includes("id: 'react_render'"), 'React render registered as task');
assert(main.includes('BOOTSTRAP_PRIORITIES.CRITICAL'), 'critical queue used in main');
assert(main.includes("id: 'pwa_update_manager'"), 'PWA update manager registered as task');
assert(main.includes('BOOTSTRAP_PRIORITIES.INTERACTIVE'), 'interactive queue used in main');
assert(main.includes("id: 'pwa_runtime_diagnostics'"), 'runtime diagnostics registered as task');
assert(main.includes('BOOTSTRAP_PRIORITIES.IDLE'), 'idle queue used in main');
assert(!main.includes('.finally(renderApp)'), 'PWA update no longer blocks React render');
assert(main.indexOf("id: 'react_render'") < main.indexOf("id: 'pwa_update_manager'"), 'React task is registered before PWA update task');

assert(userApp.includes("id: 'userapp_pwa_diagnostics'"), 'UserApp PWA diagnostics scheduled');
assert(userApp.includes("id: 'userapp_intelligence_wiring'"), 'intelligence wiring scheduled');
assert(userApp.includes('wireAnalyticsCollector'), 'analytics wiring preserved');
assert(userApp.includes('wireAIMemory'), 'AI memory wiring preserved');
assert(userApp.includes('wireActivityTimeline'), 'timeline wiring preserved');

assert(perfMetrics.includes('bootstrapCriticalMs'), 'PerformanceMetrics exposes critical queue');
assert(perfMetrics.includes('bootstrapInteractiveMs'), 'PerformanceMetrics exposes interactive queue');
assert(perfMetrics.includes('bootstrapIdleMs'), 'PerformanceMetrics exposes idle queue');
assert(perfReport.includes('Bootstrap Critical'), 'Performance export includes bootstrap critical');
assert(perfReport.includes('getBootstrapSnapshot'), 'Performance report includes scheduler snapshot');
assert(health.includes('Bootstrap Timeline'), 'APG Health renders bootstrap timeline');
assert(health.includes('Critical queue'), 'APG Health shows critical queue metric');
assert(packageJson.includes('test:bootstrap-scheduler'), 'package script registered');

if (process.exitCode) process.exit(process.exitCode);
