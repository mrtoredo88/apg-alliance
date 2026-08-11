import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/UserApp.jsx', import.meta.url), 'utf8');

for (const panel of [
  'home', 'offers', 'experts', 'events', 'news', 'partners', 'nearby',
  'favorites', 'notifications', 'rewards', 'activity', 'profile', 'tasks', 'leaderboard',
]) {
  assert.match(source, new RegExp(`['"]${panel}['"]`), `pull-to-refresh must support ${panel}`);
}

assert.match(source, /function invalidatePublicBootstrap\(\)\s*{[\s\S]*?publicBootstrapPromise\s*=\s*null;/,
  'refresh must invalidate the shared public-data request');
assert.match(source, /const handleRefresh[\s\S]*?invalidatePublicBootstrap\(\);[\s\S]*?loadData\(mountedRef, \{ background: true \}\)/,
  'pull refresh must fetch fresh data without replacing the page with a loading screen');
assert.match(source, /fetch\(`\$\{API_BASE_URL\}\/api\/vk-news\?count=30`, \{ cache: 'no-store' \}\)/,
  'VK news refresh must bypass the browser cache');
assert.match(source, /pullRefreshInFlightRef\.current/,
  'refresh must ignore duplicate gestures while a request is running');
assert.match(source, /onTouchCancel=\{handleSwipeCancel\}/,
  'cancelled touch gestures must clean up pull state');
assert.match(source, /onClickCapture=\{suppressClickAfterPull\}/,
  'a completed pull must not accidentally open the underlying card');
assert.match(source, /Отпустите, чтобы обновить/,
  'the UI must explain when the refresh threshold has been reached');
assert.match(source, /Обновлено/,
  'the UI must confirm a successful refresh');
assert.match(source, /Не удалось обновить/,
  'the UI must report a failed refresh');

console.log('Pull-to-refresh regression checks passed.');
