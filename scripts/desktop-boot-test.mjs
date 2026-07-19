import { chromium } from 'playwright';

const targetUrl = process.env.DESKTOP_BOOT_URL || 'http://localhost:4173/#/';
const waitMs = Number(process.env.DESKTOP_BOOT_WAIT_MS || 8000);

function ignoredConsoleError(text) {
  return /ResizeObserver loop|AbortError|Firestore .*permission-denied|Missing or insufficient permissions/i.test(String(text || ''));
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push({ type: 'pageerror', message: error.message || String(error) }));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (!ignoredConsoleError(text)) errors.push({ type: 'console', message: text });
  });

  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(waitMs);

    const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    const headerVisible = bodyText.includes('АПГ: ЗЕЛЕНОГРАД');
    const navigationVisible = bodyText.includes('Главная') && bodyText.includes('Партнёры') && bodyText.includes('Эксперты');
    const lokiVisible = await page.locator('button[aria-label="Локи"], [data-floating-loki-button="true"]').first().isVisible().catch(() => false);
    const messagesButton = page.getByRole('button', { name: 'Сообщения' }).first();
    const messagesVisible = await messagesButton.isVisible().catch(() => false);

    if (messagesVisible) {
      await messagesButton.click({ timeout: 5000 });
      await page.waitForTimeout(2500);
    }

    const afterClickText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    const messagesOpened = page.url().includes('/messages') || afterClickText.includes('Диалоги') || afterClickText.includes('Сообщения');
    const fatal = errors.find(error => /onOpenMessages|ReferenceError|Can't find variable/i.test(error.message));
    const result = {
      url: page.url(),
      headerVisible,
      navigationVisible,
      lokiVisible,
      messagesVisible,
      messagesOpened,
      errors: errors.slice(0, 10),
    };
    console.log(JSON.stringify(result, null, 2));

    if (fatal) throw new Error(`Desktop boot ReferenceError: ${fatal.message}`);
    if (!headerVisible) throw new Error('Desktop header did not render');
    if (!navigationVisible) throw new Error('Desktop navigation did not render');
    if (!lokiVisible) throw new Error('Desktop floating Loki button did not render');
    if (!messagesVisible) throw new Error('Desktop Messages button did not render');
    if (!messagesOpened) throw new Error('Desktop Messages button did not open messages');
    if (errors.length) throw new Error(`Desktop boot console/page errors: ${errors.slice(0, 3).map(error => error.message).join(' | ')}`);
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
