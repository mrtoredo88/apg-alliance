import { chromium } from 'playwright';

const targetUrl = process.argv[2] || process.env.SMOKE_URL || 'https://myapg.ru/';
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 20000);
const waitMs = Number(process.env.SMOKE_WAIT_MS || 3500);

const fatalMarkers = [
  'Что-то пошло не так',
  'Проверьте соединение',
  'Minified React error',
];

function normalizeUrl(url) {
  return new URL(url).toString();
}

function isIgnoredConsoleError(text) {
  return /ResizeObserver loop|AbortError/i.test(String(text || ''));
}

async function run() {
  const url = normalizeUrl(targetUrl);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message || String(error)));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (!isIgnoredConsoleError(text)) errors.push(text);
  });

  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(waitMs);
    const version = await page.evaluate(async () => {
      const result = await fetch('/version.json', { cache: 'no-store' });
      return result.json();
    });
    const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    const rootHtmlLength = await page.locator('#root').evaluate(element => element.innerHTML.length).catch(() => 0);
    const fatalText = fatalMarkers.find(marker => bodyText.includes(marker)) || '';
    const result = {
      url,
      status: response?.status() || 0,
      version,
      rootHtmlLength,
      fatalText,
      errors: errors.slice(0, 10),
    };
    console.log(JSON.stringify(result, null, 2));

    if (!response || response.status() >= 400) throw new Error(`HTTP status ${response?.status() || 0}`);
    if (!version?.v) throw new Error('version.json missing v');
    if (rootHtmlLength < 1000) throw new Error('React root is too small');
    if (fatalText) throw new Error(`Fatal UI marker: ${fatalText}`);
    if (errors.length) throw new Error(`Console/page errors: ${errors.slice(0, 3).join(' | ')}`);
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
