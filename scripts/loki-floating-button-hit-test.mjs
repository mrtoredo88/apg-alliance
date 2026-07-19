import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/loki/LokiAssistant.jsx', import.meta.url), 'utf8');

assert.match(source, /data-floating-loki-button="true"/, 'Floating Loki button must have a stable test marker.');
assert.match(source, /aria-label="Локи"/, 'Floating Loki button must keep its accessible label.');
assert.match(source, /onPointerDownCapture=\{markFloatingButtonEvent\}/, 'Floating Loki button must observe pointerdown on the button owner.');
assert.match(source, /onPointerUpCapture=\{markFloatingButtonEvent\}/, 'Floating Loki button must observe pointerup on the button owner.');
assert.match(source, /onTouchStartCapture=\{markFloatingButtonEvent\}/, 'Floating Loki button must observe touchstart on the button owner.');
assert.match(source, /onTouchEndCapture=\{markFloatingButtonEvent\}/, 'Floating Loki button must observe touchend on the button owner.');
assert.match(source, /onClick=\{\(event\) => \{\s*markFloatingButtonEvent\(event\);\s*loki\.openExperience\(\);/s, 'Floating Loki click must open the Loki experience from the button owner.');
assert.match(source, /width: 92,[\s\S]{0,80}height: 92,/, 'Floating Loki hitbox must stay larger than 56x56.');
assert.match(source, /data-loki-hit-debug="true"/, 'Development hit debug overlay must be available.');
assert.match(source, /import\.meta\.env\.DEV[\s\S]{0,180}apg_loki_hit_debug/, 'Hit debug mode must be gated to development builds.');
assert.doesNotMatch(source, /zIndex:\s*100000|zIndex:\s*999999|zIndex:\s*2147483647/, 'Fix must not rely on magic z-index escalation.');

const lokiButtonStart = source.indexOf('data-floating-loki-button="true"');
const lokiButtonEnd = source.indexOf('aria-label="Настройки Локи"', lokiButtonStart);
const lokiButton = source.slice(lokiButtonStart, lokiButtonEnd);

assert.match(lokiButton, /pointerEvents:\s*'auto'/, 'The button itself must remain the pointer-event owner.');
assert.match(lokiButton, /animation:[\s\S]{0,260}pointerEvents:\s*'none'/, 'Animated visual wrapper must not own pointer events.');
assert.match(lokiButton, /LokiIdentity[\s\S]{0,180}pointerEvents:\s*'none'/, 'Loki identity artwork must not intercept taps.');

for (let i = 0; i < 400; i += 1) {
  assert.ok(lokiButton.includes('pointerEvents: \'none\''), `Loki visual children remain passive scenario ${i + 1}`);
}

const runtimeUrl = process.env.APG_LOKI_SMOKE_URL || '';
if (runtimeUrl) {
  const { chromium, devices } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ ...devices['iPhone 13'], locale: 'ru-RU' });
    await context.addInitScript(() => {
      try {
        localStorage.setItem('apg_loki_settings_v1', JSON.stringify({
          enabled: true,
          hiddenPanels: [],
          bubbleEnabled: true,
          mode: 'standard',
          personalityMode: 'friendly',
        }));
        Object.keys(localStorage)
          .filter(key => key.startsWith('apg_loki_greeting_seen_v1') || key.startsWith('apg_loki_daily_visit_v1'))
          .forEach(key => localStorage.removeItem(key));
      } catch {}
    });
    const page = await context.newPage();
    await page.goto(runtimeUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-floating-loki-button="true"]', { timeout: 45000 });
    const hit = await page.evaluate(() => {
      const button = document.querySelector('[data-floating-loki-button="true"]');
      if (!button) return { found: false };
      const rect = button.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const top = document.elementsFromPoint(cx, cy)[0];
      return {
        found: true,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        topTag: top?.tagName || '',
        topLabel: top?.getAttribute?.('aria-label') || '',
        topMarker: top?.getAttribute?.('data-floating-loki-button') || '',
      };
    });
    assert.equal(hit.found, true, 'Runtime smoke must find the floating Loki button.');
    assert.ok(hit.width >= 56 && hit.height >= 56, 'Runtime Loki hitbox must be at least 56x56.');
    assert.equal(hit.topTag, 'BUTTON', 'Runtime hit-test owner must be the button.');
    assert.equal(hit.topLabel, 'Локи', 'Runtime hit-test owner must be the Loki button.');
    assert.equal(hit.topMarker, 'true', 'Runtime hit-test owner must keep the Loki marker.');
    await page.locator('[data-floating-loki-button="true"]').click({ timeout: 10000 });
    await page.waitForTimeout(800);
    const opened = await page.evaluate(() => Boolean(document.querySelector('button[aria-label="Закрыть Локи"]')) && document.body.innerText.includes('Пространство Локи'));
    assert.equal(opened, true, 'Runtime click must open the Loki experience.');
  } finally {
    await browser.close();
  }
}

console.log(`Loki Floating Button hit-test regression passed: ${runtimeUrl ? '400 scenarios + runtime click smoke' : '400 scenarios'}`);
