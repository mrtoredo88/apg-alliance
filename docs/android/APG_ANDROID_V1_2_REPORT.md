# APG Android v1.2 — Distribution & Update Foundation

Дата: 24 июля 2026.

## Что реализовано

- Управляемая версия Android в `android/release.properties`.
- `versionName 1.1.0`, `versionCode 10100`; Android 10+ (`minSdk 29`).
- Подписанные APK/AAB через release-keystore вне Git.
- Официальная страница `https://myapg.ru/android`.
- Release manifest `https://myapg.ru/downloads/android-release.json`.
- Проверка обновлений только в Capacitor Android, без влияния на Web/PWA.
- Необязательное и обязательное обновление через `minimumVersionCode`.
- Обновление открывает системную защищённую browser tab; автоматическая
  установка APK не выполняется.
- HTTPS App Links для `myapg.ru`, привязанные к production-сертификату.
- Внешние URL проходят протокольный guard: только HTTPS, `tel:` и `mailto:`.
- Каталог `downloads/` защищён от удаления обычным frontend deploy.

## Release contract

`android-release.json` содержит:

- package ID;
- version name/code;
- минимально допустимый version code;
- минимальную версию Android;
- URL APK и landing page;
- размер и SHA-256 APK;
- SHA-256 signing certificate;
- дату публикации и release notes.

`minimumVersionCode` по умолчанию равен `1`. Его повышение превращает
уведомление в обязательное только для версий ниже указанной.

## Security audit

- Cleartext traffic: запрещён.
- Mixed content: запрещён.
- WebView debugging в release: запрещён.
- Backup приложения: запрещён.
- Exported: только launcher Activity, необходимая для App Links.
- FileProvider: `exported=false`, URI grants включены.
- Runtime permissions: только Internet; Camera/File native permissions не добавлены.
- Signing secrets: вне Git, owner-only permissions.
- APK verification: `apksigner`, signature scheme v2, RSA 4096.
- Firebase Auth/Firestore остаются историческими web-зависимостями; новые
  Firebase-компоненты Android не добавлялись.

## Emulator QA matrix

| Сценарий | Android 15 | Остальные API |
|---|---:|---:|
| Чистая установка | пройдено | автоматизация подготовлена |
| Запуск Home | пройдено | требуется прогон |
| Android Back | пройдено | требуется прогон |
| Upgrade поверх v1.0 | пройдено (`1 → 10100`) | требуется прогон |
| Сохранение установки | пройдено (`firstInstallTime` сохранён) | требуется прогон |
| App Link `/events` | пройдено, открылся экран событий | требуется прогон |
| Offline/reconnect | требует отдельного network test | требуется прогон |
| Camera/QR | browser regression пройден | физическое устройство желательно |

Физическое устройство всё ещё требуется перед магазинной публикацией для
камеры, OEM WebView, выбора файлов и реального memory pressure.

## Ограничения

- APK вне магазина вызывает системное предупреждение Android.
- Приложение не устанавливает обновления автоматически.
- Полный Identity login/logout/refresh требует тестовых credentials.
- Глобальная миграция всех legacy `window.open` вызовов не выполнялась:
  новый безопасный helper используется для Android distribution flow,
  остальные ссылки сохраняют существующее web-поведение.

## Release procedure

1. Увеличить `VERSION_CODE` и `VERSION_NAME`.
2. Собрать web bundle и выполнить Capacitor sync.
3. Загрузить signing environment вне Git.
4. Собрать release APK/AAB.
5. Проверить APK через `apksigner`.
6. Создать manifest командой `npm run android:release:manifest`.
7. Установить APK поверх предыдущего релиза в emulator.
8. Загрузить APK и manifest.
9. Проверить публичные SHA-256, Content-Type и Content-Disposition.
10. Развернуть `/android` и проверить production smoke.
