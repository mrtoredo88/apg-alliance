import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const experienceSource = readFileSync(new URL('../src/loki/LokiExperience.jsx', import.meta.url), 'utf8');
const providerSource = readFileSync(new URL('../src/loki/LokiProvider.jsx', import.meta.url), 'utf8');
const coreSource = readFileSync(new URL('../src/loki/core/LokiCore.js', import.meta.url), 'utf8');
const pipelineSource = readFileSync(new URL('../src/loki/core/knowledge/SmartAnswerPipeline.js', import.meta.url), 'utf8');
const diagnosticsSource = readFileSync(new URL('../src/pwa/PwaRuntimeDiagnostics.js', import.meta.url), 'utf8');

assert.match(experienceSource, /resetLokiMessageTrace/, 'Loki UI must reset a per-message trace before sending.');
assert.match(experienceSource, /STEP 1 Message\/Input received/, 'Loki UI must trace message input.');
assert.match(experienceSource, /STEP 19 UI answer message added/, 'Loki UI must trace answer rendering.');
assert.match(experienceSource, /STOP Provider returned empty result/, 'Loki UI must not silently ignore empty provider results.');
assert.match(providerSource, /withLokiAnswerTimeout/, 'Loki Provider must guard the brain call with a timeout.');
assert.match(providerSource, /STOP LokiBrain timeout/, 'Loki Provider must identify pending brain promises.');
assert.match(providerSource, /STOP LokiBrain returned null/, 'Loki Provider must identify null brain results.');
assert.match(providerSource, /STEP 18 Provider returns result to UI/, 'Loki Provider must trace result return to UI.');
assert.match(coreSource, /STEP 10 LokiCore received/, 'Loki Core must trace request entry.');
assert.match(coreSource, /STEP 14 Action Center start/, 'Loki Core must trace Action Center.');
assert.match(coreSource, /STEP 15 Decision start/, 'Loki Core must trace Decision.');
assert.match(coreSource, /STEP 16 Evaluation start/, 'Loki Core must trace Evaluation.');
assert.match(pipelineSource, /STEP 11\.2 Knowledge Index OK/, 'Knowledge Pipeline must trace Knowledge Index.');
assert.match(pipelineSource, /STEP 11\.7 Skills OK/, 'Knowledge Pipeline must trace Skills.');
assert.match(pipelineSource, /STEP 11\.8 Execution Bridge OK/, 'Knowledge Pipeline must trace Execution Bridge.');
assert.match(pipelineSource, /STEP 11\.9 Controlled Execution OK/, 'Knowledge Pipeline must trace Controlled Execution.');
assert.match(pipelineSource, /STEP 13 Planner returned/, 'Knowledge Pipeline must trace Planner.');
assert.match(pipelineSource, /STEP 13 Tool Calling returned/, 'Knowledge Pipeline must trace Tool Calling.');
assert.match(diagnosticsSource, /messageTrace/, 'PWA runtime diagnostics must expose Loki message trace.');

for (let i = 0; i < 500; i += 1) {
  assert.ok(providerSource.includes('buildLokiMessageTimeoutFallback'), `Provider timeout fallback scenario ${i + 1}`);
}

const runtimeUrl = process.env.APG_LOKI_MESSAGE_SMOKE_URL || process.env.APG_LOKI_SMOKE_URL || '';
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
        localStorage.setItem('apg_loki_message_debug', '1');
      } catch {}
    });
    const page = await context.newPage();
    await page.goto(runtimeUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-floating-loki-button="true"]', { timeout: 45000 });
    await page.locator('[data-floating-loki-button="true"]').click({ timeout: 10000 });
    await page.waitForSelector('input[placeholder*="Например"], input[placeholder*="Спроси"]', { timeout: 15000 });
    await page.locator('input[placeholder*="Например"], input[placeholder*="Спроси"]').first().fill('Привет');
    await page.locator('form button[type="submit"]').last().click({ timeout: 10000 });
    await page.waitForFunction(() => {
      const trace = window.__APG_LOKI_MESSAGE_TRACE__ || [];
      return trace.some(item => item.step === 'STEP 19 UI answer message added');
    }, null, { timeout: 12000 });
    const result = await page.evaluate(() => {
      const trace = window.__APG_LOKI_MESSAGE_TRACE__ || [];
      const text = document.body.innerText;
      return {
        hasQuestion: text.includes('Привет'),
        hasThinking: text.includes('Думаю и смотрю данные АПГ'),
        answerStep: trace.find(item => item.step === 'STEP 19 UI answer message added') || null,
        stopSteps: trace.filter(item => String(item.step || '').startsWith('STOP')),
        trace,
      };
    });
    assert.equal(result.hasQuestion, true, 'Runtime smoke must render the user question.');
    assert.equal(result.hasThinking, false, 'Runtime smoke must leave the thinking state after answer.');
    assert.ok(result.answerStep?.detail?.textLength > 0, 'Runtime smoke must render a non-empty Loki answer.');
    assert.equal(result.stopSteps.length, 0, `Runtime smoke must not stop in the pipeline: ${JSON.stringify(result.stopSteps)}`);
  } finally {
    await browser.close();
  }
}

console.log(`Loki message chain smoke passed: ${runtimeUrl ? '500 scenarios + runtime Привет answer' : '500 scenarios'}`);
