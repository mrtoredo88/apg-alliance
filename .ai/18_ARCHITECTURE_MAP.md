# Архитектура АПГ

## Точка входа

`src/main.jsx` инициализирует VK Bridge, сетевую диагностику, React root и регистрацию service worker.

Legacy hash-ссылки вида `/#/...` переписываются в path-based URL до рендера приложения.

## App

`src/App.jsx` использует `BrowserRouter`, `Routes`, `Suspense` и `ErrorBoundary`.

Основные маршруты:

- `/` → `UserApp`
- `/admin` → `AdminPanel`
- `/admin-app` → `AdminPanel`
- `/news` и `/news/:id` → `UserApp`
- `/events` и `/event/:id` → `UserApp`
- `/partner/:id` → `UserApp`
- `/expert/:id` → `UserApp`
- `/assistant` → `AssistantMiniApp`
- `/network-diagnostics` → `NetworkDiagnosticsPage`

## UserApp

`src/UserApp.jsx` — основной пользовательский shell приложения.

Подтверждённые обязанности:

- загрузка пользовательских данных и публичных сущностей;
- управление `activePanel`;
- подключение lazy-loaded экранов;
- обработка deep links на новости, события, партнёров и экспертов;
- подключение `LokiProvider` и `LokiAssistant`;
- передача `appActions` и `appState` для Локи.

## AdminPanel

`src/AdminPanel.jsx` — административная панель для `/admin` и `/admin-app`.

Подтверждённые зоны ответственности:

- административная авторизация;
- чтение и управление основными сущностями;
- системный статус;
- новости и комментарии;
- события;
- AI/import инструменты;
- работа с ошибками и диагностикой.

## Авторизация

Подтверждённые механизмы:

- VK Bridge в `src/main.jsx` / пользовательском shell;
- Firebase Auth;
- Email OTP через backend;
- Telegram bot/auth flow через backend;
- административная авторизация через backend API и Firebase token.

## Новости

Ключевые файлы:

- `src/NewsPage.jsx`
- `src/newsUtils.js`
- `api/news-comments.js`
- `server/src/routes/news-comments.js`

Подтверждённые возможности:

- лента новостей;
- открытие статьи;
- VK-import;
- canonical/legacy id;
- комментарии и реакции;
- сохранение и read later;
- share links без hash;
- deep link `/news/:id`;
- контекстный Локи через `activeContext`.

## Центр событий

Ключевые файлы:

- `src/EventsPage.jsx`
- `src/EventDetailSheet.jsx`
- `src/EventsCalendar.jsx`

Подтверждённые возможности:

- афиша событий;
- карточка события bottom sheet;
- deep links `/events` и `/event/:id`;
- APG V2 визуальный стиль;
- подготовка операционного центра событий.

## Партнёры

Ключевые файлы:

- `src/PartnerPage.jsx`
- `src/PartnerCabinetPage.jsx`
- `src/PartnerQRSection.jsx`
- `src/OffersPage.jsx`

Подтверждённые возможности:

- каталог/предложения партнёров;
- карточка партнёра;
- кабинет партнёра;
- QR-раздел;
- deep link `/partner/:id`.

## Эксперты

Ключевые файлы:

- `src/ExpertsPage.jsx`
- `src/ExpertCabinetPage.jsx`

Подтверждённые возможности:

- каталог экспертов;
- карточки экспертов;
- кабинет эксперта;
- deep link `/expert/:id`.

## Профиль

Ключевой файл: `src/ProfilePanel.jsx`.

Подтверждённые возможности:

- данные пользователя;
- ключи и прогресс;
- избранное;
- сохранённые новости;
- переходы в кабинеты партнёра/эксперта;
- настройки и пользовательские действия.

## Локи

Ключевые файлы:

- `src/loki/LokiProvider.jsx`
- `src/loki/LokiAssistant.jsx`
- `src/loki/LokiExperience.jsx`
- `src/LokiPage.jsx`
- `src/loki/core/LokiCore.js`

Подтверждённые возможности:

- глобальный provider;
- floating assistant;
- полноэкранный опыт `LokiExperience`;
- action routing через `LOKI_APP_ACTIONS`;
- память в localStorage;
- рекомендации и сценарии;
- контекст новости через `activeContext` и `lastContext`.

## Firebase

Ключевой файл: `src/firebase.js`.

Подтверждённые роли:

- клиентский Firestore SDK;
- Firebase Auth;
- Firebase Messaging при поддержке браузера;
- Firebase Admin SDK на backend.

## Backend

Основные реализации:

- `api/*.js` — Vercel Serverless Functions;
- `server/src/routes/*.js` — Fastify routes для Yandex Serverless Containers.

Текущий `API_BASE_URL` в `src/constants.js` указывает на Yandex Container.

## PWA

Ключевые файлы:

- `public/manifest.json`
- `public/sw.js`
- `src/main.jsx`
- `src/App.jsx`

Подтверждённые возможности:

- standalone manifest;
- `scope: /`;
- `start_url: /`;
- navigation fallback на `/index.html`;
- push notification click с фокусом существующего окна приложения.

## Telegram

Подтверждённая роль: Telegram bot/auth flow.

Telegram Mini App не используется.

Backend endpoints описаны в `.ai/04_API.md` и реализуются в `api/` / `server/src/routes/`.

## VK Mini App

Подтверждённая роль: основная платформа приложения.

Код использует VK Bridge init в `src/main.jsx`; проектная документация указывает VK App ID `54601851`.

## Основные потоки данных

- Пользовательский frontend читает публичные данные из Firestore и вызывает backend API для защищённых операций.
- Админка читает списки и выполняет защищённые изменения через backend API с Firebase token.
- Новости VK синхронизируются через backend и сохраняются в Firestore.
- Фото загружаются в Yandex Cloud S3.
- PWA navigation requests обслуживаются service worker fallback на `index.html`.
- Локи получает `appState`, `appActions`, память и optional `activeContext`, затем возвращает текст, карточки или действие.

## Основные зависимости

- React 18
- Vite
- React Router DOM
- Firebase SDK
- Firebase Admin SDK
- VK Bridge
- Yandex Cloud S3
- Vercel Functions
- Fastify
- Telegram Bot API
- Web Push / FCM

## Технические риски

- Документация части `.ai` может отставать от текущего кода; перед изменениями нужно сверять исходники.
- В рабочем дереве могут существовать незакоммиченные или сгенерированные изменения; коммиты нужно собирать только из конкретных файлов.
- PWA/service worker и Safari/WebKit требуют отдельной ручной проверки после изменений маршрутизации, lazy chunks или cache strategy.
- Backend имеет две реализации API (`api/` и `server/`); изменения endpoint логики нужно синхронизировать при необходимости.
