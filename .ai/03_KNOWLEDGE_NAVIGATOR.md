# Навигатор инженерной базы знаний АПГ

Этот документ отвечает только на один вопрос: что нужно прочитать перед выполнением конкретной задачи.

Он не описывает архитектуру и не заменяет профильные документы.

## Перед любой задачей

1. Прочитать `.ai/00_APG_MANIFEST.md`.
2. Прочитать `.ai/01_APG_OPERATING_SYSTEM.md`.
3. Прочитать `.ai/00_PROJECT_STATE.md`.
4. Прочитать `.ai/20_SYSTEM_PHILOSOPHY.md`.
5. Прочитать `.ai/18_ARCHITECTURE_MAP.md`.
6. Прочитать `.ai/19_DEPENDENCY_MAP.md`.
7. Только после этого перейти к конкретному разделу ниже.

## Авторизация

### Документы `.ai`

- `.ai/03_DATABASE.md`
- `.ai/04_API.md`
- `.ai/05_FRONTEND.md`
- `.ai/06_BACKEND.md`
- `.ai/08_TELEGRAM.md`
- `.ai/12_SECURITY.md`

### Исходные файлы

- `src/UserApp.jsx`
- `src/ProfilePanel.jsx`
- `src/EmailAuth.jsx`
- `src/firebase.js`
- `src/vk.js`
- `api/email-auth.js`
- `api/telegram-auth-start.js`
- `api/telegram-auth-check.js`
- `api/verify-telegram.js`
- `server/src/routes/email-auth.js`
- `server/src/routes/telegram-auth-start.js`
- `server/src/routes/telegram-auth-check.js`
- `server/src/routes/verify-telegram.js`

### Могут быть затронуты

- Firebase
- Backend
- Telegram
- VK
- Профиль
- Админка
- Безопасность

### Проверить перед commit

- Не сломан вход существующих пользователей.
- Не сломана привязка email и Telegram.
- Не изменены роли и права без backend-проверки.
- Старые `users` и `auth_map` данные имеют fallback.

## Новости

### Документы `.ai`

- `.ai/03_DATABASE.md`
- `.ai/04_API.md`
- `.ai/05_FRONTEND.md`
- `.ai/11_DESIGN_RULES.md`
- `.ai/19_DEPENDENCY_MAP.md`
- `.ai/20_SYSTEM_PHILOSOPHY.md`

### Исходные файлы

- `src/NewsPage.jsx`
- `src/newsUtils.js`
- `src/UserApp.jsx`
- `src/HomePanelV2.jsx`
- `src/LokiPage.jsx`
- `src/loki/LokiProvider.jsx`
- `api/news-comments.js`
- `api/news-engagement.js`
- `api/vk-news.js`
- `server/src/routes/news-comments.js`
- `server/src/routes/news-engagement.js`
- `server/src/routes/vk-news.js`

### Могут быть затронуты

- Локи
- Backend
- Firebase
- VK
- PWA
- UI
- Админка

### Проверить перед commit

- Открываются обычные и VK-новости.
- Комментарии и реакции не исчезли.
- Canonical и legacy id не конфликтуют.
- Кнопка Локи сохраняет контекст новости.
- Deep links `/news/:id` не сломаны.

## Центр событий

### Документы `.ai`

- `.ai/03_DATABASE.md`
- `.ai/04_API.md`
- `.ai/05_FRONTEND.md`
- `.ai/07_ADMIN_PANEL.md`
- `.ai/11_DESIGN_RULES.md`
- `.ai/18_ARCHITECTURE_MAP.md`
- `.ai/19_DEPENDENCY_MAP.md`

### Исходные файлы

- `src/EventsPage.jsx`
- `src/EventDetailSheet.jsx`
- `src/EventsCalendar.jsx`
- `src/UserApp.jsx`
- `src/AdminPanel.jsx`
- `src/PartnerCabinetPage.jsx`
- `src/ExpertCabinetPage.jsx`
- `api/user-actions.js`
- `api/admin-actions.js`
- `server/src/routes/user-actions.js`
- `server/src/routes/admin-actions.js`

### Могут быть затронуты

- Админка
- Партнёры
- Эксперты
- Профиль
- Push
- Firebase
- Backend
- PWA
- UI

### Проверить перед commit

- Старый раздел событий не изменён без явной задачи.
- `EventDetailSheet` открывается у пользователя и в админке.
- События без новых полей не падают.
- Регистрация и статусы не обходят backend.
- Deep links `/events` и `/event/:id` не сломаны.

## Партнёры

### Документы `.ai`

- `.ai/03_DATABASE.md`
- `.ai/04_API.md`
- `.ai/05_FRONTEND.md`
- `.ai/07_ADMIN_PANEL.md`
- `.ai/11_DESIGN_RULES.md`
- `.ai/12_SECURITY.md`

### Исходные файлы

- `src/PartnerPage.jsx`
- `src/PartnerCabinetPage.jsx`
- `src/PartnerQRSection.jsx`
- `src/OffersPage.jsx`
- `src/NearbyPage.jsx`
- `src/MapPage.jsx`
- `src/UserApp.jsx`
- `src/AdminPanel.jsx`
- `api/user-actions.js`
- `api/admin-actions.js`
- `api/upload-photo.js`
- `server/src/routes/user-actions.js`
- `server/src/routes/admin-actions.js`
- `server/src/routes/upload-photo.js`

### Могут быть затронуты

- QR
- Профиль
- Админка
- Firebase
- Backend
- VK
- Telegram
- UI

### Проверить перед commit

- Архивные партнёры не появляются в публичных списках.
- Кабинет партнёра открывается владельцам.
- QR и отзывы не сломаны.
- Deep link `/partner/:id` работает.
- Старые документы партнёров имеют fallback.

## Эксперты

### Документы `.ai`

- `.ai/03_DATABASE.md`
- `.ai/04_API.md`
- `.ai/05_FRONTEND.md`
- `.ai/07_ADMIN_PANEL.md`
- `.ai/11_DESIGN_RULES.md`
- `.ai/12_SECURITY.md`

### Исходные файлы

- `src/ExpertsPage.jsx`
- `src/ExpertCabinetPage.jsx`
- `src/UserApp.jsx`
- `src/AdminPanel.jsx`
- `api/user-actions.js`
- `api/admin-actions.js`
- `api/expert-rotation.js`
- `server/src/routes/user-actions.js`
- `server/src/routes/admin-actions.js`
- `server/src/routes/expert-rotation.js`

### Могут быть затронуты

- Профиль
- Админка
- Backend
- Firebase
- Telegram
- VK
- UI

### Проверить перед commit

- Архивные эксперты не появляются публично.
- Кабинет эксперта открывается владельцу.
- Отзывы и рейтинг не сломаны.
- Deep link `/expert/:id` работает.
- Старые документы экспертов имеют fallback.

## Профиль

### Документы `.ai`

- `.ai/03_DATABASE.md`
- `.ai/04_API.md`
- `.ai/05_FRONTEND.md`
- `.ai/08_TELEGRAM.md`
- `.ai/11_DESIGN_RULES.md`
- `.ai/12_SECURITY.md`

### Исходные файлы

- `src/ProfilePanel.jsx`
- `src/UserApp.jsx`
- `src/EmailAuth.jsx`
- `src/NotificationsPage.jsx`
- `src/ActivityPage.jsx`
- `src/ReferralPage.jsx`
- `api/email-auth.js`
- `api/user-actions.js`
- `server/src/routes/email-auth.js`
- `server/src/routes/user-actions.js`

### Могут быть затронуты

- Авторизация
- Push
- Telegram
- Партнёры
- Эксперты
- QR
- Firebase
- Backend

### Проверить перед commit

- Профиль открывается для VK, email и Telegram пользователей.
- Ключи, избранное и сохранённые новости не потеряны.
- Переходы в кабинеты работают.
- Email/Telegram linking не сломан.

## QR

### Документы `.ai`

- `.ai/03_DATABASE.md`
- `.ai/04_API.md`
- `.ai/05_FRONTEND.md`
- `.ai/09_BUSINESS_LOGIC.md`
- `.ai/12_SECURITY.md`

### Исходные файлы

- `src/Scanner.jsx`
- `src/PartnerQRSection.jsx`
- `src/UserApp.jsx`
- `src/PartnerPage.jsx`
- `api/qr-token.js`
- `api/user-actions.js`
- `server/src/routes/qr-token.js`
- `server/src/routes/user-actions.js`

### Могут быть затронуты

- Партнёры
- Профиль
- Firebase
- Backend
- Безопасность
- VK

### Проверить перед commit

- Сканирование не начисляет ключи повторно некорректно.
- QR партнёра не раскрывает лишние данные.
- История активности пользователя сохраняется.
- Старые QR-ссылки не сломаны.

## Локи

### Документы `.ai`

- `.ai/05_FRONTEND.md`
- `.ai/09_BUSINESS_LOGIC.md`
- `.ai/18_ARCHITECTURE_MAP.md`
- `.ai/19_DEPENDENCY_MAP.md`
- `.ai/20_SYSTEM_PHILOSOPHY.md`
- `.ai/21_LOKI_CORE.md`
- `.ai/22_APG_KNOWLEDGE.md`

### Исходные файлы

- `src/loki/LokiProvider.jsx`
- `src/loki/LokiAssistant.jsx`
- `src/loki/LokiExperience.jsx`
- `src/loki/core/LokiCore.js`
- `src/loki/lokiActionTypes.js`
- `src/LokiPage.jsx`
- `src/UserApp.jsx`
- `src/NewsPage.jsx`
- `api/user-actions.js`
- `api/loki-editor.js`
- `server/src/routes/user-actions.js`
- `server/src/routes/loki-editor.js`

### Могут быть затронуты

- Новости
- События
- Партнёры
- Эксперты
- Профиль
- Админка
- Firebase
- Backend
- UI

### Проверить перед commit

- `useLoki` вызывается только внутри `LokiProvider`.
- `appActions` не расходятся с `LOKI_APP_ACTIONS`.
- Контекст не теряется после закрытия Локи.
- Локи не перекрывает критические sheets неверным z-index.
- Память localStorage остаётся совместимой.

## Push

### Документы `.ai`

- `.ai/04_API.md`
- `.ai/05_FRONTEND.md`
- `.ai/06_BACKEND.md`
- `.ai/12_SECURITY.md`
- `.ai/13_DEPLOYMENT.md`
- `.ai/19_DEPENDENCY_MAP.md`

### Исходные файлы

- `public/sw.js`
- `src/UserApp.jsx`
- `src/ProfilePanel.jsx`
- `src/NotificationsPage.jsx`
- `src/constants.js`
- `api/send-push.js`
- `server/src/routes/send-push.js`

### Могут быть затронуты

- PWA
- Backend
- Firebase
- Админка
- Профиль
- Безопасность

### Проверить перед commit

- Service worker scope не изменён случайно.
- VAPID key не изменён без причины.
- Push permission flow не ломает профиль.
- Admin push идёт через backend permission checks.
- Notification click открывает правильный URL.

## Firebase

### Документы `.ai`

- `.ai/03_DATABASE.md`
- `.ai/04_API.md`
- `.ai/06_BACKEND.md`
- `.ai/12_SECURITY.md`
- `.ai/19_DEPENDENCY_MAP.md`

### Исходные файлы

- `src/firebase.js`
- `firestore.rules`
- `api/_firebase.js`
- `api/_admin-security.js`
- `server/src/lib/firebase.js`
- `src/UserApp.jsx`
- `src/AdminPanel.jsx`

### Могут быть затронуты

- Авторизация
- Backend
- Админка
- Новости
- События
- Партнёры
- Эксперты
- Push
- QR

### Проверить перед commit

- Firestore rules не изменены без явного запроса.
- Client reads и backend writes не конфликтуют.
- Старые документы сохраняют совместимость.
- Auth token доступен там, где требуется backend permission.

## Backend

### Документы `.ai`

- `.ai/04_API.md`
- `.ai/06_BACKEND.md`
- `.ai/12_SECURITY.md`
- `.ai/13_DEPLOYMENT.md`
- `.ai/19_DEPENDENCY_MAP.md`

### Исходные файлы

- `api/*.js`
- `server/src/routes/*.js`
- `server/src/lib/*.js`
- `src/constants.js`
- `src/userApi.js`
- `src/AdminPanel.jsx`
- `src/UserApp.jsx`

### Могут быть затронуты

- Firebase
- Админка
- Авторизация
- Новости
- События
- Партнёры
- Эксперты
- Push
- Telegram
- VK
- Безопасность

### Проверить перед commit

- Vercel `api/` и Fastify `server/src/routes/` не разошлись, если endpoint дублируется.
- Role/permission checks находятся на backend.
- `API_BASE_URL` не изменён случайно.
- Ошибки возвращаются в понятном формате для frontend.

## PWA

### Документы `.ai`

- `.ai/05_FRONTEND.md`
- `.ai/13_DEPLOYMENT.md`
- `.ai/18_ARCHITECTURE_MAP.md`
- `.ai/19_DEPENDENCY_MAP.md`

### Исходные файлы

- `public/manifest.json`
- `public/sw.js`
- `src/main.jsx`
- `src/App.jsx`
- `src/utils/shareLink.js`
- `vite.config.js`

### Могут быть затронуты

- Push
- App routing
- Universal links
- News
- Events
- Partners
- Experts
- Performance

### Проверить перед commit

- Path-based routes продолжают отдавать приложение.
- Service worker fallback не ломает `/index.html`.
- `version.json` не должен меняться без build/release задачи.
- Старые hash links обрабатываются.
- Safari/WebKit риски явно учтены.

## VK

### Документы `.ai`

- `.ai/05_FRONTEND.md`
- `.ai/08_TELEGRAM.md`
- `.ai/12_SECURITY.md`
- `.ai/19_DEPENDENCY_MAP.md`

### Исходные файлы

- `src/main.jsx`
- `src/vk.js`
- `src/UserApp.jsx`
- `src/ProfilePanel.jsx`
- `src/PartnerPage.jsx`
- `src/ExpertsPage.jsx`
- `src/ReferralPage.jsx`
- `api/vk-news.js`
- `server/src/routes/vk-news.js`

### Могут быть затронуты

- Авторизация
- Новости
- Профиль
- Партнёры
- Эксперты
- Push
- UI

### Проверить перед commit

- `VKWebAppInit` не сломан.
- VK user info fallback сохранён.
- VK share/copy/open app не ломают web/PWA.
- VK news import не конфликтует с обычными новостями.

## Telegram

### Документы `.ai`

- `.ai/04_API.md`
- `.ai/06_BACKEND.md`
- `.ai/08_TELEGRAM.md`
- `.ai/12_SECURITY.md`
- `.ai/19_DEPENDENCY_MAP.md`

### Исходные файлы

- `src/ProfilePanel.jsx`
- `src/assistant/AssistantMiniApp.jsx`
- `api/telegram-auth-start.js`
- `api/telegram-auth-check.js`
- `api/telegram-webhook.js`
- `api/verify-telegram.js`
- `server/src/routes/telegram-auth-start.js`
- `server/src/routes/telegram-auth-check.js`
- `server/src/routes/telegram-webhook.js`
- `server/src/routes/verify-telegram.js`

### Могут быть затронуты

- Авторизация
- Профиль
- Backend
- Firebase
- Безопасность

### Проверить перед commit

- Telegram auth start/check flow не разорван.
- Linking Telegram к email не создаёт дублей.
- `telegramAuthSessions` и `tgLinks` совместимы.
- Telegram Mini App не считается поддерживаемой платформой без отдельной задачи.

## Админка

### Документы `.ai`

- `.ai/03_DATABASE.md`
- `.ai/04_API.md`
- `.ai/06_BACKEND.md`
- `.ai/07_ADMIN_PANEL.md`
- `.ai/12_SECURITY.md`
- `.ai/18_ARCHITECTURE_MAP.md`
- `.ai/19_DEPENDENCY_MAP.md`

### Исходные файлы

- `src/AdminPanel.jsx`
- `src/EventDetailSheet.jsx`
- `api/admin-login.js`
- `api/admin-security.js`
- `api/admin-actions.js`
- `api/system-status.js`
- `api/send-push.js`
- `api/loki-editor.js`
- `server/src/routes/admin-login.js`
- `server/src/routes/admin-security.js`
- `server/src/routes/admin-actions.js`
- `server/src/routes/system-status.js`
- `server/src/routes/send-push.js`
- `server/src/routes/loki-editor.js`

### Могут быть затронуты

- Backend
- Firebase
- Новости
- Центр событий
- Партнёры
- Эксперты
- Push
- Локи
- Безопасность

### Проверить перед commit

- Admin auth и permissions не обходятся frontend-условиями.
- Админские изменения проходят через backend там, где требуется.
- Event center не ломает старый раздел событий.
- System status и audit logs сохраняют смысл.

## UI

### Документы `.ai`

- `.ai/05_FRONTEND.md`
- `.ai/10_CODING_RULES.md`
- `.ai/11_DESIGN_RULES.md`
- `.ai/20_SYSTEM_PHILOSOPHY.md`

### Исходные файлы

- `src/design.js`
- `src/components/Apg2ProfileGlass.jsx`
- `src/HomePanelV2.jsx`
- `src/UserApp.jsx`
- `src/NewsPage.jsx`
- `src/EventDetailSheet.jsx`
- `src/PartnerPage.jsx`
- `src/ExpertsPage.jsx`
- `src/ProfilePanel.jsx`
- `src/index.css`

### Могут быть затронуты

- Все пользовательские экраны
- Админка
- PWA
- VK
- Performance

### Проверить перед commit

- Не создан новый визуальный стиль без необходимости.
- Используются существующие APG V2 tokens/patterns.
- Мобильные ширины не получают горизонтальный scroll страницы.
- Portals, z-index и safe-area не конфликтуют.

## Производительность

### Документы `.ai`

- `.ai/05_FRONTEND.md`
- `.ai/13_DEPLOYMENT.md`
- `.ai/15_KNOWN_PROBLEMS.md`
- `.ai/18_ARCHITECTURE_MAP.md`
- `.ai/19_DEPENDENCY_MAP.md`

### Исходные файлы

- `src/App.jsx`
- `src/UserApp.jsx`
- `src/main.jsx`
- `vite.config.js`
- `public/sw.js`
- `src/networkDiagnostics.js`
- `src/NewsPage.jsx`
- `src/EventsPage.jsx`

### Могут быть затронуты

- PWA
- App routing
- Lazy chunks
- Firebase reads
- News
- Events
- Loki
- AdminPanel

### Проверить перед commit

- Lazy import boundaries не сломаны.
- Не добавлены тяжёлые зависимости без причины.
- Firestore reads не стали неконтролируемыми.
- Service worker не держит старый bundle.
- Большие списки имеют разумные limits/fallbacks.

## Безопасность

### Документы `.ai`

- `.ai/03_DATABASE.md`
- `.ai/04_API.md`
- `.ai/06_BACKEND.md`
- `.ai/12_SECURITY.md`
- `.ai/19_DEPENDENCY_MAP.md`
- `.ai/20_SYSTEM_PHILOSOPHY.md`

### Исходные файлы

- `firestore.rules`
- `api/_admin-security.js`
- `api/admin-security.js`
- `api/admin-actions.js`
- `api/user-actions.js`
- `api/send-push.js`
- `server/src/routes/admin-security.js`
- `server/src/routes/admin-actions.js`
- `server/src/routes/user-actions.js`
- `server/src/routes/send-push.js`
- `src/AdminPanel.jsx`
- `src/UserApp.jsx`

### Могут быть затронуты

- Backend
- Firebase
- Админка
- Авторизация
- Push
- Партнёры
- Эксперты
- Центр событий
- QR

### Проверить перед commit

- Firestore rules не изменены без явного запроса.
- Критические действия проверяются на backend.
- Роли не определяются только по frontend state.
- Секреты не попали в commit.
- Логи не раскрывают приватные данные.
