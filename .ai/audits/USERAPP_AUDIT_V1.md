# UserApp Architecture Audit V1

Дата: 2026-07-10.

Объект аудита: `src/UserApp.jsx`.

Тип аудита: инженерный архитектурный аудит без изменения кода.

## 1. Общий размер UserApp

### Метрики файла

- Количество строк: 3104.
- Количество непустых строк: 2875.
- Количество import declarations: 24.
- Количество lazy-loaded компонентов: 23.
- Количество `useState`: 65.
- Количество `useEffect`: 20.
- Количество `useMemo`: 12.
- Количество `useCallback`: 37.
- Количество прямых React Context usage: 0.
- Количество `createContext`: 0.
- Количество `useContext`: 0.
- Количество JSX Provider-вхождений: 9.
- Уникальные Provider-типы: 3.

### Provider-типы

- `ConfigProvider`.
- `AdaptivityProvider`.
- `LokiProvider`.

### Lazy-loaded компоненты

- `ProfilePanel`.
- `ScannerComponent`.
- `PartnerPage`.
- `Onboarding`.
- `NotificationsPage`.
- `EventsPage`.
- `LeaderboardPage`.
- `ActivityPage`.
- `OffersPage`.
- `TasksPage`.
- `ReferralPage`.
- `RewardsPage`.
- `MapPage`.
- `NearbyPage`.
- `PartnerCabinetPage`.
- `ExpertCabinetPage`.
- `ExpertsPage`.
- `ForPartnersPage`.
- `ReferencePage`.
- `LokiPage`.
- `NewsPage`.
- `PublicSubmitPage`.
- `ApgHealthPage`.

### Panel ids внутри UserApp

- `news`.
- `partner`.
- `loki`.
- `reference`.
- `profile`.
- `events`.
- `tasks`.
- `leaderboard`.
- `offers`.
- `activity`.
- `referral`.
- `partner-cabinet`.
- `expert-cabinet`.
- `rewards`.
- `experts`.
- `map`.
- `nearby`.
- `notifications`.
- `for-partners`.
- `health`.

## 2. Ответственность UserApp

UserApp является центральной runtime-оболочкой пользовательского приложения.

Подтверждённые обязанности:

- Инициализация пользовательского shell.
- Определение начального deep link.
- Выбор начальной панели.
- Управление `activePanel`.
- Управление стеком/направлением навигации.
- Управление свайп-навигацией между основными вкладками.
- Управление нижней навигацией.
- Рендер нижней навигации через `createPortal`.
- Подключение VKUI providers.
- Подключение `LokiProvider`.
- Подключение `LokiAssistant`.
- Формирование `lokiAppState`.
- Формирование `lokiAppActions`.
- Маршрутизация действий Локи в панели приложения.
- Авторизация через VK Bridge/Firebase anonymous/custom token flows.
- Восстановление пользователя из Firebase Auth.
- Связка Firebase uid с APG user id через `auth_map`.
- Загрузка публичных данных.
- Загрузка и хранение partners.
- Загрузка и хранение experts.
- Загрузка и хранение events.
- Загрузка и хранение news.
- Загрузка и хранение notifications.
- Загрузка и хранение reviews.
- Загрузка и хранение customTasks.
- Загрузка и хранение lokiKnowledge.
- Загрузка глобальной статистики `stats/global`.
- Загрузка пользовательского профиля и производных полей.
- Расчёт enriched partners.
- Управление избранным.
- Управление сохранёнными новостями.
- Управление read later news.
- Управление реакциями на новости.
- Управление подписками на новости.
- Управление регистрацией на события.
- Управление prize claim.
- Управление raffle enter.
- Управление claim задач.
- Управление QR-сканером.
- Подтверждение QR-скана через backend.
- Обработка публичных QR-ссылок партнёров и экспертов.
- Открытие карточки партнёра.
- Управление активным партнёром.
- Управление ownedPartner.
- Управление ownedExpert.
- Управление кабинетами партнёра и эксперта.
- Управление уведомлениями внутри приложения.
- Запрос web push permission.
- Синхронизация web push subscription.
- VK push permission flow.
- Управление notification preferences.
- Управление consent screen.
- Управление onboarding.
- Управление splash screen.
- Управление online/offline state.
- Управление pull-to-refresh.
- Управление toast-сообщениями.
- Управление key burst/counter pulse эффектами.
- Управление share flow через VK Bridge.
- Управление вступлением в VK group.
- Обработка logout.
- Обработка удаления профиля.
- Передача данных и handlers во все основные пользовательские экраны.
- Подключение scanner overlay.
- Подключение network error fallback.
- Подключение public submit route.
- Подключение health page для owner/admin сценариев.

## 3. Карта зависимостей

### Кто напрямую использует UserApp

Upstream dependency:

- `src/App.jsx` lazy-loads `UserApp` and renders it for user-facing routes.

Browser routes routed to UserApp:

- `/`.
- `/news`.
- `/news/:id`.
- `/events`.
- `/event/:id`.
- `/partner/:id`.
- `/expert/:id`.
- `/experts`.
- `/submit/:type/:token`.

### Компоненты, напрямую зависящие от состояния и callbacks UserApp

- `HomePanelV2`.
- `NewsPage`.
- `PartnerPage`.
- `LokiPage`.
- `ReferencePage`.
- `ProfilePanel`.
- `EventsPage`.
- `TasksPage`.
- `LeaderboardPage`.
- `OffersPage`.
- `ActivityPage`.
- `ReferralPage`.
- `PartnerCabinetPage`.
- `ExpertCabinetPage`.
- `RewardsPage`.
- `ExpertsPage`.
- `MapPage`.
- `NearbyPage`.
- `NotificationsPage`.
- `ForPartnersPage`.
- `ApgHealthPage`.
- `ScannerComponent`.
- `LokiAssistant` through `LokiProvider`.

### Сервисы и утилиты, которые использует UserApp

- `APP_URL`.
- `API_BASE_URL`.
- `WEB_PUSH_VAPID_PUBLIC_KEY`.
- `vkBridge`.
- `isVK`.
- `initErrorLogger`.
- `logError`.
- `setErrorLoggerUser`.
- `sendDiagReport`.
- `runServiceChecks`.
- `confirmQrScan`.
- `userAction`.
- Firebase `db`.
- Firebase `auth`.
- Firebase Auth helpers.
- Firestore client helpers.
- `showLokiMessage`.
- `LOKI_EVENTS`.
- `LOKI_APP_ACTIONS`.
- News helpers: `areNewsCommentsEnabled`, `getCanonicalNewsId`, `getNewsLegacyIds`.

### API calls from UserApp directly

Direct `fetch` endpoints observed in `src/UserApp.jsx`:

- `GET /api/vk-news?count=30`.
- `GET /api/public-data`.
- `POST /api/email-auth`.
- `GET /manifest.json`.

Static/version calls through imported helpers used by UserApp:

- `GET /version.json` through `userApi.js`.

### API calls through imported helper modules

Through `userAction` from `src/userApi.js`:

- `POST /api/user-actions`.

Through `confirmQrScan` from `src/rewardApi.js`:

- `POST /api/qr-token`.

### User action names triggered by UserApp

- `auth:linkUser`.
- `guest:session`.
- `profile:sync`.
- `profile:update`.
- `profile:acceptConsent`.
- `profile:delete`.
- `favorites:toggle`.
- `news:saved`.
- `news:readLater`.
- `news:reaction`.
- `news:subscriptions`.
- `publicQr:view`.
- `task:claim`.
- `prize:claim`.
- `raffle:enter`.
- `event:toggle`.

### Firestore collections read directly by UserApp

- `auth_map`.
- `partners`.
- `events`.
- `news`.
- `notifications`.
- `reviews`.
- `customTasks`.
- `experts`.
- `stats`.
- `lokiKnowledge`.
- `users`.
- `prizes`.

### Backend endpoints used by UserApp responsibility area

Directly or through imported helpers:

- `/api/public-data`.
- `/api/vk-news`.
- `/api/email-auth`.
- `/api/user-actions`.
- `/api/qr-token`.

### Global/browser state touched by UserApp

- `localStorage.apg_theme`.
- local cache timestamps and app-specific cached payloads.
- `window.location` and query/deep link parsing.
- `navigator.onLine`.
- `Notification.permission`.
- `navigator.serviceWorker`.
- `PushManager` subscription.
- `window.__swRegPromise`.
- VK Bridge global runtime state.
- Firebase Auth current user.
- Document body portal target through `createPortal`.

### Bottom Sheet and overlay links

Direct shared bottom sheet rendered by UserApp: none confirmed.

Indirect bottom sheet dependencies:

- `EventsPage` renders `EventDetailSheet` and receives event data/registration handler from UserApp.
- `NewsPage` renders article overlay via portal and receives news state/handlers from UserApp.
- `ScannerComponent` is controlled by UserApp through `isScannerOpen`.
- `LokiAssistant` is mounted by UserApp and can render `LokiExperience` portal through `LokiProvider`.

### Portal usage connected to UserApp

Direct portal in UserApp:

- Bottom navigation `tabBarEl` rendered with `createPortal(tabBarEl, document.body)`.

Imported/rendered children with portal behavior:

- `NewsPage` article reader.
- `EventDetailSheet` through `EventsPage`.
- `LokiExperience` through `LokiAssistant`.
- Profile/auth/share modals through child components.
- Partner/expert modals through child components.

## 4. Архитектурные риски

### Слишком большая ответственность

UserApp объединяет shell, auth, data loading, user state, navigation, QR, push, Loki, news state, event registration and child-screen orchestration.

Это подтверждается размером файла, количеством hooks and количеством downstream props/callbacks.

### Смешение слоёв

В одном файле присутствуют:

- browser routing interpretation;
- UI shell rendering;
- Firebase Auth orchestration;
- Firestore reads;
- backend API calls;
- business actions via `userAction`;
- PWA push flow;
- VK Bridge integration;
- Loki action routing;
- UI effects and animations.

### Сложность сопровождения

65 `useState`, 20 `useEffect`, 37 `useCallback` and 20 panel ids create a high coordination burden.

The file has multiple state families that can interact indirectly: auth state, loaded public data, selected partner/event/news targets, notifications, scanner, onboarding, consent, Loki and navigation.

### Повторяющиеся блоки

Repeated patterns are visible around:

- profile/user sync calls;
- `userAction` optimistic UI flows;
- navigation callbacks passed into child screens;
- route/deep-link target handling;
- notification/profile update calls;
- fallback branches for public submit/network/splash/consent/main shell.

### Потенциальные точки отказа

- Initial auth resolution.
- Public data bootstrap.
- Firestore direct reads.
- Backend `API_BASE_URL` availability.
- Service worker readiness for push subscription.
- `activePanel` consistency.
- `LokiProvider` placement and hook order.
- Portal stacking with tab bar, news article, event sheet and Loki.
- Deep link target resolution for old and new routes.
- User profile sync after email/Telegram/VK identity changes.

### Сложные цепочки зависимостей

Examples confirmed by code:

- Route `/news/:id` → `App` → `UserApp` deep link parsing → `pendingLokiNewsTarget` → `NewsPage` → `ArticleView` portal.
- Loki action `OPEN_EVENT` → `LokiProvider` action → `UserApp.lokiAppActions` → `pendingLokiEventTarget` → `EventsPage` → `EventDetailSheet`.
- Push enable → `ProfilePanel` callback → `UserApp.handleEnableNotifications` → browser permission/service worker → `userAction('profile:update')` → backend `/api/user-actions` → Firestore user profile.
- QR scan → `ScannerComponent` → `UserApp.handleConfirmScan` → `confirmQrScan` → `/api/qr-token` → user state and key burst UI.
- Event registration → `EventsPage` → `UserApp.handleEventRegister` → `userAction('event:toggle')` → user state and event registration state.

## 5. Потенциальные кандидаты на выделение

Это только список кандидатов, подтверждённых текущими обязанностями UserApp. Это не план рефакторинга.

- `AuthManager`: auth init, Firebase/VK/email completion, auth map linking, logout/delete profile.
- `DataBootstrapManager`: public data bootstrap, Firestore fallback reads, cache timestamp, network error state.
- `NavigationManager`: `activePanel`, deep links, panel history, back behavior, swipe tabs.
- `NotificationManager`: in-app notifications, web push subscription, VK push flow, notification preferences.
- `QrManager`: scanner state, public QR parsing, QR token confirmation, scan success/hints.
- `NewsManager`: saved news, read later, reactions, subscriptions, pending news deep link target.
- `EventManager`: registered event ids, event registration toggle, pending event deep link target.
- `PartnerManager`: favorites, active partner, partner opening, partner updates, visit/scanned state.
- `LokiManager`: `lokiAppState`, `lokiAppActions`, Loki provider inputs, Loki navigation targets.
- `RewardManager`: task claim, prize claim, raffle enter, key burst/counter pulse.
- `ConsentManager`: consent request, accept flow, notification prompt handoff.
- `LayoutManager`: VKUI providers, tab bar portal, splash/onboarding/network shell branches.

## 6. Общая оценка

### Читаемость: 4/10

UserApp is understandable in sections, but the file size, number of hooks and number of responsibilities make it hard to scan safely.

### Масштабируемость: 4/10

The central shell can still accept new panels, but each new feature increases coupling to shared state and callback wiring.

### Связанность: 3/10

UserApp is highly coupled to Firebase, backend endpoints, VK Bridge, PWA push, Loki, QR, news, events, partners, experts and almost every user-facing panel.

### Сложность: 8/10

The component coordinates many independent state machines: auth, data loading, navigation, push, scanner, consent, Loki, events and news.

### Риск изменений: 8/10

Changes in UserApp can affect multiple production-critical flows at once: login, routing, data loading, push, QR, bottom navigation and contextual overlays.

## 7. Итог аудита

UserApp is the central user runtime hub of APG.

It currently combines application shell, data bootstrap, auth, navigation, integrations, business actions and cross-screen orchestration.

The main architectural concern is not a single broken pattern, but accumulated responsibility density.

No code was changed as part of this audit.
