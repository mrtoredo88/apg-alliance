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
  'src/home/HomeHydrationEngine.js',
  'src/home/HomeHydrationScheduler.js',
  'src/home/HomeHydrationTask.js',
  'src/home/HomeHydrationMetrics.js',
  'src/home/index.js',
];

for (const file of files) {
  assert(existsSync(join(root, file)), `${file} exists`);
}

const task = read('src/home/HomeHydrationTask.js');
const scheduler = read('src/home/HomeHydrationScheduler.js');
const metrics = read('src/home/HomeHydrationMetrics.js');
const index = read('src/home/index.js');
const home = read('src/HomePanelV2.jsx');
const perfMetrics = read('src/performance/PerformanceMetrics.js');
const perfReport = read('src/performance/PerformanceReport.js');
const health = read('src/ApgHealthPage.jsx');
const packageJson = read('package.json');

[
  'SHELL',
  'NEWS',
  'PARTNERS',
  'EVENTS',
  'JOURNEY',
  'LOKI',
  'RECOMMENDATIONS',
].forEach(stage => assert(task.includes(stage), `home stage ${stage} is defined`));

[
  'home_shell_ready',
  'home_news_ready',
  'home_partners_ready',
  'home_events_ready',
  'home_journey_ready',
  'home_loki_ready',
  'home_recommendations_ready',
].forEach(mark => assert(`${task}\n${metrics}\n${perfMetrics}\n${perfReport}\n${health}`.includes(mark), `${mark} is wired`));

assert(scheduler.includes('requestIdleCallback'), 'Home hydration uses requestIdleCallback for late work');
assert(scheduler.includes('startHomeHydration'), 'Home scheduler can start');
assert(scheduler.indexOf('HOME_HYDRATION_STAGES.SHELL') < scheduler.indexOf('HOME_HYDRATION_STAGES.NEWS'), 'Shell is scheduled before News');
assert(scheduler.indexOf('HOME_HYDRATION_STAGES.NEWS') < scheduler.indexOf('HOME_HYDRATION_STAGES.PARTNERS'), 'News is scheduled before Partners');
assert(scheduler.indexOf('HOME_HYDRATION_STAGES.PARTNERS') < scheduler.indexOf('HOME_HYDRATION_STAGES.EVENTS'), 'Partners is scheduled before Events');
assert(scheduler.indexOf('HOME_HYDRATION_STAGES.EVENTS') < scheduler.indexOf('HOME_HYDRATION_STAGES.JOURNEY'), 'Events is scheduled before Journey');
assert(scheduler.indexOf('HOME_HYDRATION_STAGES.JOURNEY') < scheduler.indexOf('HOME_HYDRATION_STAGES.LOKI'), 'Journey is scheduled before Loki');
assert(scheduler.indexOf('HOME_HYDRATION_STAGES.LOKI') < scheduler.indexOf('HOME_HYDRATION_STAGES.RECOMMENDATIONS'), 'Loki is scheduled before Recommendations');
assert(metrics.includes("markPerformanceStage('home_ready'"), 'Shell marks Home Ready');
assert(index.includes('HomeHydrationEngine'), 'Home index exports engine');

assert(home.includes('createInitialHomeHydrationState'), 'Home creates hydration state');
assert(home.includes('startHomeHydration'), 'Home starts hydration scheduler');
assert(home.includes('data-home-hydration-placeholder'), 'Home renders hydration placeholders');
assert(home.includes('HOME_HYDRATION_STAGES.NEWS'), 'Home gates News');
assert(home.includes('HOME_HYDRATION_STAGES.PARTNERS'), 'Home gates Partners');
assert(home.includes('HOME_HYDRATION_STAGES.EVENTS'), 'Home gates Events');
assert(home.includes('HOME_HYDRATION_STAGES.JOURNEY'), 'Home gates Journey');
assert(home.includes('HOME_HYDRATION_STAGES.RECOMMENDATIONS'), 'Home gates Recommendations');
assert(!home.includes('firebase/firestore'), 'Home hydration does not add Firestore reads');

assert(perfMetrics.includes('homeShellMs'), 'Performance metrics expose Home Shell');
assert(perfMetrics.includes('homeRecommendationsMs'), 'Performance metrics expose Recommendations');
assert(perfReport.includes('Home Shell'), 'Performance export includes Home Shell');
assert(health.includes('Home Hydration Timeline'), 'APG Health renders Home Hydration Timeline');
assert(packageJson.includes('test:home-hydration'), 'package script registered');

if (process.exitCode) process.exit(process.exitCode);
