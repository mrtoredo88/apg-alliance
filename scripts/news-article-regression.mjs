import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { areNewsCommentsEnabled, getCanonicalNewsId, getNewsLegacyIds } from '../src/newsUtils.js';

const API_BASE_URL = process.env.NEWS_TEST_API_BASE_URL || 'https://bbangqkf2d4pa9855lu0.containers.yandexcloud.net';
const port = Number(process.env.NEWS_TEST_PORT || 4177);
const baseUrl = `http://127.0.0.1:${port}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isDarkText(rgb) {
  const match = String(rgb || '').match(/\d+/g)?.map(Number) || [];
  if (match.length < 3) return false;
  const [r, g, b] = match;
  return (r * 0.299 + g * 0.587 + b * 0.114) < 90;
}

function isLightBackground(rgb) {
  const match = String(rgb || '').match(/\d+/g)?.map(Number) || [];
  if (match.length < 3) return false;
  const [r, g, b] = match;
  return (r * 0.299 + g * 0.587 + b * 0.114) > 210;
}

async function waitForPreview() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(baseUrl, { cache: 'no-store' });
      if (response.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error('Local preview did not start.');
}

async function clickNewsByTitle(page, title) {
  const titleLocator = page.getByText(title, { exact: false }).first();
  await titleLocator.waitFor({ state: 'visible', timeout: 20000 });
  await titleLocator.click();
}

async function assertArticle(page, expectedNewsId, requests) {
  const reader = page.locator('.apg-news-article-reader');
  await reader.waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(360);

  const styles = await reader.evaluate(node => {
    const article = getComputedStyle(node);
    const shell = getComputedStyle(node.closest('.apg-news-article-shell'));
    return {
      color: article.color,
      backgroundColor: article.backgroundColor,
      opacity: article.opacity,
      filter: article.filter,
      shellOpacity: shell.opacity,
      shellFilter: shell.filter,
    };
  });

  assert(isDarkText(styles.color), `Article text is not dark enough: ${styles.color}`);
  assert(isLightBackground(styles.backgroundColor), `Article background is not light enough: ${styles.backgroundColor}`);
  assert(styles.opacity === '1' && styles.shellOpacity === '1', 'Article has unexpected parent opacity.');
  assert(styles.filter === 'none' && styles.shellFilter === 'none', 'Article has unexpected filter.');

  await page.getByText('Комментарии', { exact: true }).waitFor({ state: 'visible', timeout: 10000 });
  await page.getByText(/Комментариев пока нет|Авторизуйтесь|Напишите комментарий/).first().waitFor({ state: 'visible', timeout: 10000 });
  await page.getByText('Отправить', { exact: true }).first().waitFor({ state: 'visible', timeout: 10000 });

  await page.locator('.apg-news-article-scroll').evaluate(node => { node.scrollTop = node.scrollHeight; });
  const originalButton = page.getByText('Перейти к публикации во ВКонтакте', { exact: false });
  await originalButton.waitFor({ state: 'visible', timeout: 10000 });

  const commentsRequest = requests.find(url => url.includes('/api/news-comments'));
  assert(commentsRequest, 'CommentsPanel did not request /api/news-comments.');
  const requestUrl = new URL(commentsRequest);
  assert(requestUrl.searchParams.get('newsId') === expectedNewsId, `Wrong comments newsId: ${requestUrl.searchParams.get('newsId')}`);
}

async function main() {
  assert(existsSync('dist/index.html'), 'Run npm run build before npm run test:news-article.');

  const vkResponse = await fetch(`${API_BASE_URL}/api/vk-news?count=5`, { cache: 'no-store' });
  assert(vkResponse.ok, `VK news API failed: ${vkResponse.status}`);
  const vkPayload = await vkResponse.json();
  const vkPost = (vkPayload.posts || []).find(item => item?.source === 'vk');
  assert(vkPost, 'VK news API returned no VK post.');

  const canonicalId = getCanonicalNewsId(vkPost);
  const legacyIds = getNewsLegacyIds(vkPost);
  assert(canonicalId === vkPost.id, `Canonical id mismatch: ${canonicalId} !== ${vkPost.id}`);
  assert(legacyIds.includes(vkPost.externalId), 'Legacy ids do not include VK externalId.');
  assert(areNewsCommentsEnabled({ ...vkPost, commentsEnabled: undefined }), 'Missing commentsEnabled must keep comments enabled.');
  assert(areNewsCommentsEnabled({ ...vkPost, commentsEnabled: null }), 'Null commentsEnabled must keep comments enabled.');
  assert(!areNewsCommentsEnabled({ ...vkPost, commentsEnabled: false }), 'Boolean false commentsEnabled must disable comments.');

  const commentsResponse = await fetch(`${API_BASE_URL}/api/news-comments?newsId=${encodeURIComponent(canonicalId)}&legacyIds=${encodeURIComponent(legacyIds.filter(id => id !== canonicalId).join(','))}`);
  assert(commentsResponse.ok, `Comments API failed: ${commentsResponse.status}`);
  const commentsPayload = await commentsResponse.json();
  assert(commentsPayload.ok === true && Array.isArray(commentsPayload.comments), 'Comments API returned invalid payload.');

  const viteBin = process.platform === 'win32' ? 'node_modules/.bin/vite.cmd' : 'node_modules/.bin/vite';
  const server = spawn(viteBin, ['preview', '--host', '127.0.0.1', '--port', String(port)], { stdio: 'ignore' });
  try {
    await waitForPreview();
    let browser = null;
    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true });
      const requests = [];
      page.on('request', request => {
        const url = request.url();
        if (url.includes('/api/news-comments')) requests.push(url);
      });

      await page.goto(`${baseUrl}/?no-sw=1`, { waitUntil: 'domcontentloaded' });
      await clickNewsByTitle(page, vkPost.title);
      await assertArticle(page, canonicalId, requests);

      requests.length = 0;
      await page.goto(`${baseUrl}/news?no-sw=1`, { waitUntil: 'domcontentloaded' });
      await clickNewsByTitle(page, vkPost.title);
      await assertArticle(page, canonicalId, requests);

      requests.length = 0;
      await page.goto(`${baseUrl}/news/${encodeURIComponent(canonicalId)}?no-sw=1`, { waitUntil: 'domcontentloaded' });
      await assertArticle(page, canonicalId, requests);
    } finally {
      await browser?.close?.().catch(() => {});
    }
  } finally {
    server.kill('SIGTERM');
  }

  console.log(JSON.stringify({
    ok: true,
    vkNews: { id: vkPost.id, externalId: vkPost.externalId, source: vkPost.source, canonicalId },
    checks: [
      'home_vk_article',
      'news_list_article',
      'deep_link_article',
      'light_reader',
      'comments_panel',
      'canonical_news_id',
      'comments_enabled_defaults',
      'vk_original_button',
    ],
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
