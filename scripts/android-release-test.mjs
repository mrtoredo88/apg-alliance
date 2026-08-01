import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeDeepLink } from '../src/native/deepLinks.js';

assert.equal(normalizeDeepLink('https://myapg.ru/partner/coffee'), '/partner/coffee');
assert.equal(normalizeDeepLink('myapg://profile/user-1'), '/profile/user-1');
assert.equal(normalizeDeepLink('https://myapg.ru/messages/dialog-1'), '/messages?dialogId=dialog-1');
assert.equal(normalizeDeepLink('https://evil.example/profile/1'), '/');

const manifest = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
assert.match(manifest, /android\.permission\.CAMERA/);
assert.doesNotMatch(manifest, /REQUEST_INSTALL_PACKAGES/);
assert.match(manifest, /android:autoVerify="true"/);

const assetLinks = JSON.parse(fs.readFileSync('public/.well-known/assetlinks.json', 'utf8'));
assert.equal(assetLinks[0].target.package_name, 'ru.myapg.app');

const nativePush = fs.readFileSync('src/native/push.js', 'utf8');
assert.doesNotMatch(nativePush, /console\.(log|info).*token/i);
assert.match(nativePush, /push:registerNative/);

const serverPush = fs.readFileSync('server/src/routes/send-push.js', 'utf8');
assert.match(serverPush, /sendEachForMulticast/);
assert.doesNotMatch(serverPush, /skippedLegacyFirebaseTokens/);

console.log('Android release contract: OK');
