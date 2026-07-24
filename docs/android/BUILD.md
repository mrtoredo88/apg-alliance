# Android build

## Release signing

Release credentials must remain outside Git. The build reads:

- `APG_ANDROID_KEYSTORE`
- `APG_ANDROID_KEY_ALIAS`
- `APG_ANDROID_STORE_PASSWORD`
- `APG_ANDROID_KEY_PASSWORD`

If all four variables are present, `assembleRelease` and `bundleRelease` produce
signed artifacts. If they are absent, the existing unsigned development workflow
continues to work.

For the local APG owner environment, credentials are stored with owner-only
permissions in `~/Documents/APG-Android-Signing/signing.env`.

## Требования

- Node.js, совместимый с проектом.
- JDK 21.
- Android SDK Platform 36.
- Android SDK Build Tools 35/36.

## Команды

```bash
npm install
npm run android:sync
npm run android:debug
npm run android:release
```

Артефакты:

- `android/app/build/outputs/apk/debug/app-debug.apk`
- `android/app/build/outputs/apk/release/app-release-unsigned.apk`
- `android/app/build/outputs/bundle/release/app-release.aab`

Release artifacts намеренно не используют committed signing credentials. Production keystore, passwords и signing properties нельзя добавлять в Git.
