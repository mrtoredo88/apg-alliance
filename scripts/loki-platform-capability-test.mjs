import assert from 'node:assert/strict';

import { runLokiCapabilityEngine } from '../src/loki/core/capabilities/index.js';
import { runCapabilityExecutionBridge } from '../src/loki/core/execution/index.js';
import { validateLokiAction } from '../src/loki/core/actions/ActionValidator.js';
import { LOKI_APP_ACTIONS, createLokiAction } from '../src/loki/lokiActionTypes.js';

function buildContext(devicePlatform) {
  return {
    actor: { role: 'user', permissions: [] },
    user: { id: 'u1', role: 'user', currentPanel: 'home' },
    appState: {
      activePanel: 'home',
      platform: devicePlatform === 'embedded' ? 'vk-miniapp' : 'web-app',
      devicePlatform,
      partners: [{ id: 'p1', name: 'Партнёр АПГ', type: 'partner', catalogPublished: true }],
      experts: [{ id: 'e1', name: 'Эксперт АПГ', type: 'expert', catalogPublished: true }],
      events: [{ id: 'ev1', title: 'Событие АПГ', type: 'event', status: 'published' }],
      news: [{ id: 'n1', title: 'Новость АПГ', type: 'news', status: 'published' }],
      promotions: [{ id: 'pr1', title: 'Акция АПГ', type: 'promotion' }],
    },
  };
}

function runQuery(question, devicePlatform) {
  const context = buildContext(devicePlatform);
  const capability = runLokiCapabilityEngine({
    question,
    context,
    memory: {},
    knowledge: { sources: context.appState },
  }).capabilityContext;
  const execution = runCapabilityExecutionBridge({
    question,
    capabilityContext: capability,
    context,
    knowledge: { sources: context.appState },
  }).executionContext;
  return { capability, execution, context };
}

for (const devicePlatform of ['mobile', 'tablet', 'embedded']) {
  for (const question of ['Что рядом?', 'Покажи партнёров', 'Открой каталог', 'Найди акции рядом']) {
    const { execution } = runQuery(question, devicePlatform);
    assert.notEqual(execution.navigation?.screen, 'partners', `${devicePlatform}: ${question}`);
    assert.notEqual(execution.actionType, LOKI_APP_ACTIONS.OPEN_PARTNERS, `${devicePlatform}: ${question}`);
  }
  const validation = validateLokiAction(createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNERS), {
    appState: buildContext(devicePlatform).appState,
    appActions: { [LOKI_APP_ACTIONS.OPEN_OFFERS]: () => {} },
    actor: { role: 'user' },
  });
  assert.equal(validation.ok, true, `${devicePlatform}: openPartners fallback validates`);
  assert.equal(validation.action.type, LOKI_APP_ACTIONS.OPEN_OFFERS, `${devicePlatform}: openPartners falls back to offers`);
}

{
  const { execution } = runQuery('Покажи партнёров', 'desktop');
  assert.equal(execution.navigation?.screen, 'partners');
  assert.equal(execution.actionType, LOKI_APP_ACTIONS.OPEN_PARTNERS);
}

console.log('Loki platform capability regression passed');
