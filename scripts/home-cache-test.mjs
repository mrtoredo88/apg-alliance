import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function ok(condition, message) {
  assert.equal(Boolean(condition), true, message);
  console.log(`OK ${message}`);
}

function createStorage() {
  const map = new Map();
  return {
    get length() { return map.size; },
    key(index) { return [...map.keys()][index] || null; },
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(String(key), String(value)); },
    removeItem(key) { map.delete(String(key)); },
    clear() { map.clear(); },
  };
}

globalThis.localStorage = createStorage();
globalThis.window = {
  __APG_BUILD_VERSION__: 'test-build',
  __APG_HOME_CACHE__: null,
  dispatchEvent: () => true,
};
globalThis.CustomEvent = class CustomEventMock {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
};
globalThis.performance = { now: () => Date.now() };
globalThis.Blob = globalThis.Blob || class BlobMock {
  constructor(parts = []) { this.size = parts.join('').length; }
};

const files = [
  'src/home/cache/HomeCache.js',
  'src/home/cache/HomeCacheEngine.js',
  'src/home/cache/HomeCacheStorage.js',
  'src/home/cache/HomeCacheMetrics.js',
  'src/home/cache/HomeCacheValidator.js',
  'src/home/cache/index.js',
];

files.forEach(file => ok(existsSync(join(root, file)), `${file} exists`));

const userApp = read('src/UserApp.jsx');
const health = read('src/ApgHealthPage.jsx');
const metrics = read('src/performance/PerformanceMetrics.js');
const report = read('src/performance/PerformanceReport.js');
const packageJson = read('package.json');

[
  'restoreHomeCache',
  'refreshHomeCacheSection',
  'HOME_CACHE_SECTIONS.PARTNERS',
  'HOME_CACHE_SECTIONS.EVENTS',
  'HOME_CACHE_SECTIONS.NEWS',
  'homeHasRestoredCache',
].forEach(token => ok(userApp.includes(token), `UserApp wires ${token}`));

[
  'home_cache_restore',
  'home_cache_hit',
  'home_cache_miss',
  'home_cache_refresh',
  'home_cache_update',
].forEach(stage => {
  ok(`${userApp}\n${health}\n${metrics}\n${report}`.includes(stage), `${stage} is observable`);
});

ok(health.includes('Home Cache'), 'APG Health shows Home Cache');
ok(report.includes('homeCache'), 'Performance report includes homeCache snapshot');
ok(packageJson.includes('test:home-cache'), 'package script registered');

const cache = await import('../src/home/cache/index.js');

const publicPartner = { id: 'p1', name: 'Cafe', catalogPublished: true, token: 'secret' };
const writeResult = cache.writeHomeCacheSection(cache.HOME_CACHE_SECTIONS.PARTNERS, [publicPartner], { buildVersion: 'test-build' });
ok(writeResult.ok, 'writes partners cache');
ok(writeResult.changed, 'first partners write is changed');

const partners = cache.readHomeCacheSection(cache.HOME_CACHE_SECTIONS.PARTNERS, { buildVersion: 'test-build' });
ok(partners.status === 'hit', 'reads partners cache hit');
ok(partners.value[0].token === undefined, 'validator strips token-like fields');

const sameWrite = cache.writeHomeCacheSection(cache.HOME_CACHE_SECTIONS.PARTNERS, [publicPartner], { buildVersion: 'test-build' });
ok(sameWrite.changed === false, 'unchanged section is detected');

const missed = cache.readHomeCacheSection(cache.HOME_CACHE_SECTIONS.PARTNERS, { buildVersion: 'other-build' });
ok(missed.status === 'miss' && missed.reason === 'build_mismatch', 'build version mismatch invalidates cache');

cache.writeHomeCacheSection(cache.HOME_CACHE_SECTIONS.NEWS, [{ id: 'n1', title: 'News' }], { buildVersion: 'test-build' });
const key = cache.HOME_CACHE_STORAGE_KEYS[cache.HOME_CACHE_SECTIONS.NEWS];
const record = JSON.parse(localStorage.getItem(key));
record.savedAt = Date.now() - (6 * 60 * 1000);
localStorage.setItem(key, JSON.stringify(record));
const expired = cache.readHomeCacheSection(cache.HOME_CACHE_SECTIONS.NEWS, { buildVersion: 'test-build' });
ok(expired.status === 'expired' && Array.isArray(expired.value), 'expired cache can be shown but is marked expired');

localStorage.setItem(key, '{broken');
const corrupt = cache.readHomeCacheSection(cache.HOME_CACHE_SECTIONS.NEWS, { buildVersion: 'test-build' });
ok(corrupt.status === 'miss', 'corrupt cache is rejected');
ok(localStorage.getItem(key) === null, 'corrupt cache is removed');

cache.writeHomeCacheSection(cache.HOME_CACHE_SECTIONS.PARTNERS, [publicPartner], { buildVersion: 'test-build' });
const restored = cache.restoreHomeCache({ buildVersion: 'test-build' });
ok(restored.snapshot.hits >= 1, 'restore returns hit snapshot');
ok(restored.snapshot.hasRestoredData, 'restore marks visible Home data');

if (process.exitCode) process.exit(process.exitCode);
