import assert from 'node:assert/strict';
import { LOKI_PERSONALITY_MODES, PersonalityEngine, selectPersonalityPhrase } from '../src/loki/core/modules/PersonalityEngine.js';
import { PERSONALITY_BLOCKED_EVENTS, isPersonalityUnsafe } from '../src/loki/personality/PersonalitySafety.js';
import { personalityLibraryCapacity } from '../src/loki/personality/personalityPhrasePacks.js';
import { rememberPersonalityPhrase } from '../src/loki/personality/PersonalityMemory.js';

assert.ok(personalityLibraryCapacity() >= 300);

const roles = ['user', 'partner', 'expert', 'owner', 'super_admin', 'admin', 'editor', 'moderator', 'analyst'];
const panels = ['home', 'partners', 'experts', 'events', 'news', 'profile', 'rewards', 'dashboard', 'users', 'comments', 'moderation', 'errors', 'analytics', 'notifs', 'prizes', 'automation', 'system'];
for (const role of roles) {
  for (const panel of panels) {
    const phrase = selectPersonalityPhrase({ event: 'success', mode: 'charismatic', context: { actor: { role }, user: { currentPanel: panel } }, force: true, random: () => 0 });
    assert.ok(phrase?.text);
    assert.ok(!/ChatGPT|как языковая модель|не могу иметь мнение/i.test(phrase.text));
  }
}

for (const event of PERSONALITY_BLOCKED_EVENTS) {
  assert.equal(selectPersonalityPhrase({ event, mode: 'charismatic', force: true }), null);
}
for (const message of ['Ошибка авторизации', 'Потеря данных', 'Критическая проблема безопасности', 'Финансовая операция не выполнена']) {
  assert.equal(isPersonalityUnsafe({ event: 'success', text: message }), true);
}

const professional = PersonalityEngine.shape({ result: { text: 'Задача выполнена.', personalityEvent: 'success' }, context: { personality: { mode: LOKI_PERSONALITY_MODES.PROFESSIONAL } }, random: () => 0 });
assert.equal(professional.text, 'Задача выполнена.');
assert.equal(professional.personalityPhraseId, null);

let history = [];
const ids = [];
for (let index = 0; index < 3; index += 1) {
  const phrase = selectPersonalityPhrase({ event: 'deploy_success', mode: 'charismatic', context: { user: { currentPanel: 'admin' } }, history, force: true, random: () => 0 });
  ids.push(phrase.id);
  history = rememberPersonalityPhrase(history, phrase);
}
assert.equal(new Set(ids).size, 3);

const critical = PersonalityEngine.shape({ result: { text: 'Критическая ошибка безопасности.', personalityEvent: 'success', critical: true }, context: { personality: { mode: 'charismatic' } }, random: () => 0 });
assert.equal(critical.personalityPhraseId, null);
assert.equal(critical.text, 'Критическая ошибка безопасности.');

const longSession = PersonalityEngine.shape({ result: { text: 'Готово.' }, context: { personality: { mode: 'charismatic' }, memory: { sessionStartedAt: '2026-07-11T08:00:00Z', lastSeenAt: '2026-07-11T08:00:00Z', conversationCount: 8 } }, random: () => 0, now: new Date('2026-07-11T12:00:00Z') });
assert.equal(longSession.personalityEvent, 'long_session');
assert.ok(longSession.personalityPhraseId);

console.log(`Loki Personality Engine V1: ${personalityLibraryCapacity()} contextual variants, ${roles.length} roles, ${panels.length} sections, tests passed`);
