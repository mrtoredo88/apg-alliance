import { chromium } from 'playwright';

/* global process */

const targetUrl = process.argv[2] || process.env.STARTUP_URL || process.env.SMOKE_URL || 'https://myapg.ru/';
const runs = Number(process.env.STARTUP_RUNS || 100);
const concurrency = Math.max(1, Math.min(8, Number(process.env.STARTUP_CONCURRENCY || 4)));
const waitMs = Number(process.env.STARTUP_WAIT_MS || 15000);
const settleMs = Number(process.env.STARTUP_SETTLE_MS || 250);
const timeoutMs = Number(process.env.STARTUP_TIMEOUT_MS || 22000);
const scenarioTimeoutMs = Number(process.env.STARTUP_SCENARIO_TIMEOUT_MS || 28000);
const totalTimeoutMs = Number(process.env.STARTUP_TOTAL_TIMEOUT_MS || Math.max(90000, Math.ceil(runs / concurrency) * (scenarioTimeoutMs + 1000)));

const startedAt = Date.now();

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

function log(message, detail = null) {
  const elapsed = `${Date.now() - startedAt}ms`;
  const suffix = detail ? ` ${JSON.stringify(detail)}` : '';
  console.log(`[STARTUP-STABILITY] ${elapsed} ${message}${suffix}`);
}

function normalizeUrl(value) {
  return new URL(value || 'https://myapg.ru/').toString();
}

function isIgnoredError(value) {
  return ignoredErrors.some(pattern => pattern.test(String(value || '')));
}

function activeHandlesSummary() {
  const handles = typeof process._getActiveHandles === 'function' ? process._getActiveHandles() : [];
  return handles.reduce((acc, handle) => {
    const name = handle?.constructor?.name || 'Unknown';
    acc[name] = Number(acc[name] || 0) + 1;
    return acc;
  }, {});
}

function withTimeout(promise, ms, detail) {
  let timer = 0;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error(`timeout after ${ms}ms`);
        error.detail = detail;
        reject(error);
      }, ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function collectDiagnostics(page, failedStage) {
  if (!page || page.isClosed()) return { failedStage, diagnosticsError: 'page_closed' };
  return page.evaluate(({ markers, stage }) => {
    const performanceMarks = window.__APG_PERFORMANCE__?.marks?.slice(-12) || [];
    const lastPerformanceMark = performanceMarks.length ? performanceMarks[performanceMarks.length - 1] : null;
    const bootstrapMarks = performanceMarks.filter(item => String(item.stage || '').startsWith('bootstrap_'));
    const lastBootstrapMark = bootstrapMarks.length ? bootstrapMarks[bootstrapMarks.length - 1] : null;
    return {
      failedStage: stage,
      fatalTextSeen: window.__APG_FATAL_TEXT_SEEN || [],
      bootTrace: sessionStorage.getItem('apg_boot_trace') || '',
      lastStartupError: sessionStorage.getItem('apg_last_startup_error') || '',
      rootHtmlLength: document.getElementById('root')?.innerHTML?.length || 0,
      bodyText: document.body?.innerText || '',
      lastPerformanceMark,
      lastBootstrapStage: lastBootstrapMark?.stage || '',
      firebaseStartupSnapshot: window.__APG_FIREBASE_STARTUP__ || null,
      performanceTail: performanceMarks,
      serviceWorkerController: Boolean(navigator.serviceWorker?.controller),
    };
  }, { markers: fatalMarkers, stage: failedStage }).catch(error => ({ failedStage, diagnosticsError: error?.message || String(error) }));
}

async function closeContext(context, index) {
  if (!context) return;
  log(`scenario ${index + 1}/${runs} cleanup`);
  await withTimeout((async () => {
    const pages = context.pages();
    for (const page of pages) await page.close().catch(() => {});
    for (const worker of context.serviceWorkers()) {
      await worker.evaluate(() => self.registration?.unregister?.()).catch(() => {});
    }
    await context.close().catch(() => {});
  })(), 5000, { stage: 'cleanup', index });
}

async function runOne(browser, index, url) {
  const mode = index % 2 === 0 ? 'mobile' : 'desktop';
  let context = null;
  let page = null;
  let failedStage = 'init';
  const errors = [];

  log(`scenario ${index + 1}/${runs}`, { mode, url });

  try {
    return await withTimeout((async () => {
      failedStage = 'new_context';
      context = await browser.newContext({
        viewport: mode === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 },
        isMobile: mode === 'mobile',
        hasTouch: mode === 'mobile',
      });

      failedStage = 'add_init_script';
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

      failedStage = 'new_page';
      page = await context.newPage();
      page.on('pageerror', error => {
        const text = error?.message || String(error);
        if (!isIgnoredError(text)) errors.push(text);
      });
      page.on('console', message => {
        if (message.type() !== 'error') return;
        const text = message.text();
        if (!isIgnoredError(text)) errors.push(text);
      });

      failedStage = 'navigation';
      log(`scenario ${index + 1}/${runs} navigate`, { mode });
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

      failedStage = 'root_ready';
      failedStage = 'app_ready';
      log(`scenario ${index + 1}/${runs} wait app ready`, { waitMs });
      await page.waitForFunction((markers) => {
        const rootReady = (document.getElementById('root')?.innerHTML?.length || 0) > 1000;
        const text = document.body?.innerText || '';
        return rootReady && !markers.some(marker => text.includes(marker));
      }, fatalMarkers, { timeout: waitMs }).catch(() => {});
      await page.waitForTimeout(settleMs);

      failedStage = 'diagnostics';
      const result = await collectDiagnostics(page, failedStage);
      const finalFatal = fatalMarkers.find(marker => result.bodyText?.includes(marker)) || '';
      const transientFatal = (result.fatalTextSeen || []).filter(marker => marker !== finalFatal);
      const ok = response?.status() < 400
        && result.rootHtmlLength > 1000
        && !finalFatal
        && transientFatal.length === 0
        && errors.length === 0;

      const output = {
        index,
        ok,
        mode,
        status: response?.status() || 0,
        finalFatal,
        transientFatal,
        errors: errors.slice(0, 5),
        rootHtmlLength: result.rootHtmlLength,
        failedStage: ok ? '' : failedStage,
        diagnosticsError: ok ? '' : result.diagnosticsError || '',
        bootTrace: ok ? '' : result.bootTrace,
        lastStartupError: ok ? '' : result.lastStartupError,
        lastPerformanceMark: ok ? null : result.lastPerformanceMark,
        lastBootstrapStage: ok ? '' : result.lastBootstrapStage,
        firebaseStartupSnapshot: ok ? null : result.firebaseStartupSnapshot,
      };
      log(`scenario ${index + 1}/${runs} ${ok ? 'OK' : 'FAILED'}`, {
        status: output.status,
        rootHtmlLength: output.rootHtmlLength,
        errors: output.errors.length,
      });
      return output;
    })(), scenarioTimeoutMs, { stage: failedStage, index, mode });
  } catch (error) {
    const diagnostics = await collectDiagnostics(page, failedStage);
    const output = {
      index,
      ok: false,
      mode,
      status: 0,
      finalFatal: '',
      transientFatal: [],
      errors: [error?.message || String(error)],
      rootHtmlLength: diagnostics.rootHtmlLength || 0,
      failedStage,
      diagnosticsError: diagnostics.diagnosticsError || '',
      pendingTask: error?.detail || null,
      activeHandles: activeHandlesSummary(),
      lastPerformanceMark: diagnostics.lastPerformanceMark || null,
      lastBootstrapStage: diagnostics.lastBootstrapStage || '',
      firebaseStartupSnapshot: diagnostics.firebaseStartupSnapshot || null,
    };
    log(`scenario ${index + 1}/${runs} FAILED`, output);
    return output;
  } finally {
    await closeContext(context, index).catch(error => {
      log(`scenario ${index + 1}/${runs} cleanup failed`, { error: error?.message || String(error) });
    });
  }
}

async function run() {
  const url = normalizeUrl(targetUrl);
  log('start', { url, runs, concurrency, waitMs, settleMs, timeoutMs, scenarioTimeoutMs, totalTimeoutMs });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  let cursor = 0;

  async function worker(workerIndex) {
    while (cursor < runs) {
      const index = cursor;
      cursor += 1;
      log(`worker ${workerIndex} start scenario ${index + 1}/${runs}`);
      const result = await runOne(browser, index, url);
      results.push(result);
      log(`worker ${workerIndex} done scenario ${index + 1}/${runs}`, { ok: result.ok });
    }
  }

  try {
    await withTimeout(Promise.all(Array.from({ length: concurrency }, (_, index) => worker(index + 1))), totalTimeoutMs, {
      stage: 'total',
      browserContexts: browser.contexts().length,
      activeHandles: activeHandlesSummary(),
    });
  } finally {
    log('browser cleanup', { contexts: browser.contexts().length });
    await withTimeout(browser.close().catch(() => {}), 8000, { stage: 'browser_close' }).catch(error => {
      log('browser cleanup timeout', { error: error?.message || String(error) });
    });
  }

  const failures = results.filter(item => !item.ok).sort((a, b) => a.index - b.index);
  const summary = {
    url,
    runs,
    passed: runs - failures.length,
    failed: failures.length,
    durationMs: Date.now() - startedAt,
    failures: failures.slice(0, 5),
    activeHandles: activeHandlesSummary(),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (failures.length) throw new Error(`Startup stability failed: ${failures.length}/${runs}`);
}

run().catch(error => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
