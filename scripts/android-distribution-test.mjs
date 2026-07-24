import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateAndroidUpdate, normalizeVersionCode } from '../src/platform/androidUpdate.js';
import { normalizeExternalUrl } from '../src/platform/externalLinks.js';

assert.equal(normalizeVersionCode('10100'), 10100);
assert.equal(normalizeVersionCode('broken'), 0);
assert.deepEqual(evaluateAndroidUpdate(10100, { versionCode: 10100 }), { available: false, required: false });
assert.equal(evaluateAndroidUpdate(10000, { versionCode: 10100, minimumVersionCode: 1 }).available, true);
assert.equal(evaluateAndroidUpdate(10000, { versionCode: 10100, minimumVersionCode: 10100 }).required, true);

globalThis.window = { location: { origin: 'https://myapg.ru' } };
assert.equal(normalizeExternalUrl('javascript:alert(1)'), null);
assert.equal(normalizeExternalUrl('http://example.com'), null);
assert.equal(normalizeExternalUrl('tel:+79990000000'), 'tel:+79990000000');
assert.equal(normalizeExternalUrl('https://myapg.ru/android'), 'https://myapg.ru/android');

const gradle = readFileSync('android/app/build.gradle', 'utf8');
const properties = readFileSync('android/release.properties', 'utf8');
const landing = readFileSync('public/android', 'utf8');
const deploy = readFileSync('deploy-frontend.sh', 'utf8');
const userApp = readFileSync('src/UserApp.jsx', 'utf8');

assert.match(properties, /VERSION_CODE=10200/);
assert.match(properties, /VERSION_NAME=1\.2\.0/);
assert.match(gradle, /versionCode apgVersionCode/);
assert.match(gradle, /versionName apgVersionName/);
assert.match(landing, /Скачать APK для Android/);
assert.match(landing, /android-release\.json/);
assert.match(deploy, /--exclude "downloads\/\*"/);
assert.match(deploy, /--content-type "text\/html; charset=utf-8"/);
assert.match(userApp, /<AndroidUpdateBanner \/>/);

console.log('Android distribution and update checks passed.');
