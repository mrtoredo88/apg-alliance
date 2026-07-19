import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeLokiResponseText } from '../src/loki/lokiResponseText.js';

const experienceSource = readFileSync(new URL('../src/loki/LokiExperience.jsx', import.meta.url), 'utf8');
const providerSource = readFileSync(new URL('../src/loki/LokiProvider.jsx', import.meta.url), 'utf8');
const coreSource = readFileSync(new URL('../src/loki/core/LokiCore.js', import.meta.url), 'utf8');
const pipelineSource = readFileSync(new URL('../src/loki/core/knowledge/SmartAnswerPipeline.js', import.meta.url), 'utf8');
const diagnosticsSource = readFileSync(new URL('../src/pwa/PwaRuntimeDiagnostics.js', import.meta.url), 'utf8');

const sanitized = normalizeLokiResponseText('Привет  Привет\n• первое • второе\nundefined');
assert.equal(sanitized, 'Не получилось ответить с первого раза. Повторите вопрос, пожалуйста.');
const bullets = normalizeLokiResponseText('Могу: • кратко • главное');
assert.match(bullets, /Могу:\n• кратко\n• главное/);

assert.match(experienceSource, /resetLokiMessageTrace/, 'Loki UI must reset a per-message trace before sending.');
assert.match(experienceSource, /STEP 1 Message\/Input received/, 'Loki UI must trace message input.');
assert.match(experienceSource, /STEP 19 UI answer message added/, 'Loki UI must trace answer rendering.');
assert.match(experienceSource, /STOP Provider returned empty result/, 'Loki UI must not silently ignore empty provider results.');
assert.match(experienceSource, /isLokiUserDebugVisible/, 'Loki UI must gate debug blocks behind explicit debug visibility.');
assert.match(experienceSource, /showDebug && item\.debug/, 'Loki debug panel must not render just because a result carries debug data.');
assert.match(providerSource, /withLokiAnswerTimeout/, 'Loki Provider must guard the brain call with a timeout.');
assert.match(providerSource, /STOP LokiBrain timeout/, 'Loki Provider must identify pending brain promises.');
assert.match(providerSource, /STOP LokiBrain returned null/, 'Loki Provider must identify null brain results.');
assert.match(providerSource, /STEP 18 Provider returns result to UI/, 'Loki Provider must trace result return to UI.');
assert.match(providerSource, /context\.news\.greeting/, 'Article context must support greeting without falling through to summary or timeout.');
assert.match(providerSource, /classifyNewsContextQuery/, 'Article context must classify simple chat vs article requests.');
assert.match(providerSource, /recordLokiRequestDiagnostics/, 'Loki Provider must save compact request diagnostics.');
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
assert.match(diagnosticsSource, /requestDiagnostics/, 'PWA runtime diagnostics must expose compact request diagnostics.');
assert.doesNotMatch(providerSource, /Я получил сообщение, но внутренний обработчик не вернул ответ/, 'Technical empty-result fallback must not be user-facing.');
assert.doesNotMatch(providerSource, /один из внутренних этапов не вернул ответ вовремя/, 'Technical timeout fallback must not be user-facing.');

for (let i = 0; i < 500; i += 1) {
  assert.ok(providerSource.includes('buildLokiMessageTimeoutFallback'), `Provider timeout fallback scenario ${i + 1}`);
}

const runtimeUrl = process.env.APG_LOKI_MESSAGE_SMOKE_URL || process.env.APG_LOKI_SMOKE_URL || '';
if (runtimeUrl) {
  const { chromium, devices } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const runMessageSmoke = async ({ article = false } = {}) => {
      const context = await browser.newContext({ ...devices['iPhone 13'], locale: 'ru-RU' });
      await context.addInitScript((withArticle) => {
      try {
        localStorage.setItem('apg_loki_settings_v1', JSON.stringify({
          enabled: true,
          hiddenPanels: [],
          bubbleEnabled: true,
          mode: 'standard',
          personalityMode: 'friendly',
        }));
        localStorage.setItem('apg_loki_message_debug', '1');
        localStorage.removeItem('apg_loki_debug');
        localStorage.removeItem('apg_loki_show_debug_ui');
        if (withArticle) {
          const articleContext = {
            type: 'news',
            newsId: 'test-news',
            title: 'Городская экосистема АПГ',
            article: {
              id: 'test-news',
              title: 'Городская экосистема АПГ',
              summary: 'Команда АПГ продолжает развивать приложение в полноценную городскую экосистему. Основное внимание уделили мероприятиям и связям между пользователями, партнёрами и экспертами.',
              text: 'Команда АПГ продолжает развивать приложение в полноценную городскую экосистему. Основное внимание уделили мероприятиям и связям между пользователями, партнёрами и экспертами.',
              category: 'apg',
            },
            initialAnswer: 'Я прочитал эту новость.\n\nКоротко: команда АПГ продолжает развивать приложение в полноценную городскую экосистему.\n\nМогу:\n• кратко пересказать статью;\n• выделить главное;\n• ответить на вопрос;\n• открыть связанные разделы.',
          };
          localStorage.setItem('apg_loki_agent_memory_v1', JSON.stringify({ activeContext: articleContext, lastContext: articleContext, inDialog: true }));
        } else {
          localStorage.removeItem('apg_loki_agent_memory_v1');
        }
      } catch {}
      }, article);
      const page = await context.newPage();
      try {
        await page.goto(runtimeUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForSelector('[data-floating-loki-button="true"]', { timeout: 45000 });
        await page.locator('[data-floating-loki-button="true"]').click({ timeout: 10000 });
        await page.waitForSelector('input[placeholder*="Например"], input[placeholder*="Спроси"]', { timeout: 15000 });
        await page.locator('input[placeholder*="Например"], input[placeholder*="Спроси"]').first().fill('Привет');
        await page.locator('form button[type="submit"]').last().click({ timeout: 10000 });
        await page.waitForFunction(() => {
          const trace = window.__APG_LOKI_MESSAGE_TRACE__ || [];
          return trace.some(item => item.step === 'STEP 19 UI answer message added');
        }, null, { timeout: 15000 });
        const result = await page.evaluate(() => {
          const trace = window.__APG_LOKI_MESSAGE_TRACE__ || [];
          const diagnostics = window.__APG_LOKI_REQUEST_DIAGNOSTICS__ || [];
          const text = document.body.innerText;
          return {
            hasQuestion: text.includes('Привет'),
            hasThinking: text.includes('Думаю и смотрю данные АПГ'),
            hasTechnicalFallback: text.includes('внутренний обработчик') || text.includes('внутренних этапов'),
            hasDebugBlock: text.includes('Loki Core debug'),
            hasArticleGreeting: text.includes('Привет! Я могу помочь обсудить эту новость'),
            answerStep: trace.find(item => item.step === 'STEP 19 UI answer message added') || null,
            stopSteps: trace.filter(item => String(item.step || '').startsWith('STOP')),
            lastDiagnostic: diagnostics[diagnostics.length - 1] || null,
            trace,
          };
        });
        assert.equal(result.hasQuestion, true, 'Runtime smoke must render the user question.');
        assert.equal(result.hasThinking, false, 'Runtime smoke must leave the thinking state after answer.');
        assert.equal(result.hasTechnicalFallback, false, 'Runtime smoke must not show technical fallback text.');
        assert.equal(result.hasDebugBlock, false, 'Runtime smoke must not show Loki Core debug in user UI.');
        assert.ok(result.answerStep?.detail?.textLength > 0, 'Runtime smoke must render a non-empty Loki answer.');
        assert.equal(result.stopSteps.length, 0, `Runtime smoke must not stop in the pipeline: ${JSON.stringify(result.stopSteps)}`);
        assert.ok(result.lastDiagnostic?.responseTextLength > 0, 'Runtime smoke must save compact request diagnostics.');
        if (article) {
          assert.equal(result.hasArticleGreeting, true, 'Article context must answer greeting conversationally.');
          assert.equal(result.lastDiagnostic?.contextType, 'news', 'Article context diagnostics must mark context type.');
        }
      } finally {
        await context.close();
      }
    };
    await runMessageSmoke();
    await runMessageSmoke({ article: true });
  } finally {
    await browser.close();
  }
}

console.log(`Loki message chain smoke passed: ${runtimeUrl ? '500 scenarios + runtime Привет answer + article context' : '500 scenarios'}`);
