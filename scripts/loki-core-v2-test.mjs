import assert from 'node:assert/strict';
import { ActionEngine, AnalyticsEngine, LokiModuleRegistry, PlannerEngine, ScenarioRegistry, VoiceEngine, compactLokiMemory } from '../src/loki/core/v2/index.js';
import { LOKI_SCENARIOS } from '../src/loki/core/brain/lokiScenarios.js';
import { prepareLokiSpeechText, selectLokiVoice } from '../src/loki/lokiVoice.js';

const registry = new ScenarioRegistry([{ id: 'test.one', title: 'Test', role: 'user', intent: 'test.one' }]);
assert.equal(registry.size, 1);
assert.equal(registry.get('test.one').requiredPermissions.length, 0);
assert.throws(() => registry.register({ id: 'test.one', title: 'Duplicate' }), /Duplicate/);

const modules = new LokiModuleRegistry([{ id: 'testModule', priority: 1, roles: ['user'], canHandle: () => true, handle: () => ({ ok: true }) }]);
assert.equal((await modules.resolve({ context: { actor: { role: 'user' } } })).result.ok, true);

let opened = false;
const actions = new ActionEngine({ clientActions: { openNews: () => { opened = true; } } });
await actions.execute({ type: 'openNews' }, { role: 'user' });
assert.equal(opened, true);
await assert.rejects(() => actions.execute({ type: 'createNews', requiredPermissions: ['draft:content'] }, { role: 'user' }), /прав/);

const compacted = compactLokiMemory({ email: 'private@example.com', lastQueries: Array.from({ length: 30 }, (_, index) => ({ text: String(index) })) });
assert.equal(compacted.email, undefined);
assert.equal(compacted.lastQueries.length, 20);

const analytics = AnalyticsEngine.event('scenario.used', { intent: 'events.best_today', durationMs: 320 });
assert.equal(analytics.durationBucket, 'normal');
assert.equal(Object.hasOwn(analytics, 'query'), false);

const voice = new VoiceEngine({ speechSynthesisApi: null });
voice.configure({ mode: 'both', rate: 3 });
assert.equal(voice.rate, 1.8);
assert.equal(voice.enqueue('Проверка'), true);
voice.stop();

const selectedVoice = selectLokiVoice([
  { name: 'Yuri', lang: 'ru-RU' },
  { name: 'Milena Premium', lang: 'ru-RU' },
  { name: 'Samantha', lang: 'en-US' },
]);
assert.equal(selectedVoice.name, 'Milena Premium');
assert.equal(
  prepareLokiSpeechText('✨ **Привет!** Подробнее: https://myapg.ru'),
  'Привет! Подробнее:',
);

const plan = PlannerEngine.handle({ context: { actor: { role: 'admin' } } });
assert.equal(plan.intent, 'planner.event_creation');
assert.equal(plan.requiresConfirmation, true);
assert.equal(LOKI_SCENARIOS.length >= 60, true);

console.log(`Loki Core V2: ${LOKI_SCENARIOS.length} scenarios, tests passed`);
