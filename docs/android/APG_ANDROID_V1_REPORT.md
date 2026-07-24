# APG Android Edition v1 — итоговый отчёт

Дата проверки: 2026-07-24

Ветка: `codex/apg-android-v1`

Базовый commit: `b32e5191`

Package ID: `ru.myapg.app`

Название: `АПГ`

## Результат этапа

Текущий React/Vite-проект технически может быть упакован в Android-приложение через Capacitor без изменения backend, API, PostgreSQL, Identity, маршрутов, бизнес-логики, UI и PWA.

Создан самостоятельный Android Studio/Gradle project. Production web build, Capacitor sync и Android debug/release/bundle build проходят. Нативные функции и плагины не добавлялись.

Foundation считается работоспособным, но не готовым к production-публикации: release не подписан production-ключом, App Links отсутствуют по условиям этапа, авторизация и QR/камера требуют полного ручного device QA, а PWA install prompt отображается и внутри Capacitor WebView.

## Конфигурация

- Capacitor: `8.4.2` (стабильный релиз на дату проверки).
- Android compile/target SDK: 36.
- Android min SDK: 29 (Android 10).
- Java для локальной проверки: Temurin 21.0.11.
- Gradle: 8.14.3.
- Cleartext HTTP: запрещён в Capacitor config и Android Manifest.
- WebView debugging: выключен.
- Backup приложения: выключен.
- Разрешения: `INTERNET`; опасные runtime permissions не добавлены.
- Cordova plugins: отсутствуют. Сгенерированный Capacitor bridge-модуль с именем `capacitor-cordova-android-plugins` пуст и не означает подключение Cordova-плагинов.

## Артефакты

| Артефакт | Размер | Статус |
|---|---:|---|
| `app-debug.apk` | 18 861 083 B (17.99 MiB) | подписан стандартным debug key, устанавливается |
| `app-release-unsigned.apk` | 16 647 442 B (15.88 MiB) | unsigned, только для локальной проверки сборки |
| `app-release.aab` | 11 832 255 B (11.28 MiB) | unsigned, не публиковался |

## Runtime-измерения

Методика: debug APK, Android 15 / API 35 ARM64 emulator, Pixel 6 profile, cold emulator, данные после загрузки WebView. Эти цифры являются базовой лабораторной точкой, а не показателями реального production-устройства.

| Метрика | Результат |
|---|---:|
| Первый cold activity start | 3 723 ms |
| Повторный process cold start | 2 715 ms |
| Возврат существующей task из Home | 701 ms |
| Память после первого запуска | 106 966 KB PSS / 231 640 KB RSS |
| Память после повторного запуска | 105 635 KB PSS / 234 936 KB RSS |
| Установленный base APK | 18 861 083 B |
| Данные debug-приложения после запуска | 1 272 KiB |
| Приблизительный footprint сразу после установки/запуска | 19.2 MiB |

WebView создал отдельные каталоги Local Storage, Session Storage, IndexedDB, WebStorage, databases и Service Worker. Это подтверждает доступность инфраструктуры хранения; долговременная корректность данных и миграций требует device QA.

Home загрузился до существующего onboarding/install диалога. На эмуляторе после первого запуска экран стал интерактивным примерно в пределах 30 секунд, включая Firebase/production network bootstrap. Точное время Home сейчас нельзя отделить от onboarding и сети без изменения приложения или добавления instrumentation, что запрещено этим этапом.

## Compatibility Report

### Полностью совместимо

- React 18 и Vite production bundle.
- BrowserRouter и существующие path-маршруты внутри локального WebView origin.
- HTTPS-запросы к production API.
- `localStorage`, `sessionStorage`, IndexedDB и Firebase persistent local cache.
- Firebase Auth web SDK и Firestore web SDK на уровне сборки/WebView API.
- Обычные React-компоненты, portals, inline styles и lazy chunks.
- Clipboard API в поддерживаемом Android System WebView.
- Обычные file inputs и web file picker.
- Launcher icons, adaptive icons и splash resources созданы.
- Android Back Button имеет стандартное Capacitor/WebView history-поведение; собственный override не добавлялся.

### Требует проверки на физическом устройстве

- Email OTP: вход, выход, восстановление сессии, token refresh и перезапуск.
- Telegram bot/auth flow и возврат из внешнего приложения.
- VK Bridge fallback вне VK Mini App.
- Cookies, если они появятся в отдельных внешних auth-flow; основная Identity-модель опирается на Firebase/local storage.
- Firestore offline persistence после kill/reboot и при нестабильной сети.
- Camera через `getUserMedia`, разрешение WebView и QR scanning.
- File upload из камеры/галереи.
- Clipboard read/write на разных версиях Android.
- Web Share (`navigator.share`) и его fallback.
- Внешние ссылки, карты, Telegram/VK links и возврат в приложение.
- Back Button для modal/sheet/portal и вложенных маршрутов.
- CSP каждого внешнего production endpoint.

### Может вызвать проблемы

- PWA install prompt отображается внутри установленного Capacitor-приложения. Исправление должно быть отдельным platform-aware изменением с web regression QA.
- Service Worker/PWA Web Push нельзя считать Android push-механизмом. Нативный push запрещён на этом этапе и не добавлялся.
- App Links/intent filters отсутствуют. Ссылки `https://myapg.ru/...` пока не открывают Android-приложение как подтверждённые App Links.
- QR Scanner использует browser camera stack; производительность и permission UX могут отличаться от Chrome/PWA.
- Большие chunks: современный `AdminPanel` около 536 KB minified, legacy Firebase chunk около 599 KB, legacy `UserApp` около 815 KB. Они увеличивают parse/startup cost.
- Первый bootstrap зависит от Firebase и production API; на эмуляторе интерактивный Home появился заметно позже запуска Activity.
- Browser notifications, `PushManager` и installability checks могут иметь иной результат в WebView.
- `window.open(..., "_blank")` и внешние auth callbacks требуют проверки политики открытия в System WebView.

### Не рекомендуется

- Включать cleartext HTTP, mixed content или global file access.
- Добавлять `allowNavigation: ["*"]`.
- Подменять production API локальным server URL в committed config.
- Включать WebView debugging в release.
- Использовать текущий unsigned release для распространения.
- Добавлять Firebase Android SDK или `google-services.json` до отдельного решения: текущая Firebase-интеграция является web SDK внутри WebView.
- Пытаться сделать PWA Service Worker заменой нативным Android push/App Links.

## Firebase audit

Исторически присутствуют:

- `firebase` — frontend web SDK: Auth, Firestore, Messaging/Web Push.
- `firebase-admin` — backend dependency.
- `firebase-tools` — development/emulator tooling.
- Firebase Auth и Firestore активно используются существующей production-архитектурой.
- В `src/firebase.js` указан `storageBucket`, но основной файловый storage — Yandex S3; прямого внедрения Firebase Storage в Android не выполнено.
- Firebase Messaging импортируется динамически для существующего Web Push.
- Сгенерированный `android/app/build.gradle` содержит неактивную стандартную проверку `google-services.json`; файла нет, Google Services plugin и новые Firebase Android dependencies не подключены.
- Firebase Analytics и Crashlytics не обнаружены и не добавлены.

## PWA regression

Файлы `public/manifest.json`, `public/sw.js`, регистрация Service Worker, install prompt, offline cache и version update не изменялись. Android assets получают копию результата `vite build` через `cap sync`; web/PWA deployment config не менялся.

Production web build и architecture guard проходят. Полный browser install/offline acceptance остаётся отдельным реальным PWA QA, но кодовой регрессии от Android foundation нет.

## Проверки

- `npm run build` — успешно.
- Vite dev server — успешно, ready за 1 207 ms.
- `npm run test:pwa` — успешно.
- `npm run test:identity` — успешно.
- `npm run test:scanner-camera` — успешно.
- Gradle `assembleDebug assembleRelease bundleRelease` — успешно.
- Android install/launch на API 35 emulator — успешно.
- APK metadata — `ru.myapg.app`, `АПГ`, min SDK 29, target SDK 36.
- `npm run lint` — не проходит из-за 139 существующих ошибок вне Android foundation (`ExpertCabinetPage.jsx`, `reward-service.js`, Identity service и Vite build globals). Android generated assets исключены из ESLint; существующие файлы намеренно не исправлялись, поскольку это вне scope.

## Production Readiness Report

Статус: **FOUNDATION READY / PRODUCTION RELEASE NOT READY**.

Готово:

- отдельная ветка и отдельный Android project;
- воспроизводимые build/sync команды;
- корректные package ID, app name и min SDK;
- debug APK, release APK, AAB;
- HTTPS-only и минимальные permissions;
- приложение устанавливается и запускается на Android emulator;
- web storage и IndexedDB создаются;
- production logic и PWA не менялись.

Перед production release обязательно:

1. Создать защищённый upload keystore вне Git и настроить signing через локальные/CI secrets.
2. Выполнить manual auth matrix на Android 10, 12, 14, 15/16: email, Telegram, logout, restart, token refresh, offline/online.
3. Проверить QR/camera/file picker на физическом устройстве.
4. Принять отдельное решение по platform-aware suppression PWA install prompt внутри Capacitor.
5. Реализовать и проверить App Links отдельным этапом.
6. Определить Android push strategy отдельным этапом.
7. Провести external links/back button/share/clipboard matrix.
8. Проверить privacy policy, Data Safety и Play signing перед публикацией.
9. Повторить performance measurements на low/mid/high physical devices с release build.

## Architecture Report

Capacitor добавлен как внешний platform shell:

```text
React/Vite/PWA source
        |
        | npm run build
        v
      dist/
        |
        | cap sync android
        v
Android WebView shell (ru.myapg.app)
        |
        +--> existing HTTPS API
        +--> existing Firebase Web SDK
        +--> existing Identity
```

Backend, PostgreSQL, Firestore rules, API contracts, routes, Loki, CRM, Workspace, Booking и Referral не затронуты. Android project является source artifact и хранит только platform config/resources плюс копируемый web bundle в build assets.

## Рекомендации следующего этапа

1. Сначала выполнить Android Auth & Navigation QA и убрать только подтверждённые platform-specific несовместимости.
2. Затем отдельно внедрить App Links и routing tests.
3. После этого — нативный QR/camera permission flow и Android Share.
4. Затем — secure session storage с migration/fallback plan, не заменяя Identity.
5. Push и biometrics оставить последними независимыми capability-релизами.
6. Не оптимизировать bundle до получения profiler trace; первыми кандидатами являются legacy bundle и тяжёлые admin chunks.
