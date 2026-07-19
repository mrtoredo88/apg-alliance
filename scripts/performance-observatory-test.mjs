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
  'src/performance/PerformanceEngine.js',
  'src/performance/PerformanceTimeline.js',
  'src/performance/PerformanceMetrics.js',
  'src/performance/PerformanceReport.js',
  'src/performance/PerformanceStorage.js',
  'src/performance/PerformanceMarks.js',
  'src/performance/index.js',
];

for (const file of files) {
  assert(existsSync(join(root, file)), `${file} exists`);
}

const engine = read('src/performance/PerformanceEngine.js');
const timeline = read('src/performance/PerformanceTimeline.js');
const metrics = read('src/performance/PerformanceMetrics.js');
const report = read('src/performance/PerformanceReport.js');
const storage = read('src/performance/PerformanceStorage.js');
const marks = read('src/performance/PerformanceMarks.js');
const index = read('src/performance/index.js');
const main = read('src/main.jsx');
const app = read('src/App.jsx');
const userApp = read('src/UserApp.jsx');
const home = read('src/HomePanelV2.jsx');
const loki = read('src/loki/LokiProvider.jsx');
const pwa = read('src/pwa/PwaUpdateManager.js');
const health = read('src/ApgHealthPage.jsx');
const packageJson = read('package.json');
const indexHtml = read('index.html');

assert(engine.includes('installPerformanceObservatory'), 'PerformanceEngine installs observatory');
assert(engine.includes('finalizePerformanceRun'), 'PerformanceEngine finalizes local run');
assert(engine.includes('window.__APG_PERFORMANCE_MARK__'), 'PerformanceEngine exposes runtime mark hook');
assert(timeline.includes('SLOW_STAGE_MS = 500'), 'Timeline flags slow stages at 500ms');
assert(timeline.includes('CRITICAL_STAGE_MS = 1000'), 'Timeline flags critical stages at 1000ms');
assert(metrics.includes('buildStageMetrics'), 'Metrics builds startup metrics');
assert(metrics.includes('estimateStartupFps'), 'Metrics estimates startup FPS');
assert(report.includes('buildPerformanceExport'), 'Report exports copyable report');
assert(report.includes('getPwaUpdateDiagnostics'), 'Report includes service worker diagnostics');
assert(storage.includes('PERFORMANCE_HISTORY_LIMIT = 20'), 'Storage keeps last 20 runs');
assert(storage.includes('localStorage'), 'Storage is localStorage only');
assert(marks.includes('countRender'), 'Marks counts React renders');
assert(marks.includes('markLokiStage'), 'Marks supports Loki stages');
assert(index.includes('PerformanceEngine'), 'Index re-exports engine');

[
  'index_loaded',
  'main_module_loaded',
  'react_render_start',
  'react_render_complete',
  'router_ready',
  'userapp_mount',
  'home_ready',
  'firebase_ready',
  'auth_ready',
  'journey_ready',
  'loki_ready',
  'workspace_ready',
  'idle_complete',
  'bootstrap_critical_start',
  'bootstrap_critical_complete',
  'bootstrap_interactive_start',
  'bootstrap_interactive_complete',
  'bootstrap_idle_start',
  'bootstrap_idle_complete',
].forEach(stage => {
  const corpus = `${indexHtml}\n${main}\n${app}\n${userApp}\n${home}\n${engine}\n${timeline}\n${metrics}\n${report}\n${health}`;
  assert(corpus.includes(stage), `startup stage ${stage} is wired`);
});

[
  'loki_conversation',
  'loki_knowledge',
  'loki_reasoning',
  'loki_capability',
  'loki_skills',
  'loki_execution',
  'loki_decision',
  'loki_evaluation',
  'loki_response',
].forEach(stage => {
  assert(loki.includes(stage.replace('loki_', '')) || marks.includes(stage), `Loki stage ${stage} is observable`);
});

[
  'sw_register_start',
  'sw_register',
  'update_check_start',
  'update_check',
  'cache_ready_start',
  'cache_ready',
].forEach(stage => {
  assert(pwa.includes(stage), `PWA stage ${stage} is observable`);
});

assert(main.includes('installPerformanceObservatory'), 'main installs observatory');
assert(main.includes('markPerformanceStage'), 'main writes performance marks');
assert(app.includes('react_render_complete'), 'App marks render complete');
assert(userApp.includes('markFirebase'), 'UserApp marks Firebase');
assert(userApp.includes('markRouteReady'), 'UserApp marks routes');
assert(home.includes('countRender'), 'Home counts renders');
assert(health.includes("['performance', 'Perf']"), 'APG Health has Performance tab');
assert(health.includes('Startup Timeline'), 'Performance tab shows startup timeline');
assert(health.includes('Bootstrap Timeline'), 'Performance tab shows bootstrap timeline');
assert(health.includes('Последние 20 запусков'), 'Performance tab shows last launches');
assert(health.includes('Скопировать отчёт'), 'Performance tab can copy export');
assert(packageJson.includes('test:performance-observatory'), 'package script registered');

if (process.exitCode) process.exit(process.exitCode);
