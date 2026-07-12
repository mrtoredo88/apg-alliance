// Постоянный regression: все каналы раздачи фронтенда отдают ОДНУ версию,
// а публичная выдача не содержит архивных/удалённых объектов.
// Причина появления: 2026-07-12 VK-хостинг остался на v4.4.2, и после email-входа
// пользователь оказывался в старом интерфейсе со старыми данными.
// Запуск: node scripts/release-parity-test.mjs [--expect-head]
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { isLifecyclePublic, normalizeContentStatus } from '../server-shared/content-lifecycle.js';

const API = 'https://bbangqkf2d4pa9855lu0.containers.yandexcloud.net';
const CHANNELS = {
  'myapg.ru': 'https://myapg.ru/version.json',
  'yandex-storage': 'https://storage.yandexcloud.net/myapg-frontend/version.json',
};

const versions = {};
for (const [name, url] of Object.entries(CHANNELS)) {
  const res = await fetch(url, { cache: 'no-store' });
  assert.equal(res.ok, true, `${name}: version.json недоступен (${res.status})`);
  versions[name] = (await res.json())?.v || '';
  assert.ok(versions[name], `${name}: пустая версия`);
}
const unique = [...new Set(Object.values(versions))];
console.log('версии каналов:', JSON.stringify(versions));
assert.equal(unique.length, 1, `Каналы раздают РАЗНЫЕ версии: ${JSON.stringify(versions)} — пользователи получат разные интерфейсы`);

if (process.argv.includes('--expect-head')) {
  const head = execSync('git rev-parse --short=8 HEAD').toString().trim();
  assert.equal(unique[0], head, `production (${unique[0]}) отстаёт от HEAD (${head}) — выполните ./deploy-frontend.sh`);
}

const publicData = await (await fetch(`${API}/api/public-data`, { cache: 'no-store' })).json();
for (const [collection, rows] of Object.entries(publicData?.data || {})) {
  if (!Array.isArray(rows)) continue;
  rows.forEach(item => {
    assert.notEqual(item.archived, true, `${collection}/${item.id}: архивный объект в публичной выдаче`);
    assert.notEqual(item.deleted, true, `${collection}/${item.id}: удалённый объект в публичной выдаче`);
    if (['partners', 'experts', 'news'].includes(collection)) {
      assert.equal(isLifecyclePublic(item), true, `${collection}/${item.id}: не проходит lifecycle-фильтр (status: ${normalizeContentStatus(item)}), но отдан публично`);
    }
  });
}
console.log(`Release parity test passed: версия ${unique[0]} едина, публичная выдача чистая (news: ${(publicData.data.news || []).length}, experts: ${(publicData.data.experts || []).length}, partners: ${(publicData.data.partners || []).length})`);
