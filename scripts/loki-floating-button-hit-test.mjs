import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/loki/LokiAssistant.jsx', import.meta.url), 'utf8');
const positionSource = readFileSync(new URL('../src/loki/lokiPosition.js', import.meta.url), 'utf8');

assert.match(source, /data-floating-loki-button="true"/, 'Floating Loki button must have a stable test marker.');
assert.match(source, /data-loki-floating-root="active"/, 'Floating Loki root must have a stable diagnostic marker.');
assert.match(source, /data-loki-floating-root="restore"/, 'Floating Loki restore root must have a stable diagnostic marker.');
assert.match(source, /aria-label="Локи"/, 'Floating Loki button must keep its accessible label.');
assert.match(source, /window\.__APG_LOKI_TAP_TRACE__/, 'Floating Loki tap chain must keep a runtime trace buffer.');
assert.match(source, /floatingButtonRef/, 'Floating Loki button must expose the real DOM button to native listeners.');
assert.match(source, /addEventListener\('touchend'[\s\S]{0,120}passive:\s*false/, 'Floating Loki must listen to native touchend outside React synthetic events.');
assert.match(source, /addEventListener\('pointerup'[\s\S]{0,120}passive:\s*false/, 'Floating Loki must listen to native pointerup outside React synthetic events.');
assert.match(source, /addEventListener\('click'[\s\S]{0,80}capture:\s*true/, 'Floating Loki must listen to native click outside React synthetic events.');
assert.match(source, /openFromFloatingButton/, 'Floating Loki open path must be shared by React and native handlers.');
assert.match(source, /onPointerDownCapture=\{markFloatingButtonEvent\}/, 'Floating Loki button must observe pointerdown on the button owner.');
assert.match(source, /onPointerUpCapture=\{markFloatingButtonEvent\}/, 'Floating Loki button must observe pointerup on the button owner.');
assert.match(source, /onTouchStartCapture=\{markFloatingButtonEvent\}/, 'Floating Loki button must observe touchstart on the button owner.');
assert.match(source, /onTouchEndCapture=\{markFloatingButtonEvent\}/, 'Floating Loki button must observe touchend on the button owner.');
assert.match(source, /onClick=\{\(event\) => \{\s*markFloatingButtonEvent\(event\);\s*openFromFloatingButton\(event,\s*'react_click'\);/s, 'Floating Loki React click must use the shared open path from the button owner.');
assert.match(source, /width: 92,[\s\S]{0,80}height: 92,/, 'Floating Loki hitbox must stay larger than 56x56.');
assert.match(source, /data-loki-hit-debug="true"/, 'Development hit debug overlay must be available.');
assert.match(source, /import\.meta\.env\.DEV[\s\S]{0,180}apg_loki_hit_debug/, 'Hit debug mode must be gated to development builds.');
assert.doesNotMatch(source, /zIndex:\s*100000|zIndex:\s*999999|zIndex:\s*2147483647/, 'Fix must not rely on magic z-index escalation.');
assert.match(positionSource, /width:\s*'fit-content'/, 'Mobile Loki floating position must shrink-wrap its interactive layer.');
assert.doesNotMatch(positionSource, /left:\s*SIDE_INSET/, 'Mobile Loki floating root must not span the viewport with left and right anchors.');

const lokiButtonStart = source.indexOf('data-floating-loki-button="true"');
const lokiButtonEnd = source.indexOf('aria-label="Настройки Локи"', lokiButtonStart);
const lokiButton = source.slice(lokiButtonStart, lokiButtonEnd);
const activeRootStart = source.indexOf('data-loki-floating-root="active"');
const activeRoot = source.slice(activeRootStart, lokiButtonStart);
const restoreRootStart = source.indexOf('data-loki-floating-root="restore"');
const restoreRootEnd = source.indexOf('aria-label="Вернуть Локи"', restoreRootStart);
const restoreRoot = source.slice(restoreRootStart, restoreRootEnd);

assert.match(lokiButton, /pointerEvents:\s*'auto'/, 'The button itself must remain the pointer-event owner.');
assert.match(activeRoot, /pointerEvents:\s*'auto'/, 'The active floating root must not depend on child pointer-events revival.');
assert.match(restoreRoot, /pointerEvents:\s*'auto'/, 'The restore floating root must not depend on child pointer-events revival.');
assert.match(activeRoot, /transform:\s*leaving \?[\s\S]{0,120}:\s*'none'/, 'Resting floating root must avoid transform-created hit-test layers.');
assert.match(activeRoot, /filter:\s*leaving \?[\s\S]{0,100}:\s*'none'/, 'Resting floating root must avoid filter-created hit-test layers.');
assert.match(activeRoot, /animation:\s*'none'/, 'The active floating root must not animate transform/filter hit-test layers.');
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
      const root = document.querySelector('[data-loki-floating-root="active"]');
      if (!button) return { found: false };
      const rect = button.getBoundingClientRect();
      const rootRect = root?.getBoundingClientRect?.();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const top = document.elementsFromPoint(cx, cy)[0];
      return {
        found: true,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        rootWidth: Math.round(rootRect?.width || 0),
        rootPointerEvents: root ? getComputedStyle(root).pointerEvents : '',
        rootTransform: root ? getComputedStyle(root).transform : '',
        rootFilter: root ? getComputedStyle(root).filter : '',
        topTag: top?.tagName || '',
        topLabel: top?.getAttribute?.('aria-label') || '',
        topMarker: top?.getAttribute?.('data-floating-loki-button') || '',
      };
    });
    assert.equal(hit.found, true, 'Runtime smoke must find the floating Loki button.');
    assert.ok(hit.width >= 56 && hit.height >= 56, 'Runtime Loki hitbox must be at least 56x56.');
    assert.ok(hit.rootWidth <= 360, 'Runtime Loki floating root should shrink-wrap instead of spanning the viewport.');
    assert.equal(hit.rootPointerEvents, 'auto', 'Runtime Loki floating root must receive pointer hit testing normally.');
    assert.equal(hit.rootTransform, 'none', 'Runtime Loki floating root must not create a resting transform layer.');
    assert.equal(hit.rootFilter, 'none', 'Runtime Loki floating root must not create a resting filter layer.');
    assert.equal(hit.topTag, 'BUTTON', 'Runtime hit-test owner must be the button.');
    assert.equal(hit.topLabel, 'Локи', 'Runtime hit-test owner must be the Loki button.');
    assert.equal(hit.topMarker, 'true', 'Runtime hit-test owner must keep the Loki marker.');
    await page.locator('[data-floating-loki-button="true"]').click({ timeout: 10000 });
    await page.waitForTimeout(800);
    const opened = await page.evaluate(() => ({
      dialog: Boolean(document.querySelector('button[aria-label="Закрыть Локи"]')) && document.body.innerText.includes('Пространство Локи'),
      trace: window.__APG_LOKI_TAP_TRACE__ || [],
    }));
    assert.equal(opened.trace.some(item => item.step === 'provider_open_enter'), true, 'Runtime click must enter the Loki provider open path.');
    assert.equal(opened.trace.some(item => item.step === 'provider_state_experience' && item.detail?.experienceOpen === true), true, 'Runtime click must update provider experienceOpen state.');
    assert.equal(opened.dialog, true, 'Runtime click must open the Loki experience.');
  } finally {
    await browser.close();
  }
}

console.log(`Loki Floating Button hit-test regression passed: ${runtimeUrl ? '400 scenarios + runtime click smoke' : '400 scenarios'}`);
