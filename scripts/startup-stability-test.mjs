import { chromium } from 'playwright';

/* global process */

const targetUrl = process.argv[2] || process.env.STARTUP_URL || process.env.SMOKE_URL || 'https://myapg.ru/';
const runs = Number(process.env.STARTUP_RUNS || 100);
const concurrency = Math.max(1, Math.min(8, Number(process.env.STARTUP_CONCURRENCY || 4)));
const waitMs = Number(process.env.STARTUP_WAIT_MS || 7000);
const timeoutMs = Number(process.env.STARTUP_TIMEOUT_MS || 22000);

const fatalMarkers = [
  'Что-то пошло не так',
  'Minified React error',
  'React error',
  'АПГ загружается не полностью',
];

const ignoredErrors = [
  /ResizeObserver loop/i,
  /AbortError/i,
  /ERR_INSUFFICIENT_RESOURCES/i,
  /SharedImageManager/i,
];

function normalizeUrl(value) {
  return new URL(value || 'https://myapg.ru/').toString();
}

function isIgnoredError(value) {
  return ignoredErrors.some(pattern => pattern.test(String(value || '')));
}

async function runOne(browser, index, url) {
  const context = await browser.newContext({
    viewport: index % 2 === 0 ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    isMobile: index % 2 === 0,
    hasTouch: index % 2 === 0,
  });
  await context.addInitScript((markers) => {
    window.__APG_FATAL_TEXT_SEEN = [];
    const scan = () => {
      try {
        const text = document.body?.innerText || '';
        markers.forEach(marker => {
          if (text.includes(marker) && !window.__APG_FATAL_TEXT_SEEN.includes(marker)) {
            window.__APG_FATAL_TEXT_SEEN.push(marker);
          }
        });
      } catch {}
    };
    const install = () => {
      scan();
      try {
        new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
      } catch {}
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
  }, fatalMarkers);

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => {
    const text = error?.message || String(error);
    if (!isIgnoredError(text)) errors.push(text);
  });
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (!isIgnoredError(text)) errors.push(text);
  });

  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(waitMs);
    const result = await page.evaluate(() => ({
      fatalTextSeen: window.__APG_FATAL_TEXT_SEEN || [],
      bootTrace: sessionStorage.getItem('apg_boot_trace') || '',
      lastStartupError: sessionStorage.getItem('apg_last_startup_error') || '',
      rootHtmlLength: document.getElementById('root')?.innerHTML?.length || 0,
      bodyText: document.body?.innerText || '',
    }));
    const finalFatal = fatalMarkers.find(marker => result.bodyText.includes(marker)) || '';
    const transientFatal = result.fatalTextSeen.filter(marker => marker !== finalFatal);
    const ok = response?.status() < 400
      && result.rootHtmlLength > 1000
      && !finalFatal
      && transientFatal.length === 0
      && errors.length === 0;
    return {
      index,
      ok,
      status: response?.status() || 0,
      finalFatal,
      transientFatal,
      errors: errors.slice(0, 5),
      rootHtmlLength: result.rootHtmlLength,
      bootTrace: ok ? '' : result.bootTrace,
      lastStartupError: ok ? '' : result.lastStartupError,
    };
  } catch (error) {
    return { index, ok: false, status: 0, finalFatal: '', transientFatal: [], errors: [error?.message || String(error)], rootHtmlLength: 0 };
  } finally {
    await context.close().catch(() => {});
  }
}

async function run() {
  const url = normalizeUrl(targetUrl);
  const browser = await chromium.launch({ headless: true });
  const results = [];
  let cursor = 0;

  async function worker() {
    while (cursor < runs) {
      const index = cursor;
      cursor += 1;
      results.push(await runOne(browser, index, url));
    }
  }

  try {
    await Promise.all(Array.from({ length: concurrency }, worker));
  } finally {
    await browser.close().catch(() => {});
  }

  const failures = results.filter(item => !item.ok).sort((a, b) => a.index - b.index);
  const summary = {
    url,
    runs,
    passed: runs - failures.length,
    failed: failures.length,
    failures: failures.slice(0, 5),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (failures.length) throw new Error(`Startup stability failed: ${failures.length}/${runs}`);
}

run().catch(error => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
