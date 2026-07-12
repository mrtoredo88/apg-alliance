import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function createStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
    clear: () => data.clear(),
    dump: () => Object.fromEntries(data.entries()),
  };
}

const localStorage = createStorage({
  apg_build: 'v1',
  apg_cache_version: 'v1',
});
const sessionStorage = createStorage();
let fetchVersion = 'v1';
let reloadCount = 0;
let registerCount = 0;
let cacheKeys = ['apg-old-cache'];
const cachesMock = {
  keys: async () => cacheKeys,
  delete: async key => {
    cacheKeys = cacheKeys.filter(item => item !== key);
    return true;
  },
};
const swMessages = [];

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage,
    sessionStorage,
    caches: cachesMock,
    location: { reload: () => { reloadCount += 1; } },
    __APG_BOOT_MARK: () => {},
  },
});
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    serviceWorker: {
      controller: { postMessage: message => swMessages.push(message) },
      addEventListener: () => {},
      register: async () => {
        registerCount += 1;
        return { active: { postMessage: message => swMessages.push(message) } };
      },
      getRegistrations: async () => [],
    },
  },
});
Object.defineProperty(globalThis, 'caches', {
  configurable: true,
  value: cachesMock,
});
Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  value: async url => {
    assert.match(String(url), /\/version\.json/);
    return { ok: true, json: async () => ({ v: fetchVersion }) };
  },
});

const manager = await import('../src/pwa/PwaUpdateManager.js');

await manager.startPwaUpdateManager({ autoReload: true });
let diag = manager.getPwaUpdateDiagnostics();
assert.equal(registerCount, 1, 'Service Worker must be registered once on first start');
assert.equal(diag.registrationCount, 1);
assert.equal(diag.installedVersion, 'v1');
assert.equal(diag.availableVersion, 'v1');
assert.equal(diag.updateStatus, 'current');
assert.equal(diag.cacheClearCount, 0, 'same version must keep cache');
assert.deepEqual(cacheKeys, ['apg-old-cache']);

await manager.startPwaUpdateManager({ autoReload: true });
diag = manager.getPwaUpdateDiagnostics();
assert.equal(registerCount, 1, 'second start must not register Service Worker again');
assert.equal(diag.registrationCount, 1);
assert.equal(diag.cacheClearCount, 0, 'second start must not clear cache');

fetchVersion = 'v2';
await manager.checkPwaUpdate({ autoReload: false });
diag = manager.getPwaUpdateDiagnostics();
assert.equal(diag.installedVersion, 'v2');
assert.equal(diag.availableVersion, 'v2');
assert.equal(diag.cacheVersion, 'v2');
assert.equal(diag.updateStatus, 'updated_pending_reload');
assert.equal(diag.cacheClearCount, 1, 'new version must clear old cache once');
assert.deepEqual(cacheKeys, []);
assert.equal(reloadCount, 0, 'autoReload=false must not reload during test update');
assert.match(diag.cacheMigrationResult, /^ok:version:v2/);

await manager.checkPwaUpdate({ autoReload: false });
diag = manager.getPwaUpdateDiagnostics();
assert.equal(diag.cacheClearCount, 1, 'same migrated version must not clear cache again');
assert.equal(diag.updateStatus, 'current');

await manager.requestPwaDiagnostics();
diag = manager.getPwaUpdateDiagnostics();
assert.equal(diag.appVersion, 'v2');
assert.equal(diag.bootstrapSource, 'stored-version');
assert.ok(swMessages.some(message => message.type === 'APG_SW_DIAGNOSTICS'));

const mainSource = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
assert.match(mainSource, /startPwaUpdateManager/);
assert.doesNotMatch(mainSource, /navigator\.serviceWorker\.register\('/);
assert.doesNotMatch(mainSource, /caches\.keys\(\)\.then/);

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
assert.doesNotMatch(appSource, /checkForUpdate/);
assert.doesNotMatch(appSource, /\/version\.json/);

const userAppSource = readFileSync(new URL('../src/UserApp.jsx', import.meta.url), 'utf8');
assert.match(userAppSource, /subscribePwaUpdate/);
assert.match(userAppSource, /requestPwaDiagnostics/);
assert.match(userAppSource, /UserApp Branch/);
assert.doesNotMatch(userAppSource, /fetch\('\/version\.json/);

const swSource = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
assert.doesNotMatch(swSource, /install[\s\S]{0,90}clearAllCaches/);
assert.doesNotMatch(swSource, /activate[\s\S]{0,90}clearAllCaches/);

console.log('PWA Update Manager V1 regression passed');
