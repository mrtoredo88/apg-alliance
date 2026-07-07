# APG Architecture

Актуальное состояние после V4.4.4: приложение сохраняет React/Vite frontend и Firebase как платформенные сервисы, но write-сценарии переведены в backend-first модель.

## Общая схема

- Frontend: React 18 + Vite, VK Mini App и PWA, inline styles, UI state в компонентах.
- Backend: два одинаковых слоя API: `api/*.js` для Vercel Functions и `server/src/routes/*.js` для Fastify/Yandex Container.
- Database: Firestore `project-apg-bbfc8`.
- Auth: Firebase Auth token на клиенте; backend проверяет token через Admin SDK.
- Storage: Yandex S3 через `/api/upload-photo`.
- Push: Firebase Cloud Messaging / VK notifications, отправка через backend.
- Admin: `AdminPanel.jsx` читает Firestore, но административные изменения идут через `/api/admin-actions`.
- User writes: пользовательские изменения идут через `/api/user-actions`.
- Loki: frontend personality/UX layer; V5 intelligence подключается только через backend APIs и редакционные сервисы.
- Loki Editor: `/api/loki-editor` собирает источники, готовит черновики и отдаёт их редактору без автопубликации.

## Потоки данных

### Пользователь

1. Frontend получает VK/email/Telegram пользователя.
2. Firebase Auth выдаёт anonymous/custom token session.
3. `/api/user-actions` action `auth:linkUser` связывает Firebase uid с APG userId в `auth_map`.
4. `profile:sync` создаёт или обновляет `users/{userId}`, daily bonus, `lastSeen`, initial consent/referral state.
5. Клиент читает профиль и публичные данные напрямую из Firestore.

### Новости

- VK News: `/api/vk-news` читает VK wall, нормализует посты и кэширует в `news`.
- Admin changes: `/api/admin-actions` actions `news:*`.
- User interactions: `/api/user-actions` для saved/read later/reactions/subscriptions, `/api/news-comments` для комментариев, `/api/news-engagement` для просмотров/дочитываний/share/feedback.

### Комментарии

- Пользователь отправляет комментарий в `/api/news-comments`.
- Backend валидирует автора, пишет `newsComments` и синхронизирует счётчики `news.comments` / `news.stats.comments`.
- Модерационные действия и административная загрузка комментариев требуют admin role и Firebase ID Token.

### Партнёры

- Публичный каталог читается клиентом из `partners`.
- Admin edits идут через `/api/admin-actions`.
- Кабинет партнёра пишет через `/api/user-actions` `partner:profileUpdate`; backend проверяет `ownerId`, `vkOwnerId` или `ownerEmail`.
- Отзывы идут через `review:partner`, backend пишет подколлекцию `partners/{id}/reviews`, глобальный `reviews` и пересчитывает рейтинг.

### Эксперты

- Каталог читается клиентом из `experts`.
- Admin edits идут через `/api/admin-actions`.
- Кабинет эксперта пишет через `expert:profileUpdate` с owner check.
- Отзывы идут через `review:expert`, backend пишет `expertReviews` и пересчитывает рейтинг.

### События

- Список читается клиентом из `events`.
- Admin edits идут через `/api/admin-actions`.
- Регистрация/отмена идут через `/api/user-actions` `event:toggle`, backend проверяет лимиты, приватность и ключи.

### Ключи, призы, QR

- Служебное QR-начисление уже выполняется через `/api/qr-token`.
- Задания: `task:claim` начисляет ключи и пишет activity.
- Призы: `prize:claim` списывает ключи, создаёт claim, обновляет stock.
- Розыгрыши: `raffle:enter` списывает ключи и увеличивает tickets.

### Локи

- UI/персонаж живёт на frontend.
- Настройки синхронизируются через `/api/user-actions` `loki:settings`.
- V5.0 редакционный интеллект живёт в `/api/loki-editor`: Source Manager, Parser, Duplicate Checker, Draft Generator, Queue Manager, Activity Logger.
- Локи не публикует новости сам. Он создаёт `aiDrafts`, объясняет важность и ждёт решения редактора.

## Backend API

- `/api/user-actions`: пользовательские изменения, owner checks, user audit.
- `/api/admin-actions`: административные изменения, role checks, admin audit.
- `/api/news-comments`: комментарии и модерация.
- `/api/news-engagement`: просмотры, дочитывания, share, feedback.
- `/api/qr-token`: QR issuance/scan logic.
- `/api/vk-news`: VK news sync/cache.
- `/api/upload-photo`: image upload to Yandex S3.
- `/api/email-auth`, `/api/telegram-*`: auth flows.
- `/api/send-push`: push notifications.
- `/api/system-status`: operational status for admin.
- `/api/loki-editor`: sources, scheduler run, duplicate checks, AI-assisted drafts, editor decisions.

## Роли

- Owner: полный доступ.
- Admin: управление контентом, пользователями, push, системой, audit.
- Editor: новости, события, контентные сущности без управления пользователями.
- Moderator: комментарии и ограниченная модерация контента.
- Partner: собственный кабинет партнёра через owner check.
- Expert: собственный кабинет эксперта через owner check.
- User: только свои профильные данные и пользовательские действия.

## Основные коллекции

- `users`
- `partners`
- `experts`
- `events`
- `news`
- `newsComments`
- `reviews`
- `expertReviews`
- `prizes`
- `raffleEntries`
- `prizeClaims`
- `notifications`
- `customTasks`
- `auth_map`
- `guestSessions`
- `errorLogs`
- `diagnostics`
- `adminActivity`
- `userActivityLog`
- `config`
- `stats`
- `aiSources`
- `aiDrafts`
- `aiEditorRuns`
- `aiEditorActivity`

## Firebase Usage Audit

- Firestore: нужен как primary database и realtime-independent read store. После V4.4.4 клиент использует Firestore для reads, backend для writes.
- Firebase Auth: нужен для Firebase ID Token и server-side verification.
- Firebase Messaging: нужен для Web Push.
- Firebase Storage: не используется как основной storage; фото идут в Yandex S3.
- Firestore Rules: следующий безопасный режим должен закрывать прямые writes в административные и пользовательские коллекции, оставляя read и минимальные legacy-операции только после production QA. Rules в этом этапе не применялись, чтобы не сломать production без отдельного утверждения.

## V5 Roadmap

- V5.0: Loki News Editor drafts: источники, dedupe, summary, confidence, editor approval.
- V5.1: подключение внешних моделей только к Draft Generator, без автопубликации.
- V5.2: умный daily digest и объяснение редакционных рекомендаций.
- V5.3: обучение на решениях редактора (`published/rejected/edited`) без автоматической публикации.
- V5.4: расширение Loki Editorial Workspace на партнёров, экспертов и события.

## Architecture Risks

- Клиент всё ещё читает Firestore напрямую: это сознательный компромисс скорости и стоимости. Публичные reads должны оставаться ограниченными rules.
- `/api/user-actions` широкий endpoint: удобно для миграции, но V5 может разнести его на `/api/user/profile`, `/api/user/prizes`, `/api/user/events` без изменения business logic.
- Firestore Rules нужно ужесточать отдельным релизным шагом после ручного QA всех migrated write-сценариев.
