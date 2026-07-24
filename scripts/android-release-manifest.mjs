import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const apkPath = resolve(process.argv[2] || 'android/app/build/outputs/apk/release/app-release.apk');
const outputPath = resolve(process.argv[3] || 'android/app/build/outputs/release/android-release.json');
const properties = Object.fromEntries(
  readFileSync('android/release.properties', 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split('=', 2)),
);
const apk = readFileSync(apkPath);
const manifest = {
  schemaVersion: 1,
  packageId: 'ru.myapg.app',
  versionName: properties.VERSION_NAME,
  versionCode: Number(properties.VERSION_CODE),
  minimumVersionCode: Number(properties.MINIMUM_VERSION_CODE || 1),
  minimumAndroid: 29,
  apkUrl: 'https://myapg.ru/downloads/apg-android.apk',
  landingUrl: 'https://myapg.ru/android',
  sizeBytes: statSync(apkPath).size,
  sha256: createHash('sha256').update(apk).digest('hex'),
  certificateSha256: '2f89749c31aa3478d6c4132bc8fe9906860d90c1490ce65ebd163d428233b717',
  publishedAt: new Date().toISOString(),
  releaseNotes: [
    'Управляемые обновления Android-приложения.',
    'Безопасное открытие страницы загрузки.',
    'Исправления совместимости Android WebView.',
  ],
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(outputPath);
