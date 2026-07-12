# АПГ — Альянс Партнёров Города

АПГ — городская PWA-платформа для жителей, партнёров, экспертов и администрации. Приложение объединяет новости, мероприятия, партнёрские предложения, экспертов, QR/ключи, личные кабинеты, Workspace и Локи — интеллектуального помощника платформы.

Этот репозиторий фиксирует production baseline проекта. PWA на `https://myapg.ru` является основной платформой продукта. VK Mini App остаётся дополнительным каналом, но не является основным production-сценарием.

## Основные сценарии

- Жители открывают PWA, читают новости, находят партнёров и экспертов, участвуют в событиях, получают ключи и награды.
- Партнёры и эксперты управляют профилями, заявками, контентом и видимостью через кабинеты и Workspace.
- Администрация модерирует контент, заявки, ошибки, пользователей, партнёров, экспертов и события.
- Локи помогает пользователям и администраторам ориентироваться в приложении, данных и рабочих действиях.

## Архитектура

```text
PWA / Web
  ↓
React 18 + Vite
  ↓
Fastify API / server routes
  ↓
Firebase Firestore
  ↓
Yandex Object Storage
  ↓
Push / Cron / Webhooks
```

Исторически в проекте присутствовали Vercel Serverless functions и VK Mini App hosting. Текущий production baseline фиксирует фактическое рабочее состояние проекта; дальнейшее инфраструктурное разделение выполняется отдельными задачами после baseline.

## Frontend

Frontend написан на React 18 и Vite.

Ключевые файлы:

- `src/UserApp.jsx` — основной shell приложения, bootstrap, авторизация, навигация, PWA/User Mode.
- `src/HomePanelV2.jsx` — главная пользовательская витрина.
- `src/AdminPanel.jsx` — административная панель.
- `src/ProfilePanel.jsx` — профиль пользователя и кабинеты.
- `src/design.js` и `src/components/Apg2ProfileGlass.jsx` — дизайн-токены и APG V2 glass-компоненты.
- `src/workspace/` — Workspace Core и Desktop Workspace.
- `src/businessHub/` — Business Hub.
- `src/loki/` — Локи, его контекст, личность, знания и AI-слои.

Стили в проекте преимущественно inline. Дизайн должен использовать существующие APG V2 tokens и не создавать параллельные визуальные системы.

## Backend

Backend расположен в `server/` и `server-shared/`.

Ключевые части:

- `server/src/routes/` — Fastify routes для публичных данных, авторизации, user actions, admin actions, webhook, push, cron и загрузок.
- `server/src/lib/identityCore.js` — единое ядро идентификации.
- `server-shared/content-lifecycle.js` — общая логика жизненного цикла контента.
- `api/` — legacy serverless endpoints, если они ещё присутствуют в рабочем состоянии проекта.

Документация backend: `docs/backend-architecture.md`.

## Identity Core

Identity Core объединяет разные способы входа и профили пользователя:

- Email auth
- Firebase auth
- Telegram
- VK legacy identity
- canonical user
- роли и связи с партнёром/экспертом

Цель Identity Core — чтобы один человек не распадался на несколько независимых аккаунтов и корректно получал свои роли, кабинеты и доступы.

Документация: `docs/identity-core.md`.

## Workspace

Workspace Core — общий layout-фундамент для desktop, tablet и mobile-сценариев.

Основные зоны:

- header
- left sidebar
- content
- right sidebar / AI Workspace
- bottom bar
- floating panels

Desktop Workspace строится поверх Workspace Core и предназначен для профессиональной работы владельца, администраторов, партнёров и экспертов.

Документация:

- `docs/workspace-core.md`
- `docs/desktop-workspace.md`
- `docs/desktop-ux.md`

## Business Hub

Business Hub — рабочая зона партнёров и экспертов внутри Workspace. Он показывает состояние бизнеса/профиля, рекомендации, задачи, контент, мероприятия и действия, связанные с развитием карточки в АПГ.

Документация: `docs/business-hub.md`.

## Content Lifecycle

Content Lifecycle управляет статусами контента и защищает пользовательское приложение от показа архивных, удалённых или неготовых материалов.

Используется для:

- новостей;
- мероприятий;
- партнёров;
- экспертов;
- публичных данных;
- локального PWA-кэша.

Документация: `docs/content-lifecycle.md`.

## Локи

Локи — интеллектуальный помощник АПГ. Он работает в пользовательском режиме, Workspace, Business Hub, кабинетах и административных сценариях.

В проекте есть:

- единый визуальный компонент Локи;
- Context Engine;
- Personality Engine;
- Admin Assistant;
- knowledge base;
- рекомендации и сценарии действий.

Код расположен в `src/loki/`.

## Структура проекта

```text
src/             frontend React/Vite
server/          Fastify backend and Yandex deploy scripts
server-shared/   shared backend/frontend domain logic
api/             legacy serverless API layer
public/          static public assets and service worker source
scripts/         regression, smoke and maintenance scripts
docs/            architecture documentation
.ai/             AI working documentation and project notes
```

Не коммитить:

- `dist/`
- `node_modules/`
- `.env*`
- локальные сертификаты;
- временные `.tmp*` файлы;
- backup-архивы и release backups.

## Локальный запуск

```bash
npm install
npm run start
```

Локальная production-сборка:

```bash
npm run build
npm run preview
```

Локальная PWA-проверка:

```bash
npm run local:pwa
```

## Тестирование

Основные проверки:

```bash
npm run test:core
npm run test:identity
npm run test:content-lifecycle
npm run test:pwa-user-mode
npm run test:release-parity
npm run smoke:prod
```

`test:core` запускает ключевые regression-тесты ядра: Identity Core, Content Lifecycle, Business Hub и Workspace Core.

## Production

Основной production URL:

```text
https://myapg.ru
```

Проверка версии production:

```bash
curl -fsSL https://myapg.ru/version.json
```

`version.json` должен соответствовать Git commit, из которого собран production.

## Деплой

Текущий baseline фиксирует существующее production-состояние. PWA deploy выполняется через frontend deploy script и Yandex Object Storage. Backend deploy выполняется через scripts в `server/`.

Инфраструктурное разделение deploy pipeline, CI/CD и GitHub Actions не входит в baseline и выполняется отдельным этапом после синхронизации GitHub с production.

## Production Baseline

Production baseline нужен, чтобы GitHub стал единственным Source of Truth проекта:

```text
Local HEAD = Production version = GitHub baseline branch
```

После baseline все дальнейшие архитектурные изменения, CI/CD, Role Engine, UserApp splitting и инфраструктурный рефакторинг должны выполняться уже относительно этого состояния.
