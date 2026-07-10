# Карта зависимостей АПГ

Файл фиксирует связи между крупными модулями проекта. Это не описание UI и не пересказ компонентов.

Основано на подтверждённых связях в коде на момент создания файла.

## App

- Кто использует: `src/main.jsx` рендерит `App` в React root.
- Что использует он: `BrowserRouter`, `Routes`, `Route`, `Navigate`, `Suspense`, `ErrorBoundary`, lazy imports `UserApp`, `AdminPanel`, `AssistantMiniApp`, `NetworkDiagnosticsPage`.
- Provider ему необходимы: собственных внешних providers не требует; сам создаёт routing boundary через `BrowserRouter`.
- API вызывает: `GET /version.json` через `checkForUpdate`.
- Firestore коллекции использует: напрямую не использует.
- Backend endpoint использует: не использует `API_BASE_URL`; только статический `/version.json`.
- Глобальные состояния изменяет: `localStorage.apg_build`, browser Cache Storage, `window.__APG_BOOT_OK`.
- Маршруты его открывают: все browser routes приложения проходят через `App`.
- BottomSheet связаны: напрямую нет.
- Portal используются: напрямую нет.
- Критические зависимости: React Router, lazy chunks, `version.json`, Cache Storage update flow.

## UserApp

- Кто использует: `App` на маршрутах `/`, `/news`, `/news/:id`, `/events`, `/event/:id`, `/partner/:id`, `/expert/:id`, `/experts`, `/submit/:type/:token`.
- Что использует он: VKUI `ConfigProvider`, `AdaptivityProvider`, `AppRoot`, `View`, `Panel`, lazy screens, Firebase client SDK, VK Bridge, `LokiProvider`, `LokiAssistant`, Interest Engine, `createPortal` для tab bar и overlay элементов.
- Provider ему необходимы: получает routing context от `BrowserRouter`; внутри создаёт VKUI providers и `LokiProvider`.
- API вызывает: `/api/public-data`, `/api/vk-news`, `/api/email-auth`, backend user actions through imported helpers, static `/manifest.json`.
- Firestore коллекции использует: `auth_map`, `partners`, `events`, `news`, `notifications`, `reviews`, `customTasks`, `experts`, `stats`, `lokiKnowledge`, `users`, `prizes`.
- Backend endpoint использует: `/api/public-data`, `/api/vk-news`, `/api/email-auth`; user-action calls идут через `userApi.js`.
- Глобальные состояния изменяет: `activePanel`, user/session state, favorites, registered events, notifications, `interestProfile`, PWA push subscription state, localStorage caches, `window.__swRegPromise` usage.
- Маршруты его открывают: `/`, `/news`, `/news/:id`, `/events`, `/event/:id`, `/partner/:id`, `/expert/:id`, `/experts`, `/submit/:type/:token`.
- BottomSheet связаны: открывает event detail indirectly через `EventsPage`; scanner and user overlays are connected inside shell.
- Portal используются: tab bar portal to `document.body`, key burst/offline overlays inside shell, downstream portals from child screens.
- Критические зависимости: Firebase availability, public data bootstrap, VK Bridge init, service worker readiness for push, `LokiProvider` context, panel navigation state.

## AdminPanel

- Кто использует: `App` на маршрутах `/admin` и `/admin-app`.
- Что использует он: Firebase client SDK for reads, backend admin endpoints, `EventDetailSheet`, VK Bridge health check, admin security/session state.
- Provider ему необходимы: routing context от `BrowserRouter`; собственный глобальный provider не требуется.
- API вызывает: `/api/admin-login`, `/api/admin-security`, `/api/admin-actions`, `/api/system-status`, `/api/news-comments`, `/api/send-push`, `/api/raffle-draw`, `/api/expert-rotation`, `/api/activity-index`, `/api/loki-editor`.
- Firestore коллекции использует: `partners`, `experts`, `events`, `news`, `notifications`, `prizes`, `customTasks`, `reviews`, `monthlyWinners`, `diagnostics`, `publicFormLinks`, `lokiKnowledge`, `lokiAnalytics`, `aiImportRequests` and admin metrics sources.
- Backend endpoint использует: admin/security/content/push/news comments/system endpoints listed above.
- Глобальные состояния изменяет: admin session, `activeTab`, expanded entity ids, selected event sheet state, local admin form state, notification push status through backend.
- Маршруты его открывают: `/admin`, `/admin-app`.
- BottomSheet связаны: `EventDetailSheet` for `events-center` with admin/owner actions.
- Portal используются: `EventDetailSheet` itself portals to `document.body`; other admin modals are inline fixed overlays.
- Критические зависимости: admin auth token, role permissions, backend admin endpoints, Firestore reads, `EventDetailSheet` stability.

## ProfilePanel

- Кто использует: `UserApp` panel `profile`.
- Что использует он: `vkBridge`, `openUrl`, Firebase auth helpers, `API_BASE_URL`, `createPortal` for email auth/share modal.
- Provider ему необходимы: VKUI providers from `UserApp`; no direct Loki provider requirement.
- API вызывает: `/api/email-auth`, `/api/telegram-auth-start`, `/api/telegram-auth-check`.
- Firestore коллекции использует: direct Firestore usage is not primary in the panel; profile data is passed from `UserApp`.
- Backend endpoint использует: email auth and Telegram auth endpoints.
- Глобальные состояния изменяет: user profile patch via callbacks, email auth state, Telegram linking state, notification enable flow via `onEnableNotifications`, navigation callbacks to cabinets and Loki.
- Маршруты его открывают: route `/` through `UserApp`, panel `profile`.
- BottomSheet связаны: none confirmed.
- Portal используются: email auth modal, share modal.
- Критические зависимости: `UserApp` user state, Firebase auth, email/Telegram auth backend, VK Bridge sharing/open app calls.

## News

- Кто использует: `UserApp` panel `news`, Home callbacks through `onOpenNewsItem`, Loki actions through `OPEN_NEWS` and `OPEN_NEWS_FEED`, direct routes `/news` and `/news/:id`.
- Что использует он: `NewsPage`, `newsUtils`, `RichText`, `VideoSection`, `GlassCard`, `GlassButton`, `useLoki`, `createPortal`, `API_BASE_URL`.
- Provider ему необходимы: `LokiProvider` is required for `ArticleView` because it calls `useLoki`; VKUI/root providers come from `UserApp`.
- API вызывает: `/api/news-engagement`, `/api/news-comments`.
- Firestore коллекции использует: `newsComments`, `news`, `newsCommentBlocks` through backend; client receives `news` from `UserApp`.
- Backend endpoint использует: `GET/POST /api/news-comments`, `POST /api/news-engagement`.
- Глобальные состояния изменяет: selected article state, local article scroll cache in localStorage, Loki `activeContext` through `openContextExperience`, user engagement counters through backend, Interest Profile signals through `UserApp` callbacks.
- Маршруты его открывают: `/news`, `/news/:id`, internal panel `news`, Loki `OPEN_NEWS`, home/news cards.
- BottomSheet связаны: none confirmed; article reader is a portal overlay, not a bottom sheet.
- Portal используются: selected `ArticleView` portal to `document.body`, lightbox/share related portals inside article flow.
- Критические зависимости: `LokiProvider`, canonical news ids, backend comments/engagement endpoints, `API_BASE_URL`, article portal z-index.

## Events

- Кто использует: `UserApp` panel `events`, Home callbacks, Loki actions `OPEN_EVENT` and `OPEN_EVENTS`, direct routes `/events` and `/event/:id`, `AdminPanel` event center.
- Что использует он: `EventsPage`, `EventDetailSheet`, `EventsCalendarView`, event normalization helpers, APG V2 glass components.
- Provider ему необходимы: VKUI/root providers from `UserApp`; no direct Loki provider requirement in `EventsPage`.
- API вызывает: user registration flows are delegated through callbacks from `UserApp`; admin moderation/patching is delegated through `AdminPanel` backend actions.
- Firestore коллекции использует: events data passed from `UserApp`; admin center reads/writes `events` through AdminPanel/backend; user actions endpoint touches `events` for registration/proposals.
- Backend endpoint использует: through callers, primarily `/api/user-actions` and `/api/admin-actions` for protected mutations.
- Глобальные состояния изменяет: selected event state, pending Loki event target via `UserApp`, admin selected event sheet state, registered event ids via user action callbacks, Interest Profile signals on event open/register.
- Маршруты его открывают: `/events`, `/event/:id`, internal panel `events`, Loki event actions.
- BottomSheet связаны: `EventDetailSheet` for user event card and admin event center.
- Portal используются: `EventDetailSheet` portals to `document.body`.
- Критические зависимости: event object backward compatibility, `EventDetailSheet`, deep link target resolution, registration callback safety, portal/z-index behavior.

## Partners

- Кто использует: `UserApp` panels `offers`, `partner`, `nearby`, `map`, `profile`; Loki `OPEN_PARTNER` and `OPEN_PARTNERS`; route `/partner/:id`; AdminPanel partners tab.
- Что использует он: `PartnerPage`, `PartnerCabinetPage`, `PartnerQRSection`, Partner AI helper inside cabinet, AI Profile Layer, partner cards in lists, VK Bridge, Firestore reviews subcollection, share helpers.
- Provider ему необходимы: VKUI/root providers from `UserApp`; no direct Loki provider requirement.
- API вызывает: user actions for favorites/reviews/scans through `UserApp` helpers; photo/upload/admin actions through admin/cabinet flows.
- Firestore коллекции использует: `partners` including embedded `aiProfile`, `partners/{id}/reviews`, `reviews`, `users`, `scans`, `partnerConnectionEvents`, `partnerInvites`, plus `events`, `news`, `notifications`, `aiDrafts`, `customTasks` for Partner AI moderation drafts depending on caller/backend flow.
- Backend endpoint использует: `/api/user-actions` including `partner:profileUpdate`, `event:propose`, `partner:aiDraft`; `/api/admin-actions` including `ai-profile:generate`; `/api/email-auth`, `/api/upload-photo`, `/api/public-submit` depending on partner flow.
- Глобальные состояния изменяет: `activePartner`, favorites, scanned partner ids, visit counts, owned partner/cabinet state, Interest Profile signals on partner open/favorite.
- Маршруты его открывают: `/partner/:id`, internal panel `partner`, offers/nearby/map/profile navigation, Loki partner actions.
- BottomSheet связаны: none confirmed as shared bottom sheet; partner page uses modal/portal overlays.
- Portal используются: partner share/toast portals and modal portals in `PartnerPage`.
- Критические зависимости: partner archive filtering, `openPartner` in `UserApp`, Firestore partner data shape, review subcollection reads, VK/openUrl external link behavior.

## Experts

- Кто использует: `UserApp` panel `experts`, profile expert cabinet entry, Loki `OPEN_EXPERTS`, route `/expert/:id` and `/experts`, AdminPanel experts tab.
- Что использует он: `ExpertsPage`, `ExpertCabinetPage`, AI Profile Layer, VK Bridge, Firestore expert reviews and rotation collections.
- Provider ему необходимы: VKUI/root providers from `UserApp`; no direct Loki provider requirement.
- API вызывает: user actions for reviews and expert-related mutations through backend helpers; admin actions through AdminPanel.
- Firestore коллекции использует: `experts` including embedded `aiProfile`, `expertReviews`, `expertRotation`, `users` through owner/cabinet flows.
- Backend endpoint использует: `/api/user-actions` including `expert:profileUpdate`, `/api/admin-actions` including `ai-profile:generate`, `/api/expert-rotation`, `/api/upload-photo` depending on flow.
- Глобальные состояния изменяет: selected/open expert target, owned expert/cabinet state, expert review/rating state, Interest Profile signals on expert open.
- Маршруты его открывают: `/experts`, `/expert/:id`, internal panel `experts`, profile cabinet actions, Loki experts action.
- BottomSheet связаны: none confirmed as shared bottom sheet.
- Portal используются: expert detail/contact/review portals in `ExpertsPage`.
- Критические зависимости: expert archive filtering, review collection consistency, `expertRotation`, route target resolution.

## Loki

- Кто использует: `UserApp` wraps user shell in `LokiProvider`; `LokiAssistant`, `LokiPage`, `NewsPage`, and profile/home callbacks use Loki entry points; `AdminPanel` manages Loki knowledge/editor separately.
- Что использует он: `LokiProvider`, `LokiAssistant`, `LokiExperience`, `LokiCore`, `ContextEngine`, `BrainLayer`, AI Profile Layer, scenario registry, Loki modules, `LOKI_APP_ACTIONS`, Interest Profile from Adaptive APG, app `appState`, app `appActions`, localStorage memory.
- Provider ему необходимы: `LokiProvider` is the required provider for `useLoki` consumers.
- API вызывает: `/api/user-actions` through `userAction('loki:analytics')`; AdminPanel calls `/api/loki-editor` for editorial/AI tooling.
- Firestore коллекции использует: `lokiKnowledge` from `UserApp`, `lokiAnalytics` through backend, `aiSources`, `aiDrafts`, `aiEditorRuns`, `aiEditorActivity`, `config/lokiEditor` through editor backend.
- Backend endpoint использует: `/api/user-actions`, `/api/loki-editor`.
- Глобальные состояния изменяет: Loki memory in localStorage, `activeContext`, `lastContext`, `experienceOpen`, assistant visibility, history, user memory, app navigation via `appActions`; Context Engine collects state and attaches partner/expert `aiProfile`; Brain Layer reads context and returns action plans but does not mutate React state directly.
- Маршруты его открывают: internal panel `loki`; floating assistant is mounted globally inside `UserApp`; contextual opening from news does not change route.
- BottomSheet связаны: none confirmed; `LokiExperience` is fullscreen portal overlay.
- Portal используются: `LokiAssistant` renders `LokiExperience` via `createPortal(..., document.body)`.
- Критические зависимости: `LokiProvider` placement, `ContextEngine` contract, `appActions` contract, Brain Layer scenario/action contract, localStorage memory schema, z-index/portal stacking above article and event overlays, `appState` freshness.

## Adaptive APG

- Кто использует: `UserApp`, `HomePanelV2`, `LokiRecommendationCenter`, `ContextEngine`.
- Что использует он: `src/interestEngine.js`, existing user profile state, existing public data arrays for partners, experts, events and news.
- Provider ему необходимы: отдельный provider не требуется; данные проходят через `UserApp` props and Loki `appState`.
- API вызывает: сохраняет `interestProfile` через existing `/api/user-actions` action `profile:update`.
- Firestore коллекции использует: `users` document field `interestProfile`; новых коллекций не создаёт.
- Backend endpoint использует: `/api/user-actions`.
- Глобальные состояния изменяет: `interestProfile` в `UserApp`, persisted `users/{userId}.interestProfile`.
- Маршруты его открывают: напрямую не открывается; действует внутри `/`, `/news`, `/events`, `/experts`, `/partner/:id`.
- BottomSheet связаны: влияет на ранжирование событий, которые открываются через `EventDetailSheet`, но не меняет sheet.
- Portal используются: напрямую нет.
- Критические зависимости: backward-compatible profile shape, safe category fallbacks, throttled persistence, no new source of truth outside user profile.

## APG Life Graph

- Кто использует: `ContextEngine`; future Loki/AI modules should use this instead of building separate relation logic.
- Что использует он: `src/lifeGraph.js`, existing appState arrays for news, events, partners, experts, custom tasks, rewards/prizes and promotions.
- Provider ему необходимы: отдельный provider не требуется.
- API вызывает: не вызывает API.
- Firestore коллекции использует: напрямую не читает Firestore; работает с уже загруженными данными из `news`, `events`, `partners`, `experts`, `customTasks`, `prizes`/`rewards`.
- Backend endpoint использует: не использует backend endpoints.
- Глобальные состояния изменяет: не изменяет состояние; сервис чистый и строит graph snapshot.
- Маршруты его открывают: напрямую не открывается.
- BottomSheet связаны: напрямую не связан; может давать future related recommendations для `EventDetailSheet` и article reader.
- Portal используются: нет.
- Критические зависимости: стабильный metadata contract, backward compatibility со старыми документами, отсутствие сайд-эффектов, не дублировать recommendation logic вне graph service.

## APG Automation Platform

- Кто использует: `AdminPanel` через вкладку «Автоматизация»; будущие AI/Loki modules могут читать рекомендации как источник действий.
- Что использует он: `api/admin-actions.js`, `server/src/routes/admin-actions.js`, существующие коллекции сущностей и admin audit.
- Provider ему необходимы: React provider не требуется; доступ идёт через существующую административную авторизацию.
- API вызывает: `/api/admin-actions` с действиями `automation:audit`, `automation:refresh`, `automation:confirm`, `automation:dismiss`.
- Firestore коллекции использует: читает `partners`, `experts`, `events`, `news`, `users`, `prizes`; пишет `automationRecommendations`; при подтверждении создаёт черновики в `news`, `notifications`, `customTasks`; пишет `adminActivity`.
- Backend endpoint использует: общий admin endpoint `/api/admin-actions`.
- Глобальные состояния изменяет: локальное состояние `automationAudit`, `automationLoading`, `automationFilter` в `AdminPanel`; persisted state рекомендаций и черновиков в Firestore.
- Маршруты его открывают: `/admin` и `/admin-app`, вкладка `automation`.
- BottomSheet связаны: напрямую нет.
- Portal используются: нет.
- Критические зависимости: parity между `api/` и `server/src/routes/`, admin permissions `ai:read`/`ai:update`, отсутствие автопубликации, идемпотентность recommendation id, совместимость со старыми документами.

## APG Economy

- Кто использует: `UserApp`, `RewardsPage`, `AdminPanel`, backend `user-actions`, `admin-actions`, `news-engagement`, `news-comments`, `reward-service`, `raffle-draw`.
- Что использует он: `server-shared/economy-engine.js` на backend и `src/economyEngine.js` на frontend.
- Provider ему необходимы: специальных React Provider нет; frontend получает балансы через состояние `UserApp`.
- API вызывает: frontend вызывает `/api/user-actions` для `economy:exchangeTickets`, `raffle:enter`, `task:claim`, отзывов и других защищённых действий; админка вызывает `/api/admin-actions` для `economy:analytics` и `economy:backfill`.
- Firestore коллекции использует: `users`, `users/{id}/activity`, `raffleEntries`, `prizeClaims`, `prizes`, `newsReadRewards`, `newsReadEvents`, `newsComments`, `scans`, `expertScans`, `customTasks`, `adminAuditLogs`.
- Backend endpoint использует: `/api/user-actions`, `/api/admin-actions`, `/api/news-engagement`, `/api/news-comments`, `/api/raffle-draw`.
- Глобальные состояния изменяет: `userKeys`, `userTickets`, `userReputation`, `reputationStatus`, optimistic state in `UserApp`.
- Маршруты его открывают: профиль/награды через пользовательскую навигацию, админская аналитика через `AdminPanel`.
- BottomSheet связаны: `RewardsPage` ticket exchange/raffle sheet.
- Portal используются: специальных portal для Economy Engine нет; UI наследует существующие overlay-механики `RewardsPage`.
- Критические зависимости: сохранность существующих `users.keys`, idempotent rewards, transaction safety for ticket exchange/raffles, parity between Vercel `api/` and Fastify/Yandex `server/src/routes/`.

## Firebase

- Кто использует: `UserApp`, `AdminPanel`, `NewsPage` auth token usage, `PartnerPage`, `ExpertsPage`, `ProfilePanel`, backend routes through Firebase Admin SDK.
- Что использует он: Firebase client SDK in `src/firebase.js`, Firebase Admin SDK in backend, Firestore, Auth, Messaging.
- Provider ему необходимы: no React provider confirmed; modules import configured Firebase instances.
- API вызывает: none; Firebase SDK performs network calls to Firebase services.
- Firestore коллекции использует: all application collections are reachable through Firebase; major collections include `users`, `partners`, `experts`, `events`, `news`, `notifications`, `reviews`, `newsComments`, `stats`, `auth_map`, `lokiKnowledge`.
- Backend endpoint использует: backend routes depend on Firebase Admin, not the reverse.
- Глобальные состояния изменяет: Auth current user, FCM/web push token state, Firestore persisted data.
- Маршруты его открывают: not route based.
- BottomSheet связаны: none.
- Portal используются: none.
- Критические зависимости: Firebase config, Firestore security/admin access split, Auth token availability, Admin SDK service account, collection schema compatibility.

## Backend

- Кто использует: `UserApp`, `AdminPanel`, `ProfilePanel`, `NewsPage`, `PublicSubmitPage`, `EmailAuth`, push/admin flows, network diagnostics.
- Что использует он: Fastify routes in `server/src/routes`, Vercel functions in `api`, Firebase Admin SDK, Yandex S3 upload flow, Telegram Bot API, Web Push/FCM.
- Provider ему необходимы: no React providers; requires runtime environment variables and service account credentials.
- API вызывает: external VK API for `/api/vk-news`, Telegram Bot API for Telegram auth/webhook, Yandex S3 for upload, Web Push endpoints for notifications.
- Firestore коллекции использует: `users`, `auth_map`, `partners`, `experts`, `events`, `news`, `notifications`, `newsComments`, `newsCommentBlocks`, `adminActivity`, `adminSecurityLog`, `adminCredentials`, `prizes`, `raffleEntries`, `prizeClaims`, `stats`, `config`, `telegramAuthSessions`, `tgLinks`, `emailIndex`, `emailAuthCodes`, `emailVerifyTokens`, `lokiAnalytics`, `aiSources`, `aiDrafts`, `aiEditorRuns`, `aiEditorActivity`, `publicFormLinks`, `aiImportRequests`, `monthlyWinners`, `scans`.
- Backend endpoint использует: exposes `/api/public-data`, `/api/vk-news`, `/api/news-comments`, `/api/news-engagement`, `/api/user-actions`, `/api/admin-actions`, `/api/admin-login`, `/api/admin-security`, `/api/system-status`, `/api/send-push`, `/api/email-auth`, `/api/telegram-auth-start`, `/api/telegram-auth-check`, `/api/telegram-webhook`, `/api/verify-telegram`, `/api/upload-photo`, `/api/raffle-draw`, `/api/expert-rotation`, `/api/activity-index`, `/api/loki-editor`, `/api/public-submit`, `/api/qr-token`.
- Глобальные состояния изменяет: Firestore persisted state, admin audit logs, push delivery state, news engagement counters, user activity logs.
- Маршруты его открывают: not browser-routed; reached via `API_BASE_URL`.
- BottomSheet связаны: supports event/admin/user mutations consumed by sheets but does not render sheets.
- Portal используются: none.
- Критические зависимости: parity between `api/` and `server/src/routes/`, Firebase Admin permissions, `API_BASE_URL`, environment secrets, idempotency and role checks.

## Push

- Кто использует: `UserApp` notification enable/sync flow, `ProfilePanel` notification button, `NotificationsPage`, `AdminPanel` push sending, `public/sw.js`.
- Что использует он: Browser Notification API, Service Worker, PushManager, `WEB_PUSH_VAPID_PUBLIC_KEY`, backend `/api/send-push`, Firestore user notification fields.
- Provider ему необходимы: no React provider; depends on browser APIs and service worker registration.
- API вызывает: `/api/send-push` from admin; browser push subscription is sent through user action flow.
- Firestore коллекции использует: `users`, `notifications`, `adminActivity` via backend.
- Backend endpoint использует: `/api/send-push`, `/api/user-actions` for subscription persistence.
- Глобальные состояния изменяет: Notification permission, service worker subscription, user notification preference fields, notification push status.
- Маршруты его открывают: notification click navigates/focuses app window to payload URL.
- BottomSheet связаны: none.
- Portal используются: none.
- Критические зависимости: service worker scope `/`, VAPID key, browser permission state, cache/update behavior, payload URLs.

## Telegram

- Кто использует: `ProfilePanel` auth/linking flow, backend Telegram routes, Telegram bot webhook, user auth restoration flows.
- Что использует он: `/api/telegram-auth-start`, `/api/telegram-auth-check`, `/api/telegram-webhook`, `/api/verify-telegram`, Firestore auth/session/link collections.
- Provider ему необходимы: no React provider.
- API вызывает: Telegram Bot API externally from backend; frontend polls project backend.
- Firestore коллекции использует: `telegramAuthSessions`, `tgLinks`, `users`, `stats`, `emailIndex` for linking flows.
- Backend endpoint использует: Telegram endpoints listed above plus `/api/email-auth` for linking Telegram to email account.
- Глобальные состояния изменяет: Telegram auth session status, linked Telegram fields on user, profile auth state.
- Маршруты его открывают: profile panel auth actions; `/telegram-helper` route opens `AssistantMiniApp`.
- BottomSheet связаны: none.
- Portal используются: profile auth modal via `ProfilePanel` portal.
- Критические зависимости: Telegram bot token/webhook, session polling state, Firebase custom token creation, account linking uniqueness.

## VK

- Кто использует: `main.jsx`, `UserApp`, `ProfilePanel`, `PartnerPage`, `ExpertsPage`, `ReferralPage`, `NearbyPage`, `AdminPanel` diagnostics.
- Что использует он: `vkBridge`, `isVK`, VK Mini App APIs, VK share/copy/open app/geodata methods.
- Provider ему необходимы: no React provider; VK environment supplies bridge capabilities.
- API вызывает: VK Bridge methods such as `VKWebAppInit`, `VKWebAppGetUserInfo`, `VKWebAppShare`, `VKWebAppCopyText`, `VKWebAppJoinGroup`, `VKWebAppGetGeodata`, `VKWebAppAllowNotifications`.
- Firestore коллекции использует: VK identity maps into `users` and `auth_map` through app/backend flows.
- Backend endpoint использует: `/api/vk-news` for VK news import/sync; auth/user bootstrap uses Firebase/backend flows.
- Глобальные состояния изменяет: VK initialization state, user identity bootstrap, sharing/copy/geodata permission flows.
- Маршруты его открывают: app is intended as VK Mini App primary platform; browser routes still handled by `App`.
- BottomSheet связаны: none.
- Portal используются: none directly.
- Критические зависимости: VK Bridge availability, user info retrieval, VK-specific video/social behavior, App ID consistency, non-haptic constraint.

## PWA

- Кто использует: installed web app users, `main.jsx`, `App`, `public/sw.js`, manifest consumers, push flow.
- Что использует он: `public/manifest.json`, `public/sw.js`, BrowserRouter path routes, service worker registration, Cache Storage.
- Provider ему необходимы: no React provider.
- API вызывает: navigation fallback fetches `/index.html`; `App` fetches `/version.json`.
- Firestore коллекции использует: none directly; PWA shell hosts modules that use Firestore.
- Backend endpoint использует: none directly; hosted app modules call backend through `API_BASE_URL`.
- Глобальные состояния изменяет: service worker registration, Cache Storage, `localStorage.apg_build`, standalone display behavior.
- Маршруты его открывают: all path-based routes under `/` scope.
- BottomSheet связаны: not directly; must preserve portal/fixed positioning for `EventDetailSheet`, `ArticleView`, `LokiExperience`.
- Portal используются: PWA shell must allow document-body portals from child modules.
- Критические зависимости: `scope: /`, navigation fallback, service worker cache clearing, path routing on S3, Safari/WebKit behavior.

## Самые критичные узлы

- `UserApp`: центральный runtime shell; от него зависят данные пользователя, panel navigation, public data loading, push, Loki app state/actions, most user screens.
- `Firebase`: общий источник Auth, Firestore data и Messaging; используется frontend and backend sides.
- `Backend API`: защищённые изменения, admin actions, comments, auth, push, upload, Telegram, VK sync and analytics depend on it.
- `APG Economy`: центральный слой ключей, билетов, репутации, розыгрышей и наград; ошибки здесь напрямую влияют на доверие пользователей.
- `LokiProvider`: required for contextual assistant and any `useLoki` consumer; also changes navigation through `appActions`.
- `App` routing layer: owns BrowserRouter, top-level routes, lazy chunk boundaries and update/version check.
- `EventDetailSheet`: shared by user events and admin events center; portal and data compatibility are critical.
- `NewsPage` article portal: connects news reader, comments, engagement and contextual Loki; z-index and provider placement matter.
- `public/sw.js`: critical for PWA navigation fallback, update behavior and push click handling.
- `AdminPanel`: high-impact operational node; writes or triggers changes across partners, experts, events, news, notifications, prizes and system tools.

## Документационные ограничения

- Карта не является proof of runtime correctness.
- Карта не заменяет QA for Safari/WebKit, VK Mini App, Telegram auth or PWA install behavior.
- Если код меняется, эту карту нужно обновлять вместе с архитектурной картой.
