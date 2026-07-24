# APG Android Edition v1.1 — Runtime Compatibility Report

Дата проверки: 24 июля 2026.

## Результат

Android-контейнер отделён от PWA-режима без изменения бизнес-логики, API,
Identity, маршрутов или web/PWA-поведения.

- Capacitor определяется через официальный runtime API, без эвристик user agent.
- PWA install prompt и кнопка установки не показываются внутри Android.
- Service Worker не регистрируется в Android WebView и удаляется, если остался
  от прежнего запуска.
- Web/PWA продолжает использовать прежнюю регистрацию Service Worker и
  `beforeinstallprompt`.
- Диагностика авторизации маркирует контейнер как `android`.
- Android Back использует существующую историю панелей АПГ: сначала закрывает
  внутренний экран, затем выходит с главного экрана.
- Cleartext traffic остаётся запрещённым; `allowNavigation` и App Links не
  добавлялись.

## Проверено

Автоматически:

- `npm run test:android-runtime`
- `npm run test:pwa`
- `npm run test:identity`
- `npm run test:scanner-camera`
- production build и architecture guard
- `npx cap sync android`
- Gradle debug/release APK и release AAB

На Android 15 emulator:

- чистая установка и запуск;
- Home открывается без PWA install prompt;
- каталог WebView содержит Local Storage и IndexedDB;
- каталог Service Worker не создаётся;
- Android Back из экрана «Задания» возвращает на Home, Activity не закрывается.

## Совместимость

### Полностью совместимо

- React/Vite bundle в Capacitor WebView.
- HTTPS production API.
- `localStorage` и IndexedDB.
- Существующая панельная навигация после подключения Android Back.
- Web/PWA install flow вне нативного контейнера.

### Требует проверки на физическом устройстве

- вход, выход, восстановление сессии и обновление токена реального аккаунта;
- cookies при полном production Identity flow;
- камера и browser-based QR scanner;
- выбор и загрузка файлов;
- clipboard и Web Share fallback;
- внешние ссылки в установленных Android-приложениях;
- cold/warm start и память на устройстве среднего класса.

### Отложено по требованиям этапа

- App Links и Deep Links;
- native Camera, QR и Share;
- Push, Biometrics и Secure Storage.

## Production readiness

Фундамент готов для внутреннего Android QA. Публикация пока не рекомендуется:
нужны production signing/keystore, физическое устройство, полный Identity
regression и отдельное решение по App Links и внешним ссылкам.

Известный baseline проекта не менялся: `npm audit` сообщает 31 уязвимость
зависимостей (2 low, 18 moderate, 9 high, 2 critical). Автоматический
`audit fix` не выполнялся, чтобы не внести несвязанные или breaking-изменения.

## Следующий этап

1. Пройти Identity matrix на двух физических устройствах Android 10 и Android 15+.
2. Проверить камеру, файлы, clipboard, Share и внешние ссылки.
3. Завести production upload key и Play signing workflow отдельно от репозитория.
4. После отдельного согласования реализовать App Links и native QR.

