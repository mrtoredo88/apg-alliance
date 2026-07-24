# APG Android 1.2.0 — release readiness

Статус: подписанная сборка подготовлена локально, не опубликована.

## Готово

- Финальная launcher icon: монограмма «АПГ», adaptive foreground/background.
- Проверены маски Pixel, Samsung, Xiaomi и компактная квадратная маска.
- Финальный portrait/landscape splash screen.
- Launcher label подтверждён ресурсами и APK: `АПГ`.
- Нативный QR-сканер через Android camera UI.
- Android Sharesheet через Capacitor Share.
- Опциональная защита приложения биометрией или кодом устройства.
- Настройки защиты хранятся через AES-GCM и Android Keystore.
- HTTPS App Links `myapg.ru` с domain verification.
- Подготовлены три Android-скриншота для RuStore.
- Обновлены RuStore listing, privacy policy и user agreement.
- Signing keystore и env имеют две owner-only копии; SHA-256 совпадает.

## Firebase

В Android 1.2.0 не добавлены FCM, Firebase Analytics, Crashlytics или другие
новые Firebase-компоненты. Push не подключён: официальный Android push transport
через Capacitor требует FCM и противоречит принятому направлению отказа от
Firebase.

Текущие пакеты `firebase` и `firebase-admin` удалить одним Android-коммитом
нельзя: production-клиент, Identity, часть экранов, серверных маршрутов и
миграционных инструментов всё ещё содержат активные импорты. Требуется отдельная
поэтапная миграция на PostgreSQL/API с регрессионной проверкой.

## Проверки

- Production Vite build.
- Capacitor sync с шестью Android-плагинами.
- Gradle `assembleRelease` и `bundleRelease`.
- APK Signature Scheme v2, RSA 4096.
- Package `ru.myapg.app`, minSdk 29, targetSdk 36.
- Установка и запуск в Android 15 emulator.
- Визуальная проверка splash, Home и profile/store screens.

## Перед публикацией

- Проверить QR, Share и биометрию на физическом Android.
- Заполнить контактный email и реквизиты правообладателя в RuStore.
- Создать отдельный тестовый аккаунт для модератора.
- Пройти фактическую анкету возраста и Data Safety в кабинете RuStore.
- Не публиковать сборку до подтверждения владельца.
