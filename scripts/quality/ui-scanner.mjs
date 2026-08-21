import { chromium } from 'playwright';
import process from 'node:process';
import { QUALITY_ROUTES, QUALITY_VIEWPORTS, SAFE_CONTROL_PATTERN, DANGEROUS_CONTROL_PATTERN } from './catalog.mjs';
import { finding } from './core.mjs';

export async function runUiScanner(options = {}) {
  const baseUrl = options.baseUrl || process.env.QUALITY_BASE_URL || 'http://127.0.0.1:4175';
  const browser = await chromium.launch({ headless: true });
  const findings = [];
  let pages = 0;
  let controls = 0;
  try {
    for (const viewport of QUALITY_VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.isMobile,
        hasTouch: viewport.isMobile,
      });
      const page = await context.newPage();
      page.on('pageerror', error => findings.push(finding({
        scanner: 'ui', category: 'pageerror', fingerprint: `pageerror:${error.name}`,
        message: error.message, location: page.url(),
      })));
      page.on('console', message => {
        if (message.type() !== 'error' || /ResizeObserver loop|AbortError|Failed to load resource/i.test(message.text())) return;
        findings.push(finding({
          scanner: 'ui', category: 'console', fingerprint: `console:${message.text().slice(0, 120)}`,
          message: message.text(), location: page.url(),
        }));
      });
      page.on('response', response => {
        if (response.status() < 500) return;
        findings.push(finding({
          scanner: 'ui', category: 'network', fingerprint: `http:${response.status()}:${new URL(response.url()).pathname}`,
          message: `HTTP ${response.status()}`, location: response.url(),
        }));
      });

      for (const route of QUALITY_ROUTES) {
        const target = new URL(route, baseUrl).toString();
        const response = await page.goto(target, { waitUntil: 'commit', timeout: 5000 }).catch(error => {
          findings.push(finding({ scanner: 'ui', severity: 'critical', category: 'navigation', fingerprint: `route:${route}`, message: error.message, location: target }));
          return null;
        });
        if (!response && !page.url().startsWith(baseUrl)) continue;
        pages += 1;
        await page.waitForTimeout(250);
        await page.locator('[data-apg-splash-root="true"]').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
        const rootLength = await page.locator('#root').evaluate(node => node.innerHTML.length).catch(() => 0);
        if (rootLength < 200) findings.push(finding({
          scanner: 'ui', severity: 'critical', category: 'render', fingerprint: `empty-route:${route}`,
          message: 'React root is empty or incomplete', location: target,
        }));
        const interactive = page.locator('button, a[href], input, select, textarea, [role="button"], [role="link"]');
        controls += await interactive.count();
        const brokenLinks = await page.locator('a[href]').evaluateAll((links, origin) => links
          .map(link => ({ text: link.textContent?.trim(), href: link.getAttribute('href') }))
          .filter(link => !link.href || link.href === '#' || link.href.startsWith('javascript:')), baseUrl);
        brokenLinks.forEach(link => findings.push(finding({
          scanner: 'ui', severity: 'warning', category: 'link', fingerprint: `broken-link:${route}:${link.text}`,
          message: 'Link has no navigable target', location: `${target}#${link.text || 'unnamed'}`,
        })));
        const buttons = page.getByRole('button');
        const buttonCount = await buttons.count();
        for (let index = 0; index < Math.min(buttonCount, 80); index += 1) {
          const button = buttons.nth(index);
          const label = (await button.innerText().catch(() => '')).trim();
          if (!label || DANGEROUS_CONTROL_PATTERN.test(label) || !SAFE_CONTROL_PATTERN.test(label)) continue;
          if (await button.isDisabled().catch(() => true)) continue;
          const isTopmost = await button.evaluate(node => {
            const rect = node.getBoundingClientRect();
            const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
            return top === node || node.contains(top);
          }).catch(() => false);
          if (!isTopmost) continue;

          let trialError = null;
          await button.click({ trial: true, timeout: 750 }).catch(error => { trialError = error; });
          if (trialError) {
            // React overlays and onboarding transitions can move a safe control between layout frames.
            // Re-check once after layout settles; report only a persistent failure.
            await page.waitForTimeout(250);
            const retry = page.getByRole('button', { name: label, exact: true }).first();
            const retryVisible = await retry.isVisible().catch(() => false);
            const retryEnabled = retryVisible && !(await retry.isDisabled().catch(() => true));
            if (retryEnabled) {
              trialError = null;
              await retry.click({ trial: true, timeout: 1000 }).catch(error => { trialError = error; });
            } else {
              trialError = null;
            }
          }
          if (trialError) findings.push(finding({
            scanner: 'ui', category: 'control', fingerprint: `unclickable:${route}:${label}`,
            message: `Control is not clickable: ${label}`, location: target, evidence: trialError.message,
          }));
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  return { id: 'ui', status: findings.some(item => ['critical', 'error'].includes(item.severity)) ? 'FAIL' : 'PASS', metrics: { pages, controls }, findings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runUiScanner();
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exitCode = 1;
}
