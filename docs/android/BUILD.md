# Android build

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
