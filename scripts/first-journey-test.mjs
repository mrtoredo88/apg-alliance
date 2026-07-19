import { readFileSync } from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`✗ ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
}

const core = readFileSync('src/firstJourney.js', 'utf8');
const card = readFileSync('src/components/onboarding/FirstJourneyCard.jsx', 'utf8');
const userApp = readFileSync('src/UserApp.jsx', 'utf8');
const lokiProvider = readFileSync('src/loki/LokiProvider.jsx', 'utf8');
const lokiExperience = readFileSync('src/loki/LokiExperience.jsx', 'utf8');
const home = readFileSync('src/HomePanelV2.jsx', 'utf8');

assert(core.includes("FIRST_JOURNEY_STORAGE_KEY = 'apg_first_journey_v1'"), 'First Journey uses localStorage-only state');
assert(!core.includes('firebase') && !core.includes('userAction('), 'First Journey core does not use Firestore/API writes');
assert(core.includes("installedDone: Boolean(stored.installedDone || isFirstJourneyStandalone())"), 'installed step is derived from standalone PWA mode');
assert(core.includes('isFirstJourneyEmailUser(user)'), 'email step is derived from existing user identity');
assert(core.includes("activePanel === 'rewards'"), 'rewards step is derived from opening rewards');
assert(core.includes("['partners', 'events', 'dialogs', 'rewards'].includes(activePanel)"), 'explore step completes after one useful section');
assert(core.includes('FIRST_JOURNEY_LOKI_QUESTIONS'), 'Loki quick questions are defined');
assert(core.includes('FIRST_JOURNEY_LOKI_QUESTION_EVENT'), 'Loki quick question event is defined');

['Приложение установлено', 'Войдите по электронной почте', 'Познакомьтесь с Локи', 'Посмотрите подарки', 'Исследуйте АПГ'].forEach(text => {
  assert(core.includes(text), `step exists: ${text}`);
});

['Где выпить кофе?', 'Какие подарки рядом?', 'Что интересного сегодня?', 'Покажи партнёров рядом.'].forEach(text => {
  assert(core.includes(text), `Loki quick prompt exists: ${text}`);
});

assert(card.includes('Добро пожаловать!'), 'home progress card has welcome title');
assert(card.includes('Продолжить'), 'home progress card has continue action');
assert(card.includes('data-first-journey-card'), 'home progress card has stable selector');
assert(card.includes('data-first-journey-modal'), 'journey modal has stable selector');
assert(card.includes('Войти по электронной почте'), 'email step CTA is present');
assert(card.includes('Открыть подарки'), 'rewards step CTA is present');
assert(card.includes('Добро пожаловать в АПГ!'), 'completion message is present');

assert(home.includes('FirstJourneyCard'), 'HomePanel renders FirstJourneyCard');
assert(userApp.includes('syncFirstJourneyDerived({ user, activePanel })'), 'UserApp syncs derived journey progress');
assert(userApp.includes('requestFirstJourneyLokiQuestion(text)'), 'UserApp dispatches Loki quick question requests');
assert(userApp.includes("markFirstJourneyStep('email')"), 'email auth success marks Journey email step');
assert(lokiProvider.includes('FIRST_JOURNEY_LOKI_QUESTION_EVENT'), 'LokiProvider listens for Journey questions');
assert(lokiProvider.includes("markFirstJourneyStep('loki')"), 'LokiProvider marks Loki step only after answer');
assert(lokiExperience.includes('pendingFirstJourneyQuestion'), 'LokiExperience consumes pending Journey question');

console.log('First Journey v1 checks passed.');
