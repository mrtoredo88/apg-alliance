import process from 'node:process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await page.addInitScript(() => localStorage.setItem('apg_mobile_pwa_onboarding_hidden_v2', '1'));
const base = process.env.APG_TEST_URL || 'http://127.0.0.1:5179';
const active = panel => page.locator(`[data-apg-tab-slot="${panel}"][aria-current="page"]`).waitFor();
async function dismiss() {
  const button = page.getByRole('button', { name: 'Продолжить в браузере', exact: true });
  if (await button.isVisible()) await button.click();
}
try {
  await page.goto(`${base}/?no-sw=1`);
  await active('home');
  await dismiss();
  for (const panel of ['offers', 'events', 'profile', 'home']) {
    await page.locator(`[data-apg-tab-slot="${panel}"]`).click();
    await active(panel);
    assert.equal(new URL(page.url()).pathname, panel === 'home' ? '/' : `/${panel}`);
    await page.locator('body').evaluate(el => {
      for (const [type, x] of [['touchstart', 200], ['touchmove', 30], ['touchend', 30]]) {
        const touch = new Touch({ identifier: 1, target: el, clientX: x, clientY: 250 });
        const target = document.elementFromPoint(195, 250);
        target.dispatchEvent(new TouchEvent(type, { bubbles: true, touches: type === 'touchend' ? [] : [touch], changedTouches: [touch] }));
      }
    });
    await active(panel);
  }
  await page.goBack(); await active('profile');
  await page.goBack(); await active('events');
  await page.goForward(); await active('profile');
  for (const path of ['/events', '/offers', '/profile', '/#/events', '/#/offers', '/#/profile']) {
    await page.goto(`${base}${path}`);
    await active(path.split('/').at(-1));
  }
  await page.goto(`${base}/experts`);
  await page.getByText('Эксперты', { exact: true }).first().waitFor();
  assert.equal(await page.locator('[data-apg-tab-slot="events"][aria-current]').count(), 0);
  await page.goto(`${base}/`); await active('home'); await dismiss();
  const rails = page.locator('[data-apg-horizontal-scroll="true"], [data-horizontal-gesture-boundary="true"]');
  const scrollable = await rails.evaluateAll(nodes => nodes.filter(n => n.scrollWidth > n.clientWidth).map(n => ({ width: n.clientWidth, scrollWidth: n.scrollWidth })));
  assert.ok(scrollable.length >= 3, 'home content rails must remain scrollable');
  const moved = await rails.evaluateAll(nodes => nodes.filter(n => n.scrollWidth > n.clientWidth).map(n => { n.scrollLeft = 150; return n.scrollLeft > 0; }));
  assert.ok(moved.every(Boolean));
  const cdp = await page.context().newCDPSession(page);
  for (let index = 0; index < await rails.count(); index++) {
    const rail = rails.nth(index);
    if (!await rail.evaluate(n => n.scrollWidth > n.clientWidth)) continue;
    await rail.scrollIntoViewIfNeeded();
    await rail.evaluate(n => { n.scrollLeft = 0; });
    const box = await rail.boundingBox();
    const y = Math.max(30, Math.min(650, box.y + box.height / 2));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y }] });
    for (const x of [260, 210, 160, 110, 60]) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.ok(await rail.evaluate(n => n.scrollLeft > 0), 'native touch must scroll the content rail');
    await active('home');
  }
  await active('home');
  console.log(`PASS: mobile buttons, horizontal gestures, browser back/forward, 6 direct/hash URLs, experts route, ${moved.length} scrollable content rails.`);
} finally { await browser.close(); }
