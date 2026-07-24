import { readFileSync } from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    console.error(`✗ ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
}

const runtime = readFileSync('src/platform/runtime.js', 'utf8');
const guide = readFileSync('src/components/onboarding/PwaInstallGuide.jsx', 'utf8');
const profile = readFileSync('src/ProfilePanel.jsx', 'utf8');
const main = readFileSync('src/main.jsx', 'utf8');
const userApp = readFileSync('src/UserApp.jsx', 'utf8');
const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');

assert(runtime.includes('Capacitor.isNativePlatform()'), 'native runtime uses the Capacitor platform source of truth');
assert(runtime.includes("Capacitor.getPlatform() : 'web'"), 'runtime keeps an explicit web fallback');
assert(guide.includes('if (isNativeApp() || isVk'), 'PWA onboarding is suppressed in native shells');
assert(guide.includes('if (isNativeApp()) return undefined;'), 'native shell does not subscribe to beforeinstallprompt');
assert(profile.includes('!isNativeApp() && !isStandalone'), 'profile install action stays hidden in native shells');
assert(main.includes('const noServiceWorker = isNativeApp() ||'), 'native shell disables PWA service worker registration');
assert(userApp.includes('if (isNativeApp()) return getNativePlatform();'), 'auth diagnostics identify the native platform');
assert(userApp.includes("CapacitorApp.addListener('backButton'"), 'Android Back delegates to the existing panel history');
assert(userApp.includes('if (goBackPanel()) return;'), 'Android Back closes an internal view before exiting');
assert(userApp.includes("CapacitorApp.addListener('appUrlOpen'"), 'verified APG links are forwarded to the existing deep-link parser');
assert(manifest.includes('android:usesCleartextTraffic="false"'), 'Android keeps cleartext traffic disabled');
assert(manifest.includes('android:autoVerify="true"'), 'App Links require Android domain verification');
assert(manifest.includes('android:host="myapg.ru"'), 'App Links are restricted to the APG production host');

console.log('Android runtime compatibility checks passed.');
