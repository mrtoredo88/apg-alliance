# 17 CHANGELOG AI

Этот файл ведётся AI-агентами. При каждом изменении проекта добавляй запись.

## Формат записи

```
## [YYYY-MM-DD] Краткое описание
**Коммит:** `gitHash`
**Файлы:** список изменённых файлов
**Тип:** feat | fix | refactor | docs | chore
**Что изменено:** одна-три строки что именно сделано
**Почему:** краткая мотивация
```

---

## [2026-07-08] Исправление жестов и скролла в новостях
**Коммит:** `локально`
**Файлы:** `src/UserApp.jsx`, `src/NewsPage.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Глобальный pull-to-refresh теперь учитывает внутренние scroll-контейнеры и активируется только если жест начался в настоящем верхе scroll-зоны. Лента, статья и lightbox новостей помечены как самостоятельные gesture/scroll roots с `touchAction: pan-y` и `overscrollBehaviorY: contain`.
**Почему:** В разделе новостей `window.scrollY` оставался около нуля при прокрутке внутренней ленты, из-за чего глобальный pull-to-refresh ошибочно мешал обычному вертикальному скроллу вверх.

---

## [2026-07-08] Native Web Push для iPhone/Safari PWA
**Коммит:** `локально`
**Файлы:** `src/constants.js`, `src/UserApp.jsx`, `src/AdminPanel.jsx`, `api/send-push.js`, `server/src/routes/send-push.js`, `api/user-actions.js`, `server/src/routes/user-actions.js`, `server/deploy.sh`, `package.json`, `package-lock.json`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Клиентская регистрация push переведена с Firebase Messaging token на стандартный `PushManager.subscribe()` с VAPID public key. Backend теперь отправляет уведомления и на native Web Push subscriptions, и на legacy FCM tokens, сохраняет детальную статистику `native/fcm/errors` и показывает первый код ошибки в админке.
**Почему:** iPhone/Safari/PWA не получали тестовые push через FCM Web SDK; при этом Firebase Auth/Firestore должны остаться без изменений, а старая FCM-доставка не должна сломаться для уже зарегистрированных пользователей.

---

## [2026-07-08] Push notification center foundation
**Коммит:** `локально`
**Файлы:** `public/sw.js`, `src/main.jsx`, `src/UserApp.jsx`, `src/NotificationsPage.jsx`, `src/AdminPanel.jsx`, `api/send-push.js`, `server/src/routes/send-push.js`, `api/user-actions.js`, `server/src/routes/user-actions.js`, `.ai/04_API.md`, `.ai/07_ADMIN_PANEL.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:** Восстановлен push-capable service worker без app-shell кэша, расширен `/api/send-push` с категориями, аудиториями, приоритетами, deep link, диагностикой доставки и записью `pushStats` в уведомление. В админке вкладка «Рассылка» стала центром уведомлений с KPI, конструктором, предпросмотром и повторной отправкой; у пользователя появились настройки категорий уведомлений.
**Почему:** Публикация новости не приводила к доставке push, потому что цепочка Web Push была неполной: service worker отключался, отправка не хранила историю доставки и не учитывала согласия/категории пользователей.

---

## [2026-07-08] Loki city concierge foundation
**Коммит:** `локально`
**Файлы:** `src/loki/LokiRecommendationCenter.js`, `src/loki/core/modules/ConciergeEngine.js`, `src/loki/core/LokiCore.js`, `src/loki/LokiProvider.jsx`, `src/loki/core/lokiUserMemory.js`, `src/LokiPage.jsx`, `src/AdminPanel.jsx`, `.ai/07_ADMIN_PANEL.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:** Добавлен единый Recommendation Center: персональный профиль интересов, персональная лента «Локи рекомендует», сценарные подборки («вечер», «с детьми», «кофейни», «спорт», «авто», «предприниматели») и первые советы для партнёров/экспертов. Loki Core получил модуль City Concierge, а админская аналитика Локи показывает непонятые вопросы и действия после рекомендаций.
**Почему:** Локи должен развиваться из чат-помощника в городского консьержа, который помогает принимать решения и даёт единую основу рекомендаций для будущих разделов АПГ.

---

## [2026-07-08] Loki Action Router и админская база знаний
**Коммит:** `локально`
**Файлы:** `src/loki/core/LokiCore.js`, `src/loki/core/modules/ActionRouter.js`, `src/loki/core/lokiCoreUtils.js`, `src/loki/core/modules/KnowledgeExpert.js`, `src/loki/lokiActionTypes.js`, `src/loki/LokiProvider.jsx`, `src/LokiPage.jsx`, `src/UserApp.jsx`, `src/AdminPanel.jsx`, `api/admin-actions.js`, `api/user-actions.js`, `api/public-data.js`, `server/src/routes/admin-actions.js`, `server/src/routes/user-actions.js`, `server/src/routes/public-data.js`, `.ai/04_API.md`, `.ai/07_ADMIN_PANEL.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:** Локи получил отдельный Action Router для прямых команд навигации и единого поиска по партнёрам, экспертам, событиям, новостям и заданиям. Карточки ответов стали богаче: изображение, тип, мета-строки и быстрые действия; в админке добавлены вкладки «База знаний Локи» и «Аналитика Локи».
**Почему:** Локи должен постепенно становиться центральным интерфейсом АПГ: не только отвечать текстом, но и безопасно выполнять действия, помнить реальные запросы и позволять администратору расширять знания без релиза.

---

## [2026-07-08] News mini-CMS foundation
**Коммит:** `локально`
**Файлы:** `src/AdminPanel.jsx`, `src/NewsPage.jsx`, `src/newsUtils.js`, `src/utils/parseVideoUrl.js`, `api/admin-actions.js`, `server/src/routes/admin-actions.js`, `.ai/04_API.md`, `.ai/07_ADMIN_PANEL.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:** Форма новости расширена до первого слоя мини-CMS: подзаголовок, анонс, автор, источник, срок актуальности, теги, галерея с подписями/сортировкой, несколько видео, соцссылки, структурные блоки и выключатель комментариев. Страница новости показывает подзаголовок, отдельный блок соцссылок, content blocks и уважает `commentsEnabled=false`; реакции обновлены до набора `👍 ❤️ 🔥 👏 🎉 🤔`.
**Почему:** Новости АПГ должны стать универсальной контент-платформой без сторонних сервисов, при этом backend должен безопасно сохранять новые поля через существующий admin action слой.

---

## [2026-07-08] Локи semantic search и PDF-preview плакатов
**Коммит:** `локально`
**Файлы:** `src/loki/core/modules/PartnerExpert.js`, `src/loki/knowledge/categories/categories.json`, `src/UserApp.jsx`, `src/NewsPage.jsx`, `src/EventsPage.jsx`, `src/PartnerQRSection.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:** Локи получил более устойчивый семантический поиск по партнёрам: расширены категории, синонимы, fuzzy-сопоставление и контекст follow-up вопросов. Действия Локи теперь могут открывать конкретную новость или событие через существующий action-layer. Генератор QR/плакатов получил PDF-preview с выбором A4/A5, ориентации, полей и качества перед печатью/сохранением.
**Почему:** Пользователь должен задавать Локи естественные вопросы, а админка должна надёжно сохранять плакаты партнёров в PDF без неработающей кнопки и потери пропорций.

---

## [2026-07-08] P0 восстановление запуска PWA после production deploy
**Коммит:** `локально`
**Файлы:** `src/main.jsx`, `public/sw.js`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Версия service worker cache поднята до `apg-p0-restore-20260708`, чтобы установленная PWA принудительно сбросила старые runtime/static caches. Повторный `controllerchange` reload ограничен одним разом за сессию, чтобы обновление service worker не могло уйти в цикл перезагрузки.
**Почему:** Свежий production-браузер и persistent PWA-профиль не воспроизвели React runtime error, но после deploy белый экран у пользователя соответствует stale PWA/SW-cache сценарию. Hotfix восстанавливает загрузку без изменения бизнес-логики и UI.

---

## [2026-07-08] P0 аварийное отключение service worker
**Коммит:** `локально`
**Файлы:** `src/main.jsx`, `public/sw.js`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Регистрация service worker на старте отключена: приложение удаляет существующие SW-регистрации и очищает browser caches. `sw.js` превращён в emergency restore worker: очищает все кэши, unregister-ит себя и не перехватывает fetch-запросы.
**Почему:** После первого restore у пользователя всё ещё оставался белый экран, значит нужно полностью вывести PWA из-под старого service worker/cache-контроллера. Работоспособность приложения важнее offline/push-кэша в P0-инциденте.

---

## [2026-07-08] P0 устойчивый bootstrap главной
**Коммит:** `локально`
**Файлы:** `src/UserApp.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** `/api/public-data` получил AbortController timeout и сброс общего pending promise при ошибке, чтобы один зависший bootstrap-запрос не отравлял последующие загрузки. Убран общий `load_timeout`, который переводил всю главную в `networkError`; публичные блоки теперь завершаются через собственные `safeLoad` fallback. Owner auth session вынесена в короткий best-effort timeout, чтобы авторизационная синхронизация не блокировала Home.
**Почему:** Повторяющиеся симптомы “частичная главная”, отсутствие экспертов и ложное “нет соединения” были вызваны архитектурой загрузки: один зависший `/api/public-data`/auth promise мог блокировать весь старт приложения вместо деградации отдельного блока.

---

## [2026-07-07] P0 admin API: Firebase token вынесен из Authorization для Yandex
**Коммит:** `локально`
**Файлы:** `src/AdminPanel.jsx`, `src/userApi.js`, `src/ProfilePanel.jsx`, `src/NewsPage.jsx`, `api/_admin-security.js`, `server/src/lib/adminSecurity.js`, `api/admin-actions.js`, `api/user-actions.js`, `api/email-auth.js`, `api/news-comments.js`, `api/news-engagement.js`, `api/system-status.js`, `api/loki-editor.js`, `server/src/routes/user-actions.js`, `server/src/routes/email-auth.js`, `server/src/server.js`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Firebase ID Token теперь передаётся в `X-Firebase-Auth`, а backend поддерживает и новый заголовок, и старый `Authorization` для совместимости. CORS обновлён для `X-Firebase-Auth`; admin diagnostics теперь показывает endpoint/action/resource/status/body для failed admin actions и backend возвращает стабильные коды `AUTH_REQUIRED`, `FORBIDDEN_ROLE`, `UNKNOWN_ACTION`, `INVALID_PAYLOAD`, `SERVER_ERROR`. Админка принудительно обновляет ID token через `getIdToken(true)` / `getIdTokenResult(true)`, чтобы новые custom claims применялись сразу.
**Почему:** Yandex Serverless Container перехватывал внешний `Authorization: Bearer <Firebase ID Token>` и отвечал собственным `403 Forbidden: Not authorized` до Fastify. После исправления транспорта backend показал вторую причину: у текущего Firebase UID не было owner/admin claims, поэтому role guard возвращал `FORBIDDEN_ROLE`.

---

## [2026-07-07] P0 админка больше не зависает на Firebase Auth
**Коммит:** `локально`
**Файлы:** `src/AdminPanel.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Админка больше не создаёт anonymous Firebase-сессию как fallback для административного доступа. `waitForAdminAuth` ждёт первичный `onAuthStateChanged`, пишет таймлайн этапов (`firebase_initialized`, `onAuthStateChanged_fired`, `token_received`, `admin_loading_started`) в консоль и `localStorage.apg_admin_auth_trace`, а при отсутствии owner/admin Firebase-сессии показывает явный стоп-экран вместо пустого dashboard.
**Почему:** Экран “Firebase Auth ещё не подтверждён” означал, что админка не дождалась валидного Firebase ID Token; anonymous fallback приводил к backend 403/Firestore permission-denied и выглядел как массовая ошибка загрузки разделов.

---

## [2026-07-07] P0 закрытые чтения админки переведены на backend
**Коммит:** `локально`
**Файлы:** `api/admin-actions.js`, `server/src/routes/admin-actions.js`, `src/AdminPanel.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Добавлен `entity:list` в обе backend-ветки `/api/admin-actions` с role guard, limit/order config и безопасной сериализацией Firestore Timestamp. AdminPanel больше не читает напрямую закрытые коллекции `banners`, `errorLogs`, `adminActivity`, `users`, `prizeClaims`, `scans`, `expertScans`, `expertReviews`, `raffleEntries`, `guestSessions`; они загружаются через backend, а публичные каталоги остаются read-only Firestore.
**Почему:** Массовая ошибка админки была вызвана `permission-denied` от Firestore после ужесточения архитектуры: часть legacy-разделов всё ещё читала закрытые коллекции напрямую. Исправление закрывает первопричину без ослабления Firestore Rules.

---

## [2026-07-07] P0 исправление авторизации после смешивания профилей
**Коммит:** `локально`
**Файлы:** `src/UserApp.jsx`, `src/ProfilePanel.jsx`, `api/email-auth.js`, `server/src/routes/email-auth.js`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Strong identity аккаунты `email:*` и `tg_*` больше не проходят через опасное перепривязывание anonymous `auth_map`: после custom token сессии используются напрямую и только best-effort чинят `auth_map`. Logout очищает auth/local/session кэши пользователя. Привязка Telegram больше не перезаписывает основное имя, фамилию и аватар email-профиля; добавлен `FINISH LOGIN` dev-log для ошибок входа/согласий.
**Почему:** У пользователя после входа по email отображалось имя другого Telegram-профиля, а после согласий вход падал из-за mismatch между custom-token session и старым `auth_map`. Теперь профиль берётся только из текущего userId, а Telegram хранится как связанный метод входа, не как замена личности.

---

## [2026-07-07] P0 диагностика загрузки админки и stale Firestore emulator
**Коммит:** `локально`
**Файлы:** `src/firebase.js`, `src/AdminPanel.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Админские роуты больше не наследуют старый `localStorage.apg_demo_content=emulator`, который мог направлять Firestore-запросы в локальный эмулятор и валить все разделы одинаковой network/Firestore ошибкой. Загрузка админки получила расширенную диагностику: Firebase code/message, auth uid/email/claims role, project/env, online state и emulator state.
**Почему:** Перед production deploy админка показывала массовые ошибки “попыток: 3, временная ошибка сети/Firestore”; Admin SDK и Web SDK подтвердили, что коллекции и rules рабочие, а общий сбой соответствует клиентскому подключению к неверному Firestore endpoint/cache.

---

## [2026-07-07] P0 защита от смешивания Email и Telegram аккаунтов
**Коммит:** `локально`
**Файлы:** `api/email-auth.js`, `api/telegram-auth-check.js`, `api/telegram-webhook.js`, `api/user-actions.js`, `server/src/routes/email-auth.js`, `server/src/routes/telegram-auth-check.js`, `server/src/routes/telegram-webhook.js`, `server/src/routes/user-actions.js`, `src/ProfilePanel.jsx`, `src/UserApp.jsx`
**Тип:** fix
**Что изменено:** Привязка Telegram/email больше не доверяет `userId` из body: link endpoints требуют Firebase ID Token, сверяют владельца аккаунта, проверяют уникальность `tgLinks`/`emailIndex`, выполняют запись в transaction и пишут `accountLinkAudit`. Telegram `/start` без персонального `auth_state` больше не завершает чужую pending-сессию; email/Telegram auth-check возвращают Firebase custom token для точного APG userId.
**Почему:** Расследование P0 показало риск объединения данных разных людей через старые localStorage/auth_map и Telegram fallback «последняя pending-сессия». Теперь email/Telegram аккаунты требуют strong identity, а referral-flow не может менять владельца профиля.

---

## [2026-07-07] V5.0.2 Lint, QA & Production Gate
**Коммит:** `локально`
**Файлы:** `.eslintrc.cjs`, `api/admin-actions.js`, `api/news-engagement.js`, `api/user-actions.js`, `server/src/routes/admin-actions.js`, `server/src/routes/news-engagement.js`, `server/src/routes/user-actions.js`, `src/AdminPanel.jsx`, `src/HomePanelV2.jsx`, `src/UserApp.jsx`, `src/ProfilePanel.jsx`, `src/ExpertsPage.jsx`, `src/ExpertCabinetPage.jsx`, `src/PartnerCabinetPage.jsx`
**Тип:** fix
**Что изменено:** Настроен production-gate lint: исключены `dist/`, `build/`, `node_modules/`, `.release-backups/`, сгенерированные/служебные артефакты; backend/server-shared переведены в Node env. Отключены шумовые legacy-правила `react/prop-types`, `no-unused-vars`, `react-hooks/exhaustive-deps`, `react-refresh/only-export-components`, при этом `no-undef`, `no-empty` и синтаксические проверки остаются активными. Исправлены реальные gate-дефекты: undefined helper/props в админке и главной, mixed tabs, лишние regex escapes и redundant boolean casts.
**Почему:** V5.0.2 переводит `npm run lint` из шумного полного сканирования артефактов в рабочий production gate и закрывает ошибки, которые могли привести к runtime-сбоям перед deploy.

---

## [2026-07-07] News E2E audit: комментарии и счётчики
**Коммит:** `локально`
**Файлы:** `api/news-comments.js`, `server/src/routes/news-comments.js`, `src/AdminPanel.jsx`, `.ai/04_API.md`, `.ai/07_ADMIN_PANEL.md`, `.ai/ARCHITECTURE.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Админская загрузка комментариев переведена с прямого Firestore read на `GET /api/news-comments?admin=1` с проверкой `comments:*`, включая стартовый `fetchData()` админки. Создание, удаление и блокировка комментариев синхронизируют `news.comments` и `news.stats.comments` в обеих backend-реализациях; сбой вторичного счётчика логируется, но не ломает основной action.
**Почему:** Интеграционный аудит новостной цепочки показал риск пустой модерации при закрытых Firestore rules, пустых dashboard-метрик и расхождения счётчиков обсуждения после пользовательских действий.

---

## [2026-07-07] V5.0 Локи · ИИ-редактор новостей
**Коммит:** `локально`
**Файлы:** `api/loki-editor.js`, `server/src/routes/loki-editor.js`, `server/src/server.js`, `src/AdminPanel.jsx`, `.ai/04_API.md`, `.ai/07_ADMIN_PANEL.md`, `.ai/ARCHITECTURE.md`
**Тип:** feat
**Что изменено:** Добавлен backend `/api/loki-editor` для источников, проверки RSS/XML/JSON/manual материалов, duplicate check, генерации редакционных черновиков, confidence score, объяснения важности, журнала Локи и публикации только после ручного подтверждения редактора. Вкладка «Черновики ИИ» превращена в рабочий раздел «Локи · Редакция» с KPI, источниками, очередью черновиков, действиями и настройками.
**Почему:** V5.0 запускает интеллектуальную редакционную систему без автопубликации: Локи помогает редактору готовить новости, но не заменяет человека.

---

## [2026-07-07] V4.4.4 user backend migration и architecture audit
**Коммит:** `локально`
**Файлы:** `api/user-actions.js`, `server/src/routes/user-actions.js`, `server/src/server.js`, `src/userApi.js`, `src/UserApp.jsx`, `src/PartnerPage.jsx`, `src/ExpertsPage.jsx`, `src/PartnerCabinetPage.jsx`, `src/ExpertCabinetPage.jsx`, `src/loki/LokiProvider.jsx`, `src/errorLogger.js`, `src/diagnostics.js`, `.ai/04_API.md`, `.ai/ARCHITECTURE.md`
**Тип:** refactor
**Что изменено:** Добавлен единый `/api/user-actions` для пользовательских write-сценариев с Firebase ID Token, owner checks и журналом `userActivityLog`. Пользовательские записи профиля, согласий, избранного, новостей, событий, призов, розыгрышей, заданий, отзывов, кабинетов, Локи, ошибок и диагностики переведены с прямого Firestore SDK на backend API; Firestore на клиенте оставлен для read-only каталогов и экранов.
**Почему:** V4.4.4 завершает backend-first миграцию перед V5 и готовит архитектуру для Loki/AI-платформы без прямых клиентских записей в базу.

---

## [2026-07-07] V4.4.3 complete backend migration для админки
**Коммит:** `локально`
**Файлы:** `api/_admin-security.js`, `api/admin-actions.js`, `server/src/lib/adminSecurity.js`, `server/src/routes/admin-actions.js`, `src/AdminPanel.jsx`, `.ai/04_API.md`
**Тип:** refactor
**Что изменено:** `/api/admin-actions` расширен универсальными `entity:create/update/delete/set` для партнёров, экспертов, событий, баннеров, призов, уведомлений, заданий, пользователей, выдачи призов, ошибок, настроек и статистики. AdminPanel больше не выполняет прямые Firestore-записи для административных изменений; клиент читает коллекции напрямую, а все изменения идут через backend с Firebase ID Token, permission matrix, idempotency и audit log.
**Почему:** V4.4.3 закрывает смешанную архитектуру старой админки и готовит безопасный серверный слой для будущего V5 AI News Editor / Loki редакции.

---

## [2026-07-07] V4.4.2 production security & infrastructure
**Коммит:** `локально`
**Файлы:** `api/_firebase-admin.js`, `api/_admin-security.js`, `api/admin-actions.js`, `api/system-status.js`, `api/news-comments.js`, `api/send-push.js`, `server/src/lib/adminSecurity.js`, `server/src/routes/admin-actions.js`, `server/src/routes/system-status.js`, `server/src/routes/news-comments.js`, `server/src/routes/send-push.js`, `server/src/server.js`, `src/AdminPanel.jsx`, `src/NewsPage.jsx`, `.ai/04_API.md`, `.ai/12_SECURITY.md`
**Тип:** feat
**Что изменено:** Добавлен backend role guard по Firebase ID Token, permission matrix ролей, защищённый `/api/admin-actions` для news admin actions, idempotency-key защита, полноценный audit log `adminActivity`, системный endpoint `/api/system-status` и вкладка «Система» в админке. Модерация комментариев и push из админки больше не полагаются на подделываемую роль из body / hardcoded secret.
**Почему:** Перед V4.5 нужен серверный security boundary и инфраструктурная диагностика, чтобы админка была безопасной базой для будущего ИИ-редактора.

---

## [2026-07-07] V4.4.1 production-ready полировка редакционной админки
**Коммит:** `локально`
**Файлы:** `src/AdminPanel.jsx`
**Тип:** feat
**Что изменено:** Новостной board получил мобильные жесты, desktop context menu, выделение карточек, массовые действия, drag-and-drop приоритет, быстрый боковой редактор с автосохранением, undo после удаления, журнал `adminActivity` и историю `newsChangeHistory`. Dashboard дополнен live-виджетами, глобальный поиск ищет ошибки и AI-черновики, добавлены горячие клавиши `/`, `N`, `Ctrl/Cmd+S`, `Esc`.
**Почему:** V4.4.1 доводит существующий каркас админки до ежедневного редакционного инструмента без перехода к V4.5 и без добавления ИИ-логики.

---

## [2026-07-07] V4.4 каркас универсальной редакционной админки
**Коммит:** `e882b92e`
**Файлы:** `src/AdminPanel.jsx`, `src/App.jsx`, `src/ProfilePanel.jsx`, `.ai/07_ADMIN_PANEL.md`
**Тип:** feat
**Что изменено:** Добавлен отдельный роут `/#/admin-app`, вход из профиля для `admin/owner`, адаптивная оболочка админки с мобильным верхним островом и desktop sidebar. Dashboard получил KPI модерации, комментариев и ошибок; добавлены вкладки «Модерация», «Комментарии», «Пользователи», «Черновики ИИ», карточный редакционный board новостей и плавающие быстрые действия.
**Почему:** V4.4 начинает переход от монолитной старой админки к универсальному редакционному рабочему центру, пригодному для телефона, ноутбука и будущего ИИ-редактора V4.5.

---

## [2026-07-07] V4.3 комментарии, реакции и вовлечённость новостей
**Коммит:** `cd305fc8`
**Файлы:** `src/NewsPage.jsx`, `src/UserApp.jsx`, `api/news-comments.js`, `api/news-engagement.js`, `server/src/routes/news-comments.js`, `server/src/routes/news-engagement.js`, `server/src/server.js`, `.ai/04_API.md`
**Тип:** feat
**Что изменено:** Комментарии расширены до полноценного обсуждения с ответами, лайками, редактированием, удалением, бейджами ролей, закреплением, «Полезным ответом» и заготовкой блокировок для V4.4-админки. Реакции новости теперь работают как одна реакция на пользователя с корректной сменой, избранное/подписки синхронизируются через профиль, а просмотры, дочитывания, репосты и быстрый feedback пишутся через новый `/api/news-engagement`.
**Почему:** После полировки ленты и страницы новости разделу нужна живая вовлечённость пользователей, аналитика для редакции и структура данных, готовая к модерации и будущим сводкам Локи.

---

## [2026-07-07] V4.2 идеальная страница новости
**Коммит:** `664440bd`
**Файлы:** `src/NewsPage.jsx`
**Тип:** feat
**Что изменено:** Страница новости получила полноценный article-header с бейджами, источником, датой, временем, чтением, словами, просмотрами, реакциями и комментариями. Добавлены скрывающийся top-bar, кнопка «Наверх», блок действий, индикатор дочитывания, переходы «Предыдущая/Следующая», preload следующего изображения и закрытие fullscreen-галереи свайпом вниз.
**Почему:** V4.2 готовит страницу новости как эталонный экран чтения перед дальнейшими этапами комментариев, реакций и редакционной системы.

---

## [2026-07-07] V4.1 идеальная пользовательская лента новостей
**Коммит:** `23d66d53`
**Файлы:** `src/NewsPage.jsx`, `src/HomePanelV2.jsx`, `src/UserApp.jsx`, `.ai/05_FRONTEND.md`
**Тип:** feat
**Что изменено:** Лента новостей получила редакционные карточки с умными бейджами, источником, временем публикации, просмотрами, комментариями и реакциями; добавлены skeleton loader, плавающий поиск, кнопка «Наверх», мягкий индикатор новых материалов, улучшенное empty-state и шаринг с карточки. Превью новостей на главной обновлено до полноценного блока с бейджем новых материалов и корректным отображением VK-фото.
**Почему:** V4.1 фокусируется на пользовательской части новостей: лента должна быть быстрой, стабильной, адаптивной и выглядеть как современный мобильный раздел.

---

## [2026-07-07] Исправление изображений и комментариев новостей
**Коммит:** `локально`
**Файлы:** `src/NewsPage.jsx`, `api/news-comments.js`, `server/src/routes/news-comments.js`, `server/src/server.js`, `.ai/04_API.md`
**Тип:** fix
**Что изменено:** Из media-frame новостей убран неявный CSS scale/translate для фото, VK-изображения теперь показываются с сохранением пропорций через `object-fit: contain`. Комментарии перенесены с прямой клиентской записи в Firestore на backend `/api/news-comments`, добавлены ответы, редактирование, лайки, скрытие и понятное сообщение об ошибке с повторной загрузкой.
**Почему:** Последняя VK-новость визуально растягивалась/масштабировалась, а комментарии не размещались из-за отсутствия клиентского доступа к коллекции `newsComments` в Firestore rules.

---

## [2026-07-07] Premium News media polish
**Коммит:** `758702c7`
**Файлы:** `api/vk-news.js`, `server/src/routes/vk-news.js`, `src/newsUtils.js`, `src/NewsPage.jsx`, `src/UserApp.jsx`, `.ai/04_API.md`
**Тип:** feat
**Что изменено:** VK News pipeline теперь выбирает фото по максимальной площади и сохраняет размеры в `photoItems`. Раздел новостей получил адаптивный media-frame без кривого растягивания, fullscreen-галерею с zoom/swipe, share-панель, теги, блок «Локи рекомендует», уникальный view tracking и базовую систему комментариев с лайками/удалением.
**Почему:** Новости АПГ должны выглядеть как полноценный медиа-раздел, корректно показывать VK-фото разных пропорций и поддерживать основные сценарии чтения, обсуждения и шаринга.

---

## [2026-07-07] Диагностика VK News live/cache в production API
**Коммит:** `6ae1eb79`
**Файлы:** `api/vk-news.js`, `server/src/routes/vk-news.js`, `.ai/04_API.md`
**Тип:** fix
**Что изменено:** `/api/vk-news` теперь логирует безопасную диагностику: наличие токена, источник токена, live/cache режим, ошибки VK API и количество постов. Ошибки чтения/записи Firestore cache больше не скрываются молча.
**Почему:** Production возвращал пустой cached fallback из-за `VK_GROUP_TOKEN`, который не подходит для `wall.get`; нужны понятные логи для проверки `VK_SERVICE_TOKEN` / `VK_USER_TOKEN` после добавления в окружение.

---

## [2026-07-07] Yandex deploy env для VK News
**Коммит:** `e6fc020d`
**Файлы:** `server/deploy.sh`, `.ai/04_API.md`, `.ai/13_DEPLOYMENT.md`
**Тип:** fix
**Что изменено:** Deploy backend на Яндекс теперь передаёт `VK_SERVICE_TOKEN` и `VK_USER_TOKEN` вместе с fallback `VK_GROUP_TOKEN`; документация уточняет, что для `wall.get` предпочтителен сервисный или пользовательский токен.
**Почему:** Production API возвращал fallback `cached: true` с ошибкой VK `Group authorization failed`, потому что контейнер получал только group token.

---

## [2026-07-07] Полная синхронизация VK-публикаций в новости АПГ
**Коммит:** `737d2ddd`
**Файлы:** `api/vk-news.js`, `server/src/routes/vk-news.js`, `src/UserApp.jsx`, `src/newsUtils.js`, `src/NewsPage.jsx`, `src/HomePanelV2.jsx`, `.ai/04_API.md`
**Тип:** feat
**Что изменено:** `/api/vk-news` теперь нормализует VK-посты как полноценные новости АПГ с фото-каруселями, видео, ссылками, документами, хэштегами, метриками и признаком закрепления; успешная синхронизация мягко кэширует посты в Firestore. Экран новости показывает полный VK-контент внутри приложения, а оригинал ВКонтакте вынесен отдельной кнопкой внизу.
**Почему:** Публикации официального сообщества должны читаться внутри АПГ как часть категории «Новости АПГ», без перехода во встроенный браузер VK как основного сценария.

---

## [2026-07-07] Исправление React invariant #300 при запуске
**Коммит:** `локально`
**Файлы:** `src/UserApp.jsx`, `src/ErrorBoundary.jsx`
**Тип:** fix
**Что изменено:** `lokiAppState` и `lokiAppActions` перенесены выше всех условных `return` в `UserApp`, чтобы хуки `useMemo` всегда вызывались в одном порядке. Диагностика ErrorBoundary дополнена route и standalone/PWA mode.
**Почему:** При состояниях `networkError` или `loggedOut` компонент возвращал ранний экран до этих хуков, а при обычном запуске вызывал их позже. В Safari/PWA это проявлялось как minified React error #300.

---

## [2026-07-07] Исправление ошибки запуска Web App в Safari/PWA
**Коммит:** `локально`
**Файлы:** `src/UserApp.jsx`, `src/ErrorBoundary.jsx`
**Тип:** fix
**Что изменено:** Небезопасный `window.scrollTo({ behavior: 'instant' })` заменён на safe helper с `behavior: 'auto'` и fallback `scrollTo(0, 0)`. ErrorBoundary теперь сохраняет локальную диагностику запуска, показывает код/текст ошибки и даёт кнопку очистки service worker/cache с перезапуском.
**Почему:** В Safari/PWA недопустимое значение `instant` могло выбрасывать TypeError в effect и переводить приложение на экран «Что-то пошло не так».

---

## [2026-07-07] Восстановление открытия PWA после deploy
**Коммит:** `локально`
**Файлы:** `deploy-frontend.sh`
**Тип:** fix
**Что изменено:** Из deploy frontend удалён `--delete` для `dist/assets`, чтобы новые релизы не удаляли hashed chunks предыдущих сборок. Старые assets релиза `86dede42` вручную восстановлены в S3 для совместимости с PWA/WebView, где мог остаться старый `index.html`.
**Почему:** У пользователей со старым кэшем PWA или встроенного браузера старый shell мог ссылаться на уже удалённый JS-файл и открываться белым экраном.

---

## [2026-07-07] Исправление старта Telegram-авторизации
**Коммит:** `локально`
**Файлы:** `src/ProfilePanel.jsx`
**Тип:** fix
**Что изменено:** Все кнопки Telegram-входа и привязки переведены на единый `runTelegramAuth`, убраны двойные `onPointerUp/onClick` и случайная передача React-event вместо режима авторизации. Старт сессии получил таймаут, подробный auth trace и автоматическое открытие Telegram после успешного создания state.
**Почему:** В Telegram-flow кнопка могла выглядеть нерабочей или запускаться в неверном режиме после рефакторингов профиля; теперь клик стабильно отправляет запрос и показывает состояние ожидания.

---

## [2026-07-07] Loki UX 2.0 и семантическое понимание запросов
**Коммит:** `локально`
**Файлы:** `src/loki/lokiPosition.js`, `src/loki/core/modules/PartnerExpert.js`, `src/loki/knowledge/index.js`, `src/loki/knowledge/categories/categories.json`
**Тип:** feat
**Что изменено:** Позиционирование Локи переведено на единый safe-area Position Manager, который держит персонажа и облачко внутри видимой области на всех anchor. В Knowledge Base добавлены смысловые категории партнёров, а Partner Expert теперь понимает синонимы, разговорные формулировки, неоднозначные запросы и контекстные follow-up вопросы.
**Почему:** Локи не должен выходить за экран на внутренних страницах и должен понимать намерение пользователя, а не только точное совпадение слов.

---

## [2026-07-07] AAA-полировка цифрового персонажа Локи
**Коммит:** `локально`
**Файлы:** `src/loki/LokiAssistant.jsx`, `src/loki/LokiProvider.jsx`, `src/loki/LokiExperience.jsx`, `src/assistant/AssistantMiniApp.jsx`, `src/index.css`
**Тип:** feat
**Что изменено:** Локи теперь остаётся жить на главной странице после приветствия, мягко появляется/уходит без телепортации, получил более органичные keyframes с дыханием, инерцией, ambient glow и мимикой. Диалоговое окно стало плотнее и контрастнее, а голосовой режим использует более спокойные параметры TTS и лучший доступный русский голос браузера.
**Почему:** Локи должен восприниматься не как всплывающий виджет, а как живой премиальный цифровой персонаж внутри АПГ.

---

## [2026-07-07] Устойчивая загрузка данных админки
**Коммит:** `локально`
**Файлы:** `src/AdminPanel.jsx`
**Тип:** fix
**Что изменено:** Загрузка данных админки перенесена на момент входа после готовности Firebase Auth, коллекции читаются независимо с timeout/retry, ошибки больше не превращаются в тихие пустые массивы. Добавлен видимый статус загрузки с UID, списком проблемных коллекций и кнопкой повторной попытки; удалены debug `console.log`.
**Почему:** Админка выглядела пустой при скрытых Firestore/Auth ошибках. Теперь основные разделы продолжают работать, а проблемы прав/сети видны администратору.

---

## [2026-07-07] Proactive Intelligence Локи
**Коммит:** `e708eae9`
**Файлы:** `src/loki/LokiIntelligence.js`, `src/loki/LokiPlanner.js`, `src/loki/LokiLearning.js`, `src/loki/LokiObserver.js`, `src/loki/LokiProvider.jsx`, `src/loki/core/LokiCore.js`, `src/loki/lokiMemory.js`
**Тип:** feat
**Что изменено:** Добавлен отдельный proactive intelligence слой Локи: анализ ситуации, персональные рекомендации, обучение на принятых/проигнорированных советах, объяснение рекомендаций, маршрут на сегодня и режим «Удиви меня». Observer теперь использует новый движок с fallback на старые правила, а Loki Core отвечает на новые речевые сценарии через существующие безопасные Loki Actions.
**Почему:** Локи должен быть не только ответчиком, а деликатным городским спутником, который замечает полезные моменты и предлагает помощь без навязчивости.

---

## [2026-07-07] Premium Polish Локи и Bottom Island
**Коммит:** `локально`
**Файлы:** `src/loki/LokiAssistant.jsx`, `src/loki/lokiPosition.js`, `src/UserApp.jsx`
**Тип:** fix
**Что изменено:** Уплотнён glass-материал диалогов Локи, усилены blur/контраст/внутренний glow, улучшена типографика и переносы длинных сообщений. Bottom Island получил измеряемый по реальной кнопке активный индикатор, `box-sizing` и компенсацию border/padding; центрирование проверено в mobile preview до `delta: 0`.
**Почему:** Диалоги Локи должны читаться на любом фоне, а нижний остров должен выглядеть ровным и симметричным на мобильных экранах.

---

## [2026-07-07] Emotional Engine для Локи
**Коммит:** `2ba1ac00`
**Файлы:** `src/loki/LokiEmotionEngine.js`, `src/loki/LokiProvider.jsx`, `src/loki/lokiPhrases.js`, `src/loki/lokiMemory.js`
**Тип:** feat
**Что изменено:** Добавлен отдельный Emotional Engine без бизнес-логики: постоянное настроение, время суток, сезон, эмоциональная память, редкое молчание для низкоприоритетных подсказок, эмоциональные микродвижения и вариативность реплик. LokiProvider теперь сохраняет эмоциональное состояние в памяти и передаёт его в выбор фраз/жестов.
**Почему:** Локи должен ощущаться живым цифровым спутником, который меняет поведение постепенно и не реагирует одинаково на каждое действие.

---

## [2026-07-07] Полировка окна Локи
**Коммит:** `локально`
**Файлы:** `src/loki/LokiAssistant.jsx`, `src/loki/lokiPosition.js`
**Тип:** fix
**Что изменено:** Диалог, меню, ввод и история Локи получили более плотный premium-glass материал с усиленным blur и контрастом текста. Добавлена локальная фаза плавного исчезновения, а контекстные позиции Локи снижены ближе к нижней зоне, чтобы он не прыгал слишком резко вверх.
**Почему:** В текущем UI текст в окнах Локи плохо читался на сложных фонах, а автоскрытие персонажа воспринималось как резкое исчезновение.

---

## [2026-07-07] Backend API переведён на Yandex Serverless Container
**Коммит:** `100af015`
**Файлы:** `server/Dockerfile`, `server/deploy.sh`
**Тип:** fix
**Что изменено:** Dockerfile переведён на сборку из корня проекта, в образ добавлен `server-shared`, для общего модуля добавлен доступ к `/app/node_modules`. Backend-образ опубликован в Yandex Container Registry, ревизия `apg-api` обновлена, Telegram webhook переключён с Vercel на Yandex Container URL. Для production webhook включён `min-instances=1`, чтобы убрать cold start timeout.
**Почему:** Vercel Hobby не даёт задеплоить API из-за лимита 12 Serverless Functions; новый Telegram webhook должен работать через Yandex backend.

---

## [2026-07-07] VK Mini App получил Локи и справочник АПГ
**Коммит:** `11a1cb78`
**Файлы:** `src/UserApp.jsx`, `src/HomePanelV2.jsx`, `src/ProfilePanel.jsx`, `src/LokiPage.jsx`, `src/ReferencePage.jsx`, `src/vk.js`, `src/loki/lokiEvents.js`, `src/loki/lokiPhrases.js`, `src/loki/lokiActionTypes.js`, `src/EventsPage.jsx`, `src/ForPartnersPage.jsx`, `src/MapPage.jsx`
**Тип:** feat
**Что изменено:** В основное приложение добавлены панели «Локи» и «Справочник» на общей Loki/FAQ/Guides архитектуре, новые входы с главной и профиля, VK-специфичные реплики Локи, безопасное подтверждение внешних ссылок в VK Mini App.
**Почему:** VK Mini App должен ощущаться частью той же экосистемы АПГ, что Web App и Telegram Mini App, без урезанного интерфейса и опасных внешних переходов.

---

## [2026-07-07] Экосистема АПГ и карманный Локи в Telegram
**Коммит:** `517c69f2`
**Файлы:** `src/assistant/AssistantMiniApp.jsx`, `api/telegram-webhook.js`, `server/src/routes/telegram-webhook.js`, `src/loki/knowledge/updates/chronicles.json`
**Тип:** feat
**Что изменено:** Telegram Mini App перестроен из справочника в карманный вход к Локи: единый Loki Core, APG Knowledge Base, voice/text режим, быстрые команды, вкладки экосистемы, справочник, переходы в Web App. Telegram-бот получил тексты и кнопки «Локи АПГ» / «Быстрый вход в АПГ».
**Почему:** Пользователь должен ощущать Web App и Telegram Mini App как одну экосистему с единым Локи и продолжением одного сценария.

---

## [2026-07-07] Хроники АПГ и Voice Mode Локи
**Коммит:** `88b731f3`
**Файлы:** `src/loki/knowledge/*`, `src/loki/core/modules/KnowledgeExpert.js`, `src/loki/core/lokiUserMemory.js`, `src/loki/core/LokiCore.js`, `src/loki/LokiProvider.jsx`, `src/loki/LokiExperience.jsx`, `scripts/update-apg-chronicles.mjs`, `.ai/22_APG_KNOWLEDGE.md`
**Тип:** feat
**Что изменено:** Создана структурированная база знаний «Хроники АПГ», генератор хроник из AI changelog, Knowledge Expert для Loki Core, долгосрочная пользовательская память с очисткой и Voice Mode V1 через Web Speech API.
**Почему:** Локи должен использовать память мира АПГ, личную память пользователя и голосовой режим как фундамент будущих интеллектуальных возможностей.

---

## [2026-07-07] Модульная архитектура Loki Core
**Коммит:** `6ffb14d2`
**Файлы:** `src/loki/LokiBrain.js`, `src/loki/core/*`, `src/loki/LokiProvider.jsx`, `src/loki/LokiExperience.jsx`, `.ai/21_LOKI_CORE.md`
**Тип:** refactor
**Что изменено:** Loki Brain превращён в фасад над `LokiCore`; добавлены независимые модули Navigator, Partner Expert, Event Expert, Rewards Expert, News Expert, Profile Expert, Memory Engine, Recommendation Engine, Observer adapter и Personality Engine. Добавлен debug trace через `localStorage.apg_loki_debug`.
**Почему:** Локи должен развиваться как платформа интеллектуальных сервисов, где новые способности подключаются через Core без переписывания UI и существующих actions.

---

## [2026-07-07] Loki Experience
**Коммит:** `b21fad04`
**Файлы:** `src/loki/LokiExperience.jsx`, `src/loki/LokiProvider.jsx`, `src/loki/LokiAssistant.jsx`, `src/loki/LokiBrain.js`, `src/UserApp.jsx`
**Тип:** feat
**Что изменено:** Добавлен полноэкранный режим «Пространство Локи»: крупный персонаж, быстрые действия, поле запроса, голосовая заглушка, история текущего разговора и кликабельные карточки результатов. Loki Brain теперь возвращает набор карточек, а Experience выполняет действия только через Loki Actions.
**Почему:** Локи должен становиться вторым способом управления АПГ: пользователь формулирует намерение словами, а приложение показывает результаты и открывает нужные разделы без ручного поиска.

---

## [2026-07-07] Loki Brain V1
**Коммит:** `c3ac0937`
**Файлы:** `src/loki/LokiBrain.js`, `src/loki/LokiProvider.jsx`, `src/loki/LokiAssistant.jsx`, `src/loki/lokiEvents.js`, `src/UserApp.jsx`
**Тип:** feat
**Что изменено:** Добавлен первый Loki Brain: data-grounded обработка естественных запросов по данным АПГ, контекст пользователя/экрана/партнёров/событий/новостей, безопасные action-ответы и мини-ввод «Спросить Локи».
**Почему:** Локи должен становиться персональным городским помощником, который отвечает только на основе данных АПГ и готов к замене локального brain-провайдера на LLM через backend.

---

## [2026-07-07] Инициативное поведение Локи
**Коммит:** `22d924c2`
**Файлы:** `src/loki/LokiObserver.js`, `src/loki/lokiRecommendations.js`, `src/loki/lokiPriority.js`, `src/loki/lokiHistory.js`, `src/loki/LokiProvider.jsx`, `src/loki/LokiAssistant.jsx`, `src/loki/lokiEvents.js`, `src/loki/lokiBehavior.js`, `src/loki/lokiMemory.js`, `src/loki/lokiPhrases.js`, `src/UserApp.jsx`, `src/index.css`
**Тип:** feat
**Что изменено:** Добавлена система наблюдения за состоянием приложения, инициативные рекомендации с режимом тишины, история советов Локи, антиспам-приоритеты и центр сообщений внутри меню персонажа.
**Почему:** Локи должен становиться внимательным спутником пользователя и появляться редко, но в полезный момент.

---

## [2026-07-07] Loki Actions как агентный слой приложения
**Коммит:** `b0ccf92f`
**Файлы:** `src/loki/lokiActionTypes.js`, `src/loki/lokiSuggestions.js`, `src/loki/lokiMemory.js`, `src/loki/LokiProvider.jsx`, `src/loki/LokiAssistant.jsx`, `src/UserApp.jsx`
**Тип:** feat
**Что изменено:** Добавлен единый слой действий Локи, очередь сообщений с приоритетами, интерактивные карточки с CTA, локальная память последнего сообщения/действия/экрана и JSON-интерфейс для будущего AI.
**Почему:** Локи должен стать центральным помощником АПГ, который управляет приложением через безопасные actions, не зная роутинг и компоненты.

---

## [2026-07-07] Локи как живой персонаж приложения
**Коммит:** `02e10828`
**Файлы:** `src/loki/LokiAssistant.jsx`, `src/loki/LokiProvider.jsx`, `src/loki/lokiBehavior.js`, `src/loki/lokiPosition.js`, `src/loki/lokiEvents.js`, `src/loki/lokiPhrases.js`, `src/UserApp.jsx`, `src/index.css`
**Тип:** feat
**Что изменено:** Локи получил сценическое поведение: появляется только на смысловые события, перемещается к контекстным зонам, реагирует на касание, выполняет редкие микродействия, плавно завершает сцену и исчезает.
**Почему:** Персонаж должен ощущаться жителем АПГ, а не статичным виджетом поверх интерфейса.

---

## [2026-07-07] V1 персонажа Локи в приложении
**Коммит:** `f2dd95e5`
**Файлы:** `public/loki.png`, `src/loki/LokiAssistant.jsx`, `src/loki/LokiProvider.jsx`, `src/loki/lokiBus.js`, `src/loki/lokiEvents.js`, `src/loki/lokiPhrases.js`, `src/loki/lokiState.js`, `src/UserApp.jsx`, `src/ErrorBoundary.jsx`, `src/index.css`
**Тип:** feat
**Что изменено:** Добавлен плавающий талисман Локи с состояниями, репликами, event bus, локальными настройками, синхронизацией пользовательских настроек и интеграцией в ключевые события приложения.
**Почему:** АПГ нужен живой персонаж-помощник без сложного AI на первом этапе, с архитектурой для будущего AI-помощника.

---

## [2026-07-07] V5.4 интеграция Помощника АПГ в Telegram-бота
**Коммит:** N/A
**Файлы:** `index.html`, `src/App.jsx`, `src/assistant/AssistantMiniApp.jsx`, `src/assistant/categories.json`, `src/assistant/guides.json`, `src/assistant/faq.json`, `api/telegram-webhook.js`, `server/src/routes/telegram-webhook.js`
**Тип:** feat
**Что изменено:** Помощник получил маршруты `/#/telegram-helper` и `/#/miniapp/help`, главное меню теперь строится из `categories.json`, подключён официальный Telegram WebApp API, а существующий Telegram-бот получил WebApp-кнопки «Помощник АПГ» и «Как пользоваться АПГ».
**Почему:** Telegram Mini App должен быть частью текущего бота АПГ и использовать одну базу знаний с будущей встроенной помощью в приложении.

---

## [2026-07-07] V5.3 Telegram Mini App «Помощник АПГ»
**Коммит:** N/A
**Файлы:** `src/App.jsx`, `src/assistant/AssistantMiniApp.jsx`, `src/assistant/guides.json`, `src/assistant/faq.json`
**Тип:** feat
**Что изменено:** Добавлен отдельный маршрут `/#/assistant` для Telegram Mini App: главный экран помощника, guided-инструкции по карточкам, локальная JSON-база знаний, поиск по ключевым словам и режим «Задать вопрос».
**Почему:** АПГ нужен не обычный чат-бот, а управляемый интерактивный помощник, который можно позже подключить к AI без переписывания интерфейса.

---

## [2026-07-07] V5.2 Motion Design System
**Коммит:** N/A
**Файлы:** `src/motion.js`, `src/index.css`, `src/UserApp.jsx`, `src/HomePanelV2.jsx`, `src/Scanner.jsx`, `src/SplashScreen.jsx`, `src/ExpertsPage.jsx`, `src/components/Apg2ProfileGlass.jsx`
**Тип:** feat
**Что изменено:** Добавлена единая motion-система с токенами длительности/easing, унифицированы page transitions, press-scale, modal/sheet drag reset, Floating Island, Scanner, success-анимация QR и Splash reveal.
**Почему:** АПГ должен ощущаться как цельное нативное приложение, где анимации не случайные, а собраны в один спокойный премиальный motion-язык.

---

## [2026-07-07] Web/PWA haptic fallback
**Коммит:** N/A
**Файлы:** `src/UserApp.jsx`, `src/vk.js`
**Тип:** feat
**Что изменено:** Для web/PWA добавлен прямой fallback через `navigator.vibrate` с паттернами `light`, `medium`, `heavy`, `success` и защитой от слишком частых срабатываний.
**Почему:** В web app версии важные действия должны ощущаться нативнее там, где браузер поддерживает Vibration API.

---

## [2026-07-07] V5.1 Native UX gestures
**Коммит:** N/A
**Файлы:** `src/UserApp.jsx`, `src/Scanner.jsx`, `src/ExpertsPage.jsx`, `src/components/Apg2ProfileGlass.jsx`, `src/index.css`
**Тип:** feat
**Что изменено:** Добавлена единая история экранов и edge swipe back, pull-to-refresh для главных разделов, press-scale для glass-карточек и кнопок, drag-to-dismiss для модалок/сканера/success-modal, плавные slide-переходы и движущийся индикатор Floating Island.
**Почему:** Пользовательское приложение должно ощущаться ближе к нативному iOS-приложению за счёт привычных жестов и единого motion-поведения.

---

## [2026-07-06] Production deploy version.json без долгого кэша
**Коммит:** `6bc380d4`
**Файлы:** `deploy-frontend.sh`
**Тип:** fix
**Что изменено:** `version.json` теперь загружается отдельным no-cache объектом и исключается из общего static sync с `max-age=86400`.
**Почему:** PWA и CDN могли видеть старый `version.json`, из-за чего проверка актуальности сборки показывала устаревший hash после production deploy.

---

## [2026-07-06] V5.0 Admin Pro dashboard
**Коммит:** N/A
**Файлы:** `src/AdminPanel.jsx`
**Тип:** feat
**Что изменено:** Админка теперь открывается с Dashboard: KPI проекта, рост пользователей, QR/ключи, воронка роста, источники пользователей, вклад партнёров/экспертов и Activity Log. Глобальный поиск расширен пользователями, призами и акциями партнёров. В форме новостей удалено ручное поле URL картинки: используется единый `PhotoUpload`, сохраняющий `coverPhoto` и `imageUrl`.
**Почему:** Админка должна стать рабочим центром управления АПГ и отвечать на вопрос “что сейчас происходит в проекте”.

---

## [2026-07-06] V4.8 новая механика ключей через QR партнёра
**Коммит:** N/A
**Файлы:** `src/PartnerPage.jsx`, `src/ExpertsPage.jsx`, `src/UserApp.jsx`, `src/rewardApi.js`
**Тип:** feat
**Что изменено:** Из карточек партнёра и эксперта удалена генерация пользовательского одноразового QR. Добавлен новый блок “Получите ключ за посещение/консультацию” с кнопкой открытия общего сканера; успешное начисление показывает отдельный экран благодарности с `+N ключ` и CTA “Оставить отзыв” для партнёров.
**Почему:** Новая механика должна быть проще: пользователь сканирует QR партнёра/эксперта, а начисление и защита от дублей выполняются backend-логикой.

---

## [2026-07-06] V4.7 обязательное подтверждение документов
**Коммит:** N/A
**Файлы:** `src/ConsentScreen.jsx`, `src/UserApp.jsx`, `public/user-agreement.html`, `public/privacy-policy.html`
**Тип:** feat
**Что изменено:** Добавлен `LEGAL_VERSION = 1` и обязательный legal gate для всех пользователей с аккаунтом, у которых нет актуальных согласий текущей версии. Экран блокирует доступ к приложению до подтверждения документов и повторно появится при увеличении версии.
**Почему:** Существующие пользователи после обновления должны один раз подтвердить актуальные документы и выбрать настройку уведомлений.

---

## [2026-07-06] V4.6 экран согласий при email-регистрации
**Коммит:** N/A
**Файлы:** `src/ConsentScreen.jsx`, `src/EmailAuth.jsx`, `src/ProfilePanel.jsx`, `src/UserApp.jsx`, `public/user-agreement.html`, `public/privacy-policy.html`
**Тип:** feat
**Что изменено:** Перед завершением email-входа добавлен экран согласий с двумя обязательными чекбоксами и необязательным согласием на уведомления. Согласия сохраняются в `users/{id}.consents` с версией документов; новые пользователи получают согласия вместе с первым созданием профиля.
**Почему:** Пользователь должен явно принять пользовательское соглашение и согласие на обработку персональных данных перед началом использования приложения.

---

## [2026-07-06] Исправлен выбор изображений новостей и мероприятий
**Коммит:** N/A
**Файлы:** `src/HomePanelV2.jsx`, `src/EventsPage.jsx`, `src/AdminPanel.jsx`
**Тип:** fix
**Что изменено:** Для новостей и мероприятий добавлен отдельный выбор собственных изображений (`coverPhoto` → `imageUrl` → служебные поля) без fallback на `logoUrl/photo` партнёров или экспертов. Админские списки показывают ту же обложку, которая используется в пользовательском приложении.
**Почему:** Новость могла показывать чужое изображение партнёра из-за общего fallback-helper и приоритета `imageUrl` над загруженной через PhotoUpload `coverPhoto`.

---

## [2026-07-06] Production QR fallback before backend deploy
**Коммит:** N/A
**Файлы:** `src/rewardApi.js`, `src/UserApp.jsx`
**Тип:** fix
**Что изменено:** Добавлен fallback на legacy QR (`partnerId` / `expert_<id>`) при недоступном `/api/qr-token`; сканер снова умеет начислять ключи по legacy QR без нового backend endpoint.
**Почему:** Production API в Yandex Container ещё не содержит `/api/qr-token`, поэтому frontend не должен зависеть от отсутствующего endpoint во время публичного выката.

---

## [2026-07-06] V4.3 urgent startup fallback and Splash
**Коммит:** N/A
**Файлы:** `src/UserApp.jsx`, `src/SplashScreen.jsx`, `public/splash-v43.png`
**Тип:** fix
**Что изменено:** Добавлены таймауты и fallback для auth/data initialization, каждый источник данных главной теперь грузится независимо через `safeLoad`; Splash Screen получил max-timeout и пересобран вокруг единого арта `splash-v43.png` без старого логотипа/дублирующих надписей поверх.
**Почему:** Убрать зависание приложения на логотипе и не позволять ошибкам Firestore/VK News/experts блокировать открытие главной.

---

## [2026-07-06] V4.1 release checks polish
**Коммит:** N/A
**Файлы:** `src/SplashScreen.jsx`, `src/index.css`, `src/UserApp.jsx`, `src/AdminPanel.jsx`, `src/TasksPage.jsx`, `src/PartnerPage.jsx`, `src/ExpertsPage.jsx`, `src/ActivityPage.jsx`, `src/LeaderboardPage.jsx`, `src/ErrorBoundary.jsx`, `api/email-auth.js`, `server/src/routes/email-auth.js`, `scripts/demo-content.mjs`, `scripts/geocode-partners.js`, `scripts/serve-local-prod.mjs`
**Тип:** fix
**Что изменено:** Убран фиолетовый ореол Splash Screen, обновлены централизованные фоны светлой и тёмной темы, фронтенд `console.error` переведён на `logError`, снят Vite warning по смешанному импорту `firebase.js`.
**Почему:** Довести локального релиз-кандидата до более чистого визуального и технического состояния перед финальным ручным QA.

---

## [2026-07-06] V3.3 release blockers QA
**Коммит:** N/A
**Файлы:** `firestore.rules`, `api/vk-news.js`, `server/src/routes/vk-news.js`, `src/UserApp.jsx`, `src/RewardsPage.jsx`, `src/ProfilePanel.jsx`, `src/ExpertsPage.jsx`, `src/Scanner.jsx`, `scripts/serve-local-prod.mjs`
**Тип:** fix
**Что изменено:** Локально исправлены блокеры rewards/write-сценариев, безопасный fallback VK News, поведение QR-сканера, конфликт оверлеев с Floating Island и перекрытие кнопки темы в профиле.
**Почему:** Подготовить локальную V3 к функциональному QA без deploy и без изменения production.

---

## [2026-07-06] V3.1 architecture cleanup
**Коммит:** N/A
**Файлы:** `src/UserApp.jsx`, `src/HomePanel.jsx`, `src/routes.js`, `src/components/Layout.js`, `src/components/MainScreen.js`, `src/components/MapScreen.js`, `src/components/ProfileScreen.js`, `public/manifest.json`, `public/sw.js`, `index.html`, `.ai/*`, `AGENTS.md`, `AGENTS2.md`, `CLAUDE.md`
**Тип:** refactor
**Что изменено:** Удалены старая `HomePanel.jsx`, legacy роутер и пустые VK template-заглушки; `UserApp.jsx` очищен от `useHomeV2` runtime-веток; PWA стартует с `/#/`.
**Почему:** Завершить локальный переход пользовательского приложения на единую V3/V2 glass-архитектуру перед функциональным QA.

---

## [2026-07-06] Большой спринт Home V2
**Коммит:** N/A
**Файлы:** `src/HomePanelV2.jsx`, `src/UserApp.jsx`
**Тип:** refactor
**Что изменено:** Создана основа glass-дизайн-системы Home V2, отполирован первый экран, полноценно собран второй экран с каруселью, новостной композицией и ближайшими событиями, обновлён V2 floating island.
**Почему:** Довести локальную Home V2 до уровня цельного премиального продукта с собственной айдентикой АПГ.

---

## [2026-07-06] Фирменный стиль первого экрана Home V2
**Коммит:** N/A
**Файлы:** `src/HomePanelV2.jsx`
**Тип:** refactor
**Что изменено:** Перенастроены glass-материал, металлические золотые акценты, свет главной карточки и APG-сигнатура внутри hero-сцены без изменения структуры первого экрана.
**Почему:** Найти собственный визуальный язык АПГ 2.0, отличный от обычного Liquid Glass.

---

## [2026-07-06] Второй экран Home V2
**Коммит:** N/A
**Файлы:** `src/HomePanelV2.jsx`
**Тип:** feat
**Что изменено:** Добавлен второй экран Home V2: горизонтальная карусель «Сегодня для вас», композиция «Что нового» и блок «Ближайшие события» на существующих данных.
**Почему:** Продолжить историю новой главной после первого свайпа без превращения экрана в каталог.

---

## [2026-07-06] Типографика и Liquid Glass Home V2
**Коммит:** N/A
**Файлы:** `src/HomePanelV2.jsx`, `src/UserApp.jsx`
**Тип:** refactor
**Что изменено:** Обновлена типографика первого экрана, осветлена и оживлена hero-фотография, badge и кнопка стали элегантнее, усилен Liquid Glass материал нижнего острова.
**Почему:** Продолжить доводку Home V2 до премиального уровня без новых функций и бизнес-изменений.

---

## [2026-07-06] Композиционная настройка первого экрана Home V2
**Коммит:** N/A
**Файлы:** `src/HomePanelV2.jsx`, `src/UserApp.jsx`
**Тип:** refactor
**Что изменено:** Перенастроены визуальная иерархия, ритм, фон, hero-бейдж, единый модуль «Сегодня можно» и глубина V2 Glass Island без добавления новых функций.
**Почему:** Сделать первый экран Home V2 цельной премиальной композицией вместо набора отдельных карточек.

---

## [2026-07-06] Визуальная полировка первого экрана Home V2
**Коммит:** N/A
**Файлы:** `src/HomePanelV2.jsx`, `src/UserApp.jsx`
**Тип:** refactor
**Что изменено:** Увеличен воздух первого экрана, усилены liquid glass материалы, сделана более благородная графитово-синяя палитра и отполирован V2 Glass Island TabBar.
**Почему:** Довести Home V2 до ощущения цельного премиального продукта без добавления новой функциональности.

---

## [2026-07-06] Первый экран Home V2
**Коммит:** N/A
**Файлы:** `src/HomePanelV2.jsx`, `src/UserApp.jsx`
**Тип:** feat
**Что изменено:** В Home V2 добавлен премиальный первый экран с приветствием, liquid glass hero-карточкой, блоком «Сегодня можно» и условной V2-версией нижнего Glass Island TabBar.
**Почему:** Начало итерационной разработки АПГ 2.0 без изменений Home V1.

---

## [2026-07-05] Подготовлена песочница Home V2
**Коммит:** N/A
**Файлы:** `src/UserApp.jsx`, `src/HomePanelV2.jsx`
**Тип:** chore
**Что изменено:** Создан отдельный компонент `HomePanelV2` как независимая копия текущей главной, подключён opt-in переключатель `home=v2` через URL.
**Почему:** Начать разработку АПГ 2.0 локально без влияния на рабочую Home V1.

---

## [2026-07-05] Создана AI-документация проекта
**Коммит:** N/A (документация только)
**Файлы:** `.ai/**`, `CLAUDE.md`, `AGENTS.md`
**Тип:** docs
**Что изменено:** Полная документация проекта в 20+ файлах `.ai/` директории. Созданы файлы: PROJECT_OVERVIEW, ARCHITECTURE, DATABASE, API, FRONTEND, BACKEND, ADMIN_PANEL, TELEGRAM, BUSINESS_LOGIC, CODING_RULES, DESIGN_RULES, SECURITY, DEPLOYMENT, ROADMAP, KNOWN_PROBLEMS, DECISIONS. Memory, templates, CLAUDE.md, AGENTS.md.
**Почему:** AI-ready codebase для будущей разработки и онбординга AI-агентов.

---

## [2026-07-05] Возвращены QR-материалы в аккордеон админки
**Коммит:** N/A
**Файлы:** `src/AdminPanel.jsx`
**Тип:** fix
**Что изменено:** В раскрытых карточках партнёров и экспертов добавлен раздел «QR-коды и материалы для печати» на базе существующих `PartnerQRSection` и `ExpertQRSection`.
**Почему:** После UX-переделки админки QR-коды и печатные плакаты перестали быть доступны из карточек.

---

## [2026-06-27] Категории, обложки, даты для Новостей и Событий + лимит баннеров
**Коммит:** `8b13caa8`
**Файлы:** `src/AdminPanel.jsx`
**Тип:** feat
**Что изменено:** Форма событий: поля category (CONTENT_CATEGORIES), coverPhoto (PhotoUpload), startAt/endAt (datetime-local), location. Форма новостей: category, coverPhoto, publishedAt (date). Списки событий и новостей: категорийные бейджи, displaydates. Лимит 5 активных баннеров в saveBanner.
**Почему:** Завершение большого промта по обновлению контентных сущностей.

---

## [2026-06-27] Баннеры CRUD в AdminPanel
**Коммит:** `155664fd`
**Файлы:** `src/AdminPanel.jsx`
**Тип:** feat
**Что изменено:** Новая вкладка «📣 Реклама». Коллекция banners в Firestore. Полный CRUD с модальной формой. Рекламодатели: партнёр/эксперт/внешний. Статусы active/inactive/expired. Fetchdata с baннерами.
**Почему:** Начало реализации рекламной системы.

---

## [2026-06-27] Sticky toolbar, глобальный поиск, экспорт, ротация
**Коммит:** предыдущий
**Файлы:** `src/AdminPanel.jsx`
**Тип:** feat
**Что изменено:** Sticky toolbar с глобальным поиском по всем 4 сущностям. Dropdown «Добавить». Dropdown «Инструменты» (геокодирование, migrate categories). Счётчики для каждой вкладки. «⚠ Не проверены» toggle.
**Почему:** Ускорение работы администраторов.

---

## [2026-06-25] linksCheckedAt для событий и новостей
**Коммит:** предыдущий
**Файлы:** `src/AdminPanel.jsx`
**Тип:** feat
**Что изменено:** Поле linksCheckedAt, кнопка «✓», фильтры «⚠ Непроверенные» для вкладок События и Новости. Исправлена мёртвая сортировка в expert/partner фильтре.
**Почему:** Продолжение системы проверки ссылок.

---

## [2026-07-07] Синхронизация VK Mini App с актуальной версией АПГ
**Коммит:** pending
**Файлы:** `src/vk.js`, `public/sw.js`
**Тип:** fix
**Что изменено:** VK-контекст теперь определяется не только по `window.location.search`, но и по параметрам внутри hash-router URL (`#/...?vk_app_id=...`), чтобы Mini App корректно включал VK-поведение при любом формате запуска. Версия service worker обновлена до `apg-v5-vk-sync-20260707`, чтобы VK/PWA не держали старый shell и runtime cache.
**Почему:** В коде VK уже использует тот же `UserApp`, `HomePanelV2`, `LokiProvider`, нижний остров и V2-страницы, что и Web App. Устаревший вид в VK связан с доставкой/кэшем отдельного VK Hosting; новая сборка должна принудительно сменить cache version.

---

## [2026-07-07] Восстановлен запуск загрузки данных админки
**Коммит:** pending
**Файлы:** `src/AdminPanel.jsx`
**Тип:** fix
**Что изменено:** После успешной инициализации Firebase Auth снова запускается `fetchData()`. Ранее `waitForAdminAuth()` выполнялся, но загрузка коллекций автоматически не стартовала, поэтому админка могла оставаться без данных до ручного повторного действия.
**Почему:** После переработки устойчивой загрузки админки был потерян вызов загрузки после auth-ready.

---

## [2026-07-07] Премиальный раздел новостей
**Коммит:** pending
**Файлы:** `src/newsUtils.js`, `src/NewsPage.jsx`, `src/HomePanelV2.jsx`, `src/UserApp.jsx`, `src/ProfilePanel.jsx`
**Тип:** feat
**Что изменено:** Добавлен единый слой нормализации новостей, новая страница “Новости” с категориями, поиском, сортировкой, популярными материалами, чтением статьи, прогрессом чтения, реакциями, сохранением и “прочитать позже”. Главная получила новый горизонтальный премиальный блок новостей вместо старого блока, а профиль показывает сохранённые материалы.
**Почему:** Раздел новостей должен ощущаться полноценным информационным центром АПГ, а не второстепенным списком материалов.

---

## [2026-07-08] Incident fix: быстрый Telegram webhook
**Коммит:** `pending`
**Файлы:** `server/src/routes/telegram-webhook.js`, `api/telegram-webhook.js`
**Тип:** fix
**Что изменено:** Telegram webhook теперь сначала быстро переводит auth-сессию в `done` и возвращает 200, а загрузка фото профиля, обновление пользователя и отправка сообщения в Telegram выполняются фоном без блокировки ответа webhook.
**Почему:** Telegram `getWebhookInfo` показывал `Connection timed out`; из-за ожидания внешних Telegram API и обновления профиля webhook мог не успевать ответить на `/start auth_...`, поэтому приложение не завершало Telegram-авторизацию.

---

## [2026-07-08] Production follow-up: backend-first public data и обновление SW cache
**Коммит:** `pending`
**Файлы:** `src/UserApp.jsx`, `public/sw.js`
**Тип:** fix
**Что изменено:** Стартовые публичные данные главной теперь сначала загружаются через backend `/api/public-data`, а прямой Firestore read используется только как fallback. Версия service worker cache поднята до `apg-v5-hotfix-20260708`, чтобы установленная PWA быстрее сбросила старые runtime/static caches.
**Почему:** У пользователей production мог продолжать показывать пустые блоки из-за client Firestore/Auth/rules/cache, а установленная PWA могла оставаться на старом service worker cache после предыдущего deploy.

---

## [2026-07-07] Исправлена запись согласий после email/Telegram авторизации
**Коммит:** pending
**Файлы:** `src/UserApp.jsx`, `src/ConsentScreen.jsx`, `src/EmailAuth.jsx`, `src/ProfilePanel.jsx`
**Тип:** fix
**Что изменено:** Перед записью профиля и согласий добавлена явная подготовка Firebase owner-сессии через `auth_map`; если текущая сессия привязана к другому пользователю, создаётся новая анонимная Firebase-сессия с корректной связкой. Экран согласий теперь показывает понятную ошибку внутри модального окна. EmailAuth передаёт наверх полный ответ API, Telegram/email этапы авторизации пишут диагностический trace в `localStorage.apg_auth_trace`, сетевые ошибки отправляются через `errorLogger`.
**Почему:** После входа по email/Telegram пользовательский документ создавался backend'ом, но клиентская запись согласий могла блокироваться Firestore rules из-за отсутствующего или устаревшего `auth_map`, поэтому кнопка «Продолжить» визуально ничего не завершала.

---

## [2026-07-07] Production hotfix главной, экспертов и Telegram auth
**Коммит:** `pending`
**Файлы:** `src/UserApp.jsx`, `src/ProfilePanel.jsx`, `api/public-data.js`, `server/src/routes/public-data.js`, `server/src/server.js`
**Тип:** fix
**Что изменено:** Добавлен backend fallback `/api/public-data` для стартовых публичных данных главной (партнёры, события, новости, уведомления, отзывы, задания, эксперты, stats), который используется только если прямое Firestore-чтение на клиенте падает. Telegram auth start теперь отправляет валидный JSON body, чтобы Fastify не отклонял POST до обработчика при `Content-Type: application/json`.
**Почему:** В production нужно быстро восстановить устойчивость главной/экспертов при закрытых или нестабильных Firestore reads и устранить сценарий, когда кнопка Telegram login не создаёт auth-сессию из-за пустого JSON body.

---

## [2026-06-24] Модальные окна для Событий и Новостей
**Коммит:** предыдущий
**Файлы:** `src/AdminPanel.jsx`
**Тип:** refactor
**Что изменено:** Формы событий и новостей переведены из inline-секций в fixed modal overlay (аналогично партнёрам/экспертам). Исправлены startEditEvent/startEditNews.
**Почему:** Единообразие UX всех форм AdminPanel.

---

## [2026-06-23] Поиск по экспертам, сортировка по linksCheckedAt
**Коммит:** предыдущий
**Файлы:** `src/AdminPanel.jsx`
**Тип:** feat
**Что изменено:** Поиск по имени/специализации внутри вкладки экспертов. Правильная сортировка null/старые сначала.
**Почему:** UX запрос для ускорения работы с большим списком.

---

## [2026-06-22] linksCheckedAt для партнёров и экспертов
**Коммит:** предыдущий
**Файлы:** `src/AdminPanel.jsx`
**Тип:** feat
**Что изменено:** Поле linksCheckedAt, markLinksChecked helper, isCheckedRecently helper, кнопка «✓», фильтр «⚠ Непроверенные» для партнёров и экспертов.
**Почему:** Система мониторинга актуальности внешних ссылок (сайты, VK).

---

## [2026-06-21] Эксперты: модальная форма + аккордеон
**Коммит:** предыдущий
**Файлы:** `src/AdminPanel.jsx`
**Тип:** feat
**Что изменено:** Вкладка Эксперты переведена на модальную форму + аккордеон-список (единый паттерн с партнёрами).
**Почему:** UX запрос по стандартизации.

---

## [2026-06-20] APP_URL: apg-alliance → myapg.ru
**Коммит:** `ff575f22`
**Файлы:** `src/constants.js`
**Тип:** chore
**Что изменено:** Константа APP_URL изменена с `apg-alliance.vercel.app` на `myapg.ru`.
**Почему:** Переход на собственный домен.

---

## [2026-06-20] Категория «Психология» для экспертов
**Коммит:** `c02e0b16`
**Файлы:** `src/constants.js`, `src/AdminPanel.jsx`
**Тип:** feat
**Что изменено:** Добавлена категория `psychology` в EXPERT_CATEGORIES.
**Почему:** Запрос от команды — пришли эксперты-психологи.

---

## [2026-06-19] Исправлен конфликт свайпов в ExpertsPage
**Коммит:** `8db315f4`
**Файлы:** `src/ExpertsPage.jsx`
**Тип:** fix
**Что изменено:** Исправлен конфликт между горизонтальным свайпом смены вкладки в UserApp и горизонтальным скроллом фильтров категорий в ExpertsPage.
**Почему:** Пользователи жаловались что при прокрутке фильтров случайно переходят на другой экран.

---

## Шаблон для будущих записей

```markdown
## [YYYY-MM-DD] Название изменения
**Коммит:** `hash`
**Файлы:** `src/...`
**Тип:** feat | fix | refactor | docs | chore
**Что изменено:** ...
**Почему:** ...
```
