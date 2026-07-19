import { readFileSync } from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`✗ ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
}

const guide = readFileSync('src/components/onboarding/PwaInstallGuide.jsx', 'utf8');
const userApp = readFileSync('src/UserApp.jsx', 'utf8');
const profile = readFileSync('src/ProfilePanel.jsx', 'utf8');

assert(guide.includes('export function shouldShowPwaInstallGuide'), 'install guide exposes deterministic visibility guard');
assert(guide.includes('export function shouldShowPwaEmailHint'), 'email hint exposes deterministic visibility guard');
assert(guide.includes("matchMedia?.('(display-mode: standalone)')"), 'standalone display-mode is checked');
assert(guide.includes('navigator?.standalone === true'), 'iOS standalone mode is checked');
assert(guide.includes('beforeinstallprompt'), 'Android beforeinstallprompt is supported');
assert(guide.includes('PWA_INSTALL_GUIDE_HIDDEN_KEY'), 'permanent install-guide dismissal key exists');
assert(guide.includes('PWA_INSTALL_GUIDE_SESSION_KEY'), 'session install-guide dismissal key exists');
assert(guide.includes('PWA_EMAIL_HINT_HIDDEN_KEY'), 'PWA email hint dismissal key exists');
assert(guide.includes('data-pwa-install-guide'), 'install guide has a stable smoke-test selector');
assert(guide.includes('data-pwa-email-hint'), 'email hint has a stable smoke-test selector');
assert(guide.includes('Добро пожаловать в АПГ'), 'welcome copy is present');
assert(guide.includes('После установки'), 'post-install email guidance is highlighted');
assert(guide.includes('Войдите по электронной почте'), 'standalone PWA email prompt is present');
assert(guide.includes('Нажмите «Поделиться»'), 'iOS Safari install instructions are present');

assert(userApp.includes("import { EmailAuth } from './EmailAuth.jsx';"), 'UserApp reuses existing EmailAuth');
assert(userApp.includes('PwaInstallGuide'), 'UserApp renders mobile browser install guide');
assert(userApp.includes('PwaEmailLoginHint'), 'UserApp renders standalone PWA email hint');
assert(userApp.includes('shouldShowPwaInstallGuide({ user, isVk: vkShell })'), 'UserApp evaluates install guide conditions with current user');
assert(userApp.includes('shouldShowPwaEmailHint({ user, isVk: vkShell })'), 'UserApp evaluates email hint conditions with current user');
assert(userApp.includes('!showOnboarding && !isScannerOpen && !loggedOut'), 'UserApp avoids stacking onboarding with active app blockers');
assert(userApp.includes('data-pwa-email-auth'), 'PWA email login opens in a stable portal');

assert(profile.includes('Для первого входа рекомендуем использовать электронную почту'), 'profile guest login recommends email before Telegram');
assert(profile.includes('Telegram можно привязать к аккаунту'), 'Telegram remains available as a secondary login method');

console.log('PWA first-launch onboarding checks passed.');
