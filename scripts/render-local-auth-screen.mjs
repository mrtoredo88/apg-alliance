import { chromium } from 'playwright';
import process from 'node:process';

const target = process.env.LOCAL_PREVIEW_URL || 'http://127.0.0.1:4175/';
const output = process.env.AUTH_SCREENSHOT_PATH;
if (!output) throw new Error('AUTH_SCREENSHOT_PATH is required');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await context.newPage();

try {
  await page.goto(target, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('manualLogout', 'true');
    localStorage.removeItem('apg_email_user');
    localStorage.removeItem('apg_tg_user');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-logged-out-auth]').waitFor({ state: 'visible' });
  await page.screenshot({ path: output, fullPage: false });
  console.log(JSON.stringify({ ok: true, output }));
} finally {
  await browser.close();
}
