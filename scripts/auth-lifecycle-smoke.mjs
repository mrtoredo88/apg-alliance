import { chromium } from 'playwright';

const urlList = (process.env.AUTH_LIFECYCLE_URLS || process.env.SMOKE_URL || 'https://myapg.ru/').split(',').map((url) => url.trim()).filter(Boolean);
const timeoutMs = Number(process.env.AUTH_LIFECYCLE_TIMEOUT_MS || 25000);

const manualChecklist = [
  'Login → Logout',
  'Login → Logout → Login',
  'Login → Logout → Login → Logout',
  'Login → Refresh → Logout',
  'Login → закрыть PWA → открыть → Logout',
  'Logout → Refresh',
  'Logout → открыть deep link',
  'Logout → повторный Login',
  'Несколько logout подряд',
  'Logout при частично загруженных данных',
];

const platformChecklist = [
  'iPhone Safari',
  'iPhone PWA',
  'Android Chrome',
  'Samsung Browser',
  'Desktop Safari',
  'Desktop Chrome',
];

const fatalMarkers = [
  'Minified React error',
  'APG-MRLR2SYM',
  'React error #300',
  'What happened',
];

const ignoredConsoleErrors = [
  /ResizeObserver loop/i,
  /ResizeObserver loop limit/i,
  /AbortError/i,
  /ERR_INSUFFICIENT_RESOURCES/i,
];

function normalizeUrl(url) {
  const trimmed = String(url || '').trim();
  if (!trimmed) return 'https://myapg.ru/';
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

function isIgnoredConsoleError(text) {
  return ignoredConsoleErrors.some((pattern) => pattern.test(String(text || '')));
}

async function getScenarioRunner(page) {
  const errors = [];

  page.on('pageerror', error => {
    errors.push({ type: 'pageerror', message: String(error?.message || error) });
  });

  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = String(message.text() || '');
    if (!isIgnoredConsoleError(text)) {
      errors.push({ type: 'console', message: text });
    }
  });

  const hasLogoutScreen = async () => {
    const marker = page.getByText('Вы вышли из аккаунта');
    try {
      await marker.waitFor({ state: 'visible', timeout: 25000 });
      return true;
    } catch {
      return false;
    }
  };

  const getBodyText = async () => {
    try {
      return await page.locator('body').innerText();
    } catch {
      return '';
    }
  };

  const getLocalStorageValue = async (key) => {
    try {
      return await page.evaluate((name) => {
        try { return localStorage.getItem(name); } catch { return null; }
      }, key);
    } catch {
      return null;
    }
  };

  const waitForStableRoot = async () => {
    await page.waitForTimeout(1500);
    const rootHtmlLength = await page.locator('#root').evaluate((node) => node?.innerHTML?.length || 0).catch(() => 0);
    if (!rootHtmlLength || rootHtmlLength < 300) {
      throw new Error('Рендер слишком мал — возможен пустой экран.');
    }
  };

  const run = async () => {
    await waitForStableRoot();
    const bodyText = await getBodyText();
    const hasMarkers = fatalMarkers.filter((marker) => bodyText.includes(marker));
    if (hasMarkers.length) {
      throw new Error(`Найден фатальный текст в интерфейсе: ${hasMarkers.join(', ')}`);
    }
    if (errors.some((entry) => /Minified React error|APG-MRLR2SYM|React error #300/.test(entry.message))) {
      throw new Error(`Fatal runtime errors: ${errors.map((entry) => entry.message).join(' | ')}`);
    }
  };

  const simulateManualLogout = async () => {
    await page.evaluate(() => {
      localStorage.setItem('manualLogout', 'true');
      localStorage.removeItem('apg_gsid');
    });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await run();

    if (!(await hasLogoutScreen())) {
      throw new Error('После установки manualLogout не показан экран «Вы вышли из аккаунта».');
    }
    if ((await getLocalStorageValue('manualLogout')) !== 'true') {
      throw new Error('manualLogout не сохранился после перезагрузки.');
    }
  };

  const clickReLoginButton = async () => {
    const loginButton = page.getByRole('button', { name: 'Войти' }).first();
    await loginButton.click({ timeout: 5000 });
    await page.waitForTimeout(1200);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await run();

    const loginFlag = await getLocalStorageValue('manualLogout');
    if (loginFlag === 'true') {
      throw new Error('После нажатия «Войти» manualLogout не сброшен.');
    }
  };

  const goDeep = async (path) => {
    const url = new URL(path, page.url());
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await run();
  };

  return {
    errors,
    run,
    simulateManualLogout,
    clickReLoginButton,
    goDeep,
    hasLogoutScreen,
    getBodyText,
  };
}

async function runForTarget(baseUrl) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  const target = normalizeUrl(baseUrl);
  const runner = await getScenarioRunner(page);
  const autoScenarios = [];
  const manualScenarios = [];

  try {
    // Базовая загрузка после входа по обычной сессии (или гость).
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await runner.run();

    autoScenarios.push('Базовая проверка загрузки root после загрузки приложения');

    // Scenario: Logout (через принудительный флаг).  Автоматизируем, потому что login flow в e2e неэмулируется полностью.
    await runner.simulateManualLogout();
    autoScenarios.push('Сценарий Logout via manualLogout и проверка экрана выхода');

    // Scenario: Login after logout button.  Проверяем корректное снятие флага и восстановление не-logout рендера.
    await runner.clickReLoginButton();
    autoScenarios.push('Сценарий Войти после выхода');

    // Scenario: Logout → refresh.
    await runner.simulateManualLogout();
    await page.reload({ waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await runner.run();
    autoScenarios.push('Сценарий Logout → Refresh');

    await runner.simulateManualLogout();
    await runner.simulateManualLogout();
    autoScenarios.push('Сценарий несколько Logout подряд');

    // Deep links после Logout.
    await runner.simulateManualLogout();
    await runner.goDeep('/profile');
    if (!(await runner.hasLogoutScreen())) {
      throw new Error('Глубокая ссылка после logout открыла защищённый UI вместо экрана выхода.');
    }
    autoScenarios.push('Сценарий Logout → deep link → открытие экрана выхода');

    // Проверка отсутствия фатальных маркеров в тексте и консоли при разных шагах.
    const bodyText = await runner.getBodyText();
    for (const marker of fatalMarkers) {
      if (bodyText.includes(marker)) {
        throw new Error(`Фатальный маркер найден после logout-сценариев: ${marker}`);
      }
    }

    if (runner.errors.length) {
      const topErrors = runner.errors.slice(0, 6).map((entry) => `${entry.type}: ${entry.message}`);
      throw new Error(`Рантайм-ошибки после logout сценариев: ${topErrors.join(' | ')}`);
    }

    // Сценарии, требующие ручной проверки, добавляем в отчёт.
    manualScenarios.push(...manualChecklist, ...platformChecklist);

    const bodySample = await runner.getBodyText();
    const checkReport = {
      ok: true,
      target,
      status: 'passed',
      automaticScenarios: autoScenarios,
      manualScenarios,
      checks: {
        logoutScreenShown: true,
        manualLogoutFlag: 'true on logout / false on relogin attempt',
        deepLinkAfterLogout: await runner.hasLogoutScreen(),
        bodyTextLength: bodySample.length,
        runtimeErrors: runner.errors.length,
      },
      note: 'Автоматические сценарии покрывают guard root после logout и базовую стабильность; сценарии с реальным login/logout на device-level остаются для ручной проверки.',
    };

    console.log(JSON.stringify(checkReport, null, 2));
    return { ok: true, ...checkReport };
  } catch (error) {
    return {
      ok: false,
      target,
      status: 'failed',
      statusText: error?.stack || error?.message || String(error),
      automaticScenarios: autoScenarios,
      manualScenarios,
      checks: { runtimeErrors: runner.errors.length },
    };
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

(async () => {
  const all = [];
  for (const target of urlList) {
    const result = await runForTarget(target);
    all.push(result);
    if (!result.ok) {
      throw new Error(`auth lifecycle smoke failed on ${result.target || target}: ${result.statusText}`);
    }
  }

  console.log('AUTH_LIFECYCLE_CHECKLIST_REQUIRED:', manualChecklist.join(' | '));
  console.log(JSON.stringify({
    ok: true,
    targets: all.map(item => item.target),
    count: all.length,
    automated: all.flatMap((item) => item.automaticScenarios),
    manual: [...manualChecklist, ...platformChecklist],
  }, null, 2));
})();
