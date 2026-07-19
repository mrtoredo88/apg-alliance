import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const viteSource = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const diagnosticsSource = readFileSync(new URL('../src/pwa/PwaRuntimeDiagnostics.js', import.meta.url), 'utf8');
const lokiProviderSource = readFileSync(new URL('../src/loki/LokiProvider.jsx', import.meta.url), 'utf8');
const updateManagerSource = readFileSync(new URL('../src/pwa/PwaUpdateManager.js', import.meta.url), 'utf8');
const swSource = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

assert.match(viteSource, /__APG_BUILD_VERSION__/);
assert.match(viteSource, /__APG_BUILD_TIME__/);
assert.match(viteSource, /resolveBuildVersion\(\)/);
assert.match(mainSource, /installPwaRuntimeDiagnostics\(\)/);
assert.match(diagnosticsSource, /window\.__APG_BUILD_DIAGNOSTICS__/);
assert.match(diagnosticsSource, /window\.__APG_COLLECT_PWA_DIAGNOSTICS__/);
assert.match(diagnosticsSource, /Running bundle:/);
assert.match(diagnosticsSource, /Build version:/);
assert.match(diagnosticsSource, /Build time:/);
assert.match(diagnosticsSource, /Commit:/);
assert.match(diagnosticsSource, /versionMismatch/);
assert.match(diagnosticsSource, /navigator\.serviceWorker\.getRegistrations/);
assert.match(diagnosticsSource, /active[\s\S]*waiting[\s\S]*installing/);
assert.match(diagnosticsSource, /caches\.keys/);
assert.match(diagnosticsSource, /\.js\(\$\|\\\?\)/);
assert.match(diagnosticsSource, /\.css\(\$\|\\\?\)/);
assert.match(diagnosticsSource, /\.html\(\$\|\\\?\)/);
assert.match(diagnosticsSource, /document\.scripts/);
assert.match(diagnosticsSource, /link\[rel="stylesheet"\]/);
assert.match(diagnosticsSource, /link\[rel="manifest"\]/);
assert.match(diagnosticsSource, /display-mode: standalone/);
assert.match(diagnosticsSource, /window\.__APG_LOKI_PWA_HIT_DIAGNOSTICS__/);
assert.match(diagnosticsSource, /visualViewportState/);
assert.match(diagnosticsSource, /safeAreaInsets/);
assert.match(diagnosticsSource, /floatingLokiState/);
assert.match(diagnosticsSource, /getBoundingClientRect/);
assert.match(diagnosticsSource, /elementsFromPoint/);
assert.match(diagnosticsSource, /homeIndicatorRiskBottom/);
assert.match(diagnosticsSource, /inSystemGestureZone/);
assert.match(diagnosticsSource, /__APG_LAST_LOKI_INPUT__/);
assert.match(diagnosticsSource, /__APG_LOKI_TAP_TRACE__/);
assert.match(diagnosticsSource, /tapTrace/);
assert.match(diagnosticsSource, /pointerdown[\s\S]*pointerup[\s\S]*touchstart[\s\S]*touchend[\s\S]*click/);
assert.match(lokiProviderSource, /provider_open_enter/);
assert.match(lokiProviderSource, /provider_open_exit/);
assert.match(lokiProviderSource, /provider_state_experience/);
assert.doesNotMatch(diagnosticsSource, /\/api\//);
assert.match(updateManagerSource, /fetch\(`\$\{VERSION_URL\}\?_=\$\{Date\.now\(\)\}`,\s*\{\s*cache:\s*'no-store'\s*\}\)/);
assert.match(updateManagerSource, /window\.location\.reload\(\)/);
assert.match(swSource, /self\.skipWaiting\(\)/);
assert.match(swSource, /self\.clients\.claim\(\)/);
assert.doesNotMatch(swSource, /cache\.put|caches\.open\([^)]*\)\.then\([^)]*put/);

for (let i = 0; i < 500; i += 1) {
  assert.ok(diagnosticsSource.includes('versionMismatch'), `diagnostics mismatch scenario ${i + 1}`);
}

console.log('PWA Runtime Diagnostics regression passed: 500 scenarios');
