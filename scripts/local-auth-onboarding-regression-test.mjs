import assert from 'node:assert/strict';
import fs from 'node:fs';

const userApp = fs.readFileSync(new URL('../src/UserApp.jsx', import.meta.url), 'utf8');
const emailAuth = fs.readFileSync(new URL('../src/EmailAuth.jsx', import.meta.url), 'utf8');
const home = fs.readFileSync(new URL('../src/HomePanelV2.jsx', import.meta.url), 'utf8');

assert.match(userApp, /if \(loggedOut && !consentRequest\)/, 'Logged-out state renders the auth gate while allowing legal consent to open.');
assert.match(userApp, /data-logged-out-auth[\s\S]*<EmailAuth onSuccess=\{handleEmailAuthSuccess\} \/>/, 'Logged-out screen immediately contains email authorization.');
assert.doesNotMatch(userApp, /handleLoginAfterLogout/, 'The obsolete intermediate relogin screen is removed.');
assert.match(userApp, /panelHistoryRef\.current = \['home'\];[\s\S]*setActivePanel\('home'\)/, 'Successful email authorization returns to home.');
assert.match(emailAuth, /typeof onCancel === 'function'/, 'Email authorization can be used as a non-dismissible auth gate.');
assert.match(userApp, /onOpenOnboarding: \(\) => setShowOnboarding\(true\)/, 'Home receives an action that reopens onboarding without resetting the profile.');
assert.match(home, /aria-label="Показать приветственный онбординг"[\s\S]*onClick=\{onOpenOnboarding\}/, 'The top home help button opens onboarding.');
assert.doesNotMatch(home, /aria-label=\{loki\.settings\.dockedToHeader \? 'Открыть Локи' : 'Профиль'\}/, 'The top button is no longer replaced by the profile or docked Loki avatar.');

console.log('local-auth-onboarding-regression-test: ok');
