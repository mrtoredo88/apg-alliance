import assert from 'node:assert/strict';
import fs from 'node:fs';

const userApp = fs.readFileSync(new URL('../src/UserApp.jsx', import.meta.url), 'utf8');
const home = fs.readFileSync(new URL('../src/HomePanelV2.jsx', import.meta.url), 'utf8');
const desktop = fs.readFileSync(new URL('../src/components/DesktopUI.jsx', import.meta.url), 'utf8');

assert.match(userApp, /readCachedProfileAvatar\(userData\?\.id\)/, 'Startup must restore the cached avatar before rendering.');
assert.match(userApp, /const profileDocPromise = !isGuest[\s\S]*UserApp\.profile\.prefetch/, 'Private profile loading must start independently of public catalog loading.');
assert.ok(userApp.indexOf('const profileDocPromise = !isGuest') < userApp.indexOf('const _loadCritical ='), 'Avatar prefetch must start before catalog requests.');
assert.match(userApp, /persistProfileAvatar\(String\(userData\.id\), avatar\)/, 'Fresh avatars must be cached for the next startup.');
assert.match(home, /loading="eager" fetchPriority="high"/, 'Home avatar must load eagerly.');
assert.match(desktop, /loading="eager" fetchPriority="high"/, 'Desktop avatar must load eagerly.');

console.log('profile-avatar-startup-test: ok');
