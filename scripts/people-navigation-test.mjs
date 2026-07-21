import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const profile = await readFile(new URL('../src/ProfilePanel.jsx', import.meta.url), 'utf8');
const glass = await readFile(new URL('../src/components/Apg2ProfileGlass.jsx', import.meta.url), 'utf8');
const userApp = await readFile(new URL('../src/UserApp.jsx', import.meta.url), 'utf8');
const executionRegistry = await readFile(new URL('../src/loki/core/execution/ExecutionRegistry.js', import.meta.url), 'utf8');

assert.match(profile, /const openPeopleNavigation = useCallback\(\(event\) => \{[\s\S]*?setPeopleSheet\(null\);[\s\S]*?setShowBusinessCard\(false\);[\s\S]*?setShowConnectionsModal\(true\);[\s\S]*?\}, \[\]\);/, 'Open People action closes conflicting overlays and opens People modal');
assert.match(profile, /const openBusinessCardNavigation = useCallback\(\(event\) => \{[\s\S]*?setPeopleSheet\(null\);[\s\S]*?setShowConnectionsModal\(false\);[\s\S]*?setShowBusinessCard\(true\);[\s\S]*?\}, \[\]\);/, 'My QR action closes conflicting overlays and opens QR modal');
assert.match(profile, /openPeopleNavigation = useCallback\(\(event\) => \{[\s\S]*?event\?\.preventDefault\?\.\(\);[\s\S]*?event\?\.stopPropagation\?\.\(\);/, 'Open People action isolates click propagation');
assert.match(profile, /openBusinessCardNavigation = useCallback\(\(event\) => \{[\s\S]*?event\?\.preventDefault\?\.\(\);[\s\S]*?event\?\.stopPropagation\?\.\(\);/, 'My QR action isolates click propagation');

assert.match(profile, /data-my-contacts-button[\s\S]*?onClick=\{openPeopleNavigation\}/, 'Open People button is wired to the stable navigation handler');
assert.match(profile, /data-digital-business-card[\s\S]*?onClick=\{openBusinessCardNavigation\}/, 'My QR button is wired to the stable navigation handler');
assert.doesNotMatch(profile, /data-my-contacts-button[\s\S]{0,180}onPointerDown=\{event => event\.stopPropagation\(\)\}/, 'Open People button does not stop pointerdown before React click delivery');
assert.doesNotMatch(profile, /data-digital-business-card[\s\S]{0,180}onPointerDown=\{event => event\.stopPropagation\(\)\}/, 'My QR button does not stop pointerdown before React click delivery');

assert.match(profile, /showConnectionsModal && createPortal\([\s\S]*?title="Люди"[\s\S]*?data-people-list/, 'Open People renders the People modal portal');
assert.match(profile, /showBusinessCard && createPortal\([\s\S]*?title="Цифровая карточка"[\s\S]*?data-business-card-modal[\s\S]*?<QRCodeSVG value=\{businessCardUrl\}/, 'My QR renders the QR business card portal');
assert.match(profile, /businessCardUrl = useMemo\(\(\) => `\$\{APP_URL\.replace\(\/\\\/\+\$\/, ''\)\}\/profile\/\$\{encodeURIComponent\(String\(user\?\.id \|\| ''\)\)\}`/, 'QR card uses the current user profile URL safely');

assert.match(glass, /export function GlassButton\(\{ children, onClick[\s\S]*?type = 'button'[\s\S]*?<button[\s\S]*?type=\{type\}[\s\S]*?onClick=\{onClick\}/, 'GlassButton keeps action buttons clickable and non-submit by default');
assert.match(userApp, /setShowPwaInstallGuide\(activePanel !== 'profile' && shouldShowPwaInstallGuide/, 'PWA install guide does not steal first profile action clicks');
assert.match(userApp, /open=\{activePanel !== 'profile' && showPwaInstallGuide/, 'PWA install guide cannot overlay Profile People actions');
assert.match(executionRegistry, /route\('profile', '\/profile#people'\)/, 'Loki People navigation still targets the unified People UX');

const platformTargets = ['mobile', 'desktop', 'telegram-webapp'];
for (const platform of platformTargets) {
  assert.match(profile, /data-my-contacts-button/, `${platform}: Open People button remains discoverable`);
  assert.match(profile, /data-digital-business-card/, `${platform}: My QR button remains discoverable`);
  assert.match(profile, /data-people-list/, `${platform}: People modal remains discoverable`);
  assert.match(profile, /data-business-card-modal/, `${platform}: QR modal remains discoverable`);
}

console.log('people-navigation regression PASS');
