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
assert.doesNotMatch(assetLinks[0].target.sha256_cert_fingerprints[0], /REPLACE|TODO/i);
assert.match(assetLinks[0].target.sha256_cert_fingerprints[0], /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/);

const nativePush = fs.readFileSync('src/native/push.js', 'utf8');
assert.doesNotMatch(nativePush, /console\.(log|info).*token/i);
assert.match(nativePush, /push:registerNative/);

const serverPush = fs.readFileSync('server/src/routes/send-push.js', 'utf8');
const packageJson = fs.readFileSync('package.json', 'utf8');
const androidBuild = `${fs.readFileSync('android/build.gradle', 'utf8')}\n${fs.readFileSync('android/app/build.gradle', 'utf8')}`;
assert.match(androidBuild, /versionCode 20101/);
assert.match(androidBuild, /versionName "2\.1\.1"/);
assert.match(serverPush, /sendRuStorePush/);
assert.match(androidBuild, /ru\.rustore\.sdk:pushclient/);
assert.match(androidBuild, /I8pESpf4UeWxkCYrWrDdSO-wfps2-Fne/);
assert.match(androidBuild, /APG_ANDROID_KEYSTORE/);
assert.match(androidBuild, /signingConfig signingConfigs\.release/);
assert.doesNotMatch(`${nativePush}\n${serverPush}\n${packageJson}\n${androidBuild}`, /firebase-admin|@capacitor\/push-notifications|google-services|sendEachForMulticast/i);
assert.match(manifest, /ru\.rustore\.sdk\.pushclient\.MESSAGING_EVENT/);

console.log('Android release contract: OK');
