import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const viteConfig = readFileSync(path.join(root, 'vite.config.js'), 'utf8');
const indexHtml = readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(viteConfig, /@vitejs\/plugin-legacy/, 'Vite must include the legacy plugin for browsers without native dynamic import support.');
assert.match(viteConfig, /legacy\(\{/, 'Vite legacy plugin must be enabled in production builds.');
assert.match(indexHtml, /main_module_script_failed/, 'index.html must record module script load failures in APG boot diagnostics.');

const assetsDir = path.join(root, 'dist', 'assets');
if (existsSync(assetsDir)) {
  const jsFiles = readdirSync(assetsDir).filter(file => file.endsWith('.js'));
  const legacyFiles = jsFiles.filter(file => file.includes('-legacy'));
  assert.ok(legacyFiles.length > 0, 'Production build must emit legacy chunks.');

  const distIndex = readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');
  assert.match(distIndex, /vite-legacy-polyfill/, 'Production HTML must include legacy polyfill loader.');
  assert.match(distIndex, /vite-legacy-entry/, 'Production HTML must include legacy entry loader.');
  assert.match(distIndex, /__vite_is_modern_browser/, 'Production HTML must include dynamic import fallback detection.');

  const legacyOffenders = [];
  for (const file of legacyFiles) {
    const source = readFileSync(path.join(assetsDir, file), 'utf8');
    if (/(^|[^.\w$])import\s*\(/.test(source)) legacyOffenders.push(file);
  }
  assert.deepEqual(legacyOffenders, [], `Legacy chunks must not require native dynamic import: ${legacyOffenders.join(', ')}`);
}

console.log('pwa-build-compat-test: ok');
