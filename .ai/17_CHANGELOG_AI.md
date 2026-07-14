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

## [2026-07-14] feat: Workspace Dialogs CRM
**Коммит:** `pending`
**Файлы:** `src/workspace/WorkspaceDialogsCRM.jsx`, `src/workspace/DesktopWorkspace.jsx`, `server-shared/workspace-dialogs.js`, `server/src/routes/user-actions.js`, `scripts/context-dialogs-test.mjs`, `scripts/workspace-core-test.mjs`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:**
- Раздел `Диалоги` в Desktop Workspace стал коммуникационным CRM-центром: левая колонка с поиском, фильтрами, непрочитанными/архивом/закреплёнными; центральный чат; правая CRM-панель клиента.
- Экран использует существующие `contextDialogs`, `contextDialogMessages`, `dialog:*` actions, realtime-зеркала, booking-связи, уведомления и history без создания второго мессенджера.
- Добавлены приватные рабочие поля диалога `pinned`, `archived`, `notes`, `status` через `dialog:workspaceUpdate`; заметки сохраняются только в mirror владельца/сотрудника и не показываются пользователю.
**Почему:** партнёр или эксперт должен сопровождать клиента из Workspace: видеть контекст, переписку, встречи, историю, заметки и быстрые действия в одном рабочем экране.

## [2026-07-14] feat: Workspace profile editor entry
**Коммит:** `pending`
**Файлы:** `src/workspace/DesktopWorkspace.jsx`, `src/cabinet/DigitalShowcaseBuilder.jsx`, `scripts/workspace-core-test.mjs`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:**
- В Desktop Workspace добавлен раздел `Мой профиль` вторым пунктом меню после `Рабочий стол`; профиль партнёра/эксперта открывается прямо в рабочей области Workspace.
- Раздел использует общий `DigitalShowcaseBuilder`/`ShowcaseBuilderCore` без копирования форм: те же данные карточки, автосохранение, локальный черновик, статус сохранения, Ctrl/Cmd+S и beforeunload-защита.
- Переключатель двойной роли теперь меняет не только визуальный режим Workspace, но и активный профиль/редактор партнёра или эксперта.
**Почему:** Workspace должен управлять собственным бизнес-профилем, а не отправлять партнёра/эксперта искать редактирование в кабинетах или админке.

## [2026-07-14] fix: normalize Telegram input before saving
**Коммит:** `pending`
**Файлы:** `server-shared/telegram.js`, `src/utils/externalUrls.js`, `src/AdminPanel.jsx`, `src/cabinet/CabinetCorePage.jsx`, `src/cabinet/ShowcaseBuilderCore.js`, `server/src/routes/public-submit.js`, `server/src/routes/user-actions.js`, `scripts/telegram-url-test.mjs`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:**
- Добавлена единая функция `normalizeTelegramUrl()`; `telegramUrl()` теперь безопасно принимает полный URL, username, `@username` и `/username`.
- Telegram-ссылки нормализуются перед сохранением в профилях партнёров/экспертов, публичных формах, витрине, админских новостях/мероприятиях и partner AI-черновиках.
- Контрактный тест расширен кейсами legacy URL, `telegram.me`, `www.telegram.me`, username, invite, share, query и hash.
**Почему:** старые Telegram-ссылки из пользовательского ввода и внешних источников должны попадать в Firestore уже в новом формате `https://telegram.me/...`.

## [2026-07-14] fix: migrate Telegram links to telegram.me
**Коммит:** `pending`
**Файлы:** `server-shared/telegram.js`, `src/utils/externalUrls.js`, `src/NewsPage.jsx`, `src/AdminPanel.jsx`, `src/ExpertCabinetPage.jsx`, `src/expertProfileForm.js`, `server/src/routes/telegram-auth-start.js`, `server/src/routes/admin-actions.js`, `server/src/routes/public-submit.js`, `server/src/lib/telegramUpdates.js`, `scripts/telegram-url-test.mjs`, `scripts/seed-demo-partner.mjs`, `scripts/expert-questionnaire-v2-test.mjs`, `scripts/showcase-builder-test.mjs`, `package.json`, `.ai/04_API.md`, `.ai/08_TELEGRAM.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:**
- Все Telegram URL в исходниках, backend, bot keyboard, admin share, news share, seed/test data и документации переведены с legacy-домена на `https://telegram.me/`.
- Добавлен shared helper `server-shared/telegram.js`: `telegramUrl()`, `telegramShareUrl()`, `telegramPath()`; frontend/backend нормализация Telegram-ссылок теперь отдаёт единый домен и принимает старый ввод из базы/форм.
- `test:core` расширен контрактом `telegram-url-test`, который фиксирует auth/channel/share URL и legacy-normalization.
**Почему:** Telegram-ссылки должны формироваться системно из одного источника и не возвращать старый домен в новых сценариях.

## [2026-07-14] feat: Workspace Meetings center
**Коммит:** `pending`
**Файлы:** `src/workspace/DesktopWorkspace.jsx`, `src/UserApp.jsx`, `src/intelligence/WorkspaceDayPlanner.js`, `.ai/05_FRONTEND.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:**
- В левом меню Desktop Workspace раздел `Эксперты и клиенты` заменён на `Встречи`; новый пункт расположен третьим после `Рабочий стол` и `Мероприятия`.
- Добавлен рабочий экран `Встречи` поверх существующего booking-модуля: KPI по статусам, календарь день/неделя/месяц, фильтры, поиск, ближайшие встречи, блоки сегодня/завтра и карточка встречи с действиями подтверждения, переноса, отмены, завершения, неявки и открытия диалога.
- Workspace Intelligence больше не ведёт в скрытый CRM-раздел `clients`: возможность `Проверить встречи` открывает новый рабочий центр `booking`.
**Почему:** встречи стали ежедневным рабочим инструментом партнёра/эксперта и должны быть доступны прямо из Workspace без перехода в Cabinet.

## [2026-07-13] feat: Meetings V1.1 lifecycle
**Коммит:** `pending`
**Файлы:** `server-shared/booking.js`, `server/src/routes/user-actions.js`, `src/ProfilePanel.jsx`, `src/cabinet/CabinetCorePage.jsx`, `src/contextDialogs/ContextDialogsPage.jsx`, `scripts/booking-test.mjs`, `.ai/04_API.md`, `.ai/05_FRONTEND.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:**
- Online Booking V1 расширен до Meetings V1.1: статусы `pending/confirmed/reschedule_requested/rescheduled/cancelled_by_user/cancelled_by_provider/completed/no_show`, история переходов, backend actions жизненного цикла, расписание напоминаний за сутки/2 часа и overlap-защита активных слотов.
- В профиле пользователя блок `Мои записи` получил группировку и действия отмены/запроса переноса; в Cabinet модуль записи получил календарь день/неделя/месяц, фильтры, ожидающие подтверждения и действия партнёра/эксперта.
- Booking-диалоги получили закреплённую карточку встречи и системные события статуса, а контрактные тесты покрывают переходы, историю, блокировку и освобождение слотов.
**Почему:** базовая онлайн-запись должна стать завершённым рабочим циклом встречи без создания отдельного продукта и без редизайна Workspace.

## [2026-07-13] fix: partner/expert Desktop Workspace access
**Коммит:** `pending`
**Файлы:** `server-shared/role-engine.js`, `src/workspace/WorkspaceFeatureFlags.js`, `scripts/role-engine-test.mjs`, `scripts/desktop-workspace-test.mjs`
**Тип:** fix
**Что изменено:**
- Роли `partner` и `expert` теперь получают permission `workspace.open` и capability `canUseWorkspace`, а не только доступ к Business Hub.
- Desktop Workspace rollout по умолчанию переведён с `owner` на `expert`, чтобы партнёры и эксперты видели кнопку Workspace без ручного localStorage-флага.
- Контрактные тесты закрепляют доступ Workspace для партнёров/экспертов и отсутствие доступа у обычного пользователя.
**Почему:** пользователь `daria_samarina@mail.ru` был корректно распознан как владелец партнёра через `ownerEmail`, но кнопка Workspace скрывалась, потому что условие показа требовало `canUseWorkspace`, которого у роли `partner` не было.

## [2026-07-13] feat: device-aware Push Diagnostics для iPhone PWA
**Коммит:** `pending`
**Файлы:** `src/pushDiagnostics.js`, `src/ApgHealthPage.jsx`, `src/UserApp.jsx`, `server/src/routes/user-actions.js`, `server/src/routes/send-push.js`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:**
- Push-регистрация стала device-aware: PWA создаёт локальный `deviceId`, проверяет Notification/Service Worker/PushManager/subscription и сохраняет безопасную мета-информацию устройства в профиле без endpoint/ключей.
- В APG Health добавлена вкладка `Push`: permission, SW, PushManager, subscription, FCM, deviceId, platform, last registration, last successful push, active subscription и количество устройств.
- Добавлены actions `push:register`, `push:cleanupSubscriptions`, `push:testDevice`: перерегистрация текущего устройства, очистка старых подписок с сохранением текущей и тестовый push строго на этот endpoint.
- Регистрация при запуске PWA теперь автоматически восстанавливает отсутствующую subscription при `Notification.permission=granted`; stage-логи `push register start/permission/service worker ready/subscription exists/subscription created/subscription saved/subscription failed` хранятся локально и видны в диагностике.
**Почему:** без device-id невозможно доказать, что сохранённая Apple Web Push подписка относится именно к текущему iPhone PWA, а не к старой установке или другому профилю.

---

## [2026-07-13] fix: push контекстных диалогов — таймауты web-push и этапная диагностика
**Коммит:** `pending`
**Файлы:** `server/src/routes/send-push.js`, `server/src/routes/user-actions.js`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:**
- Первопричина «push не приходит» в диалогах: у web-push НЕТ таймаута, а одна мёртвая Apple-подписка (web.push.apple.com; локально отдаёт 400) вызывала вечное зависание TLS-коннекта из Yandex-контейнера. dialog:message висел до 30-секундного лимита контейнера: сообщение записывалось (batch.commit до push), а отправка push погибала — уведомления оставались с pushStatus: pending.
- Все webpush.sendNotification и FCM sendEachForMulticast обёрнуты в таймаут (10–15 с) в send-push.js и в диалоговом пути user-actions.js; код ошибки webpush/timeout виден в pushStats.
- actionDialogMessage: этапное production-safe логирование (prepared: получатели/уведомления/причины пропуска; push_result: sent/failed/subscribers/errorCodes) и честный pushStatus: error вместо вечного pending при падении отправки.
- Мёртвая подписка удалена из профиля владельца; контрольный push после фикса: sent 1/1 за 1.1 с (было 30 с таймаут).
- Диагностика также показала: у второго тестового аккаунта три несвязанных профиля (VK без согласия / email с живой подпиской / tg со старым FCM-токеном) — пуши уходили на неактивные устройства. Это identity-фрагментация, не баг push-кода.
**Почему:** production-блокер обмена сообщениями; одна битая подписка любого получателя вешала всю отправку.

---

## [2026-07-13] fix: rename shopping category label
**Коммит:** `pending`
**Файлы:** `src/HomePanelV2.jsx`, `src/NearbyPage.jsx`, `src/MapPage.jsx`, `src/AdminPanel.jsx`, `src/tariffConfig.js`, `src/components/EntityPreviewCard.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:**
- Отображаемое название категории `shopping` заменено с “Шоппинг/Шопинг” на “Магазины” в каталогах, фильтрах, карте, Nearby, админке, тарифных справочниках и preview-карточках.
- Внутренний идентификатор `shopping` не менялся, чтобы не нарушить фильтрацию, поиск, аналитику и существующие связи.
- В Firestore выполнена точечная миграция legacy `categoryLabel=Шоппинг` у партнёра `t3JbrL0GJwp2zTqhu9CJ` на `Магазины`; после проверки legacy labels не осталось.
**Почему:** пользовательское название категории должно быть понятным и единым во всём приложении.

## [2026-07-13] feat: Workspace digital showcase builder
**Коммит:** `pending`
**Файлы:** `src/cabinet/CabinetCorePage.jsx`, `src/cabinet/DigitalShowcaseBuilder.jsx`, `src/cabinet/ShowcaseBuilderCore.js`, `server/src/routes/user-actions.js`, `scripts/showcase-builder-test.mjs`, `package.json`
**Тип:** feat
**Что изменено:**
- Единый кабинет партнёра/эксперта теперь открывается с конструктора цифровой витрины: вкладки “Витрина”, “Фото и видео”, “Контакты и соцсети”, “О бизнесе/эксперте”, “Контент”, “Аналитика”, “Как видят клиенты”, “Локи”.
- Витрина использует те же данные, что публичная карточка: live preview через `EntityPreviewCard`, загрузка фото через существующие `PhotoUpload/GalleryUpload`, автосохранение через существующий `userAction(...:profileUpdate)`.
- Добавлены заполненность профиля, чек-лист, подсказки Локи с кнопкой “Исправить”, компактная аналитика и core regression для модели витрины.
**Почему:** кабинет должен восприниматься как мобильный конструктор публичной страницы бизнеса, а не как длинная административная анкета.

## [2026-07-13] fix: Telegram-авторизация — переход с webhook на getUpdates-поллинг
**Коммит:** `pending`
**Файлы:** `server/src/lib/telegramUpdates.js` (новый), `server/src/routes/telegram-webhook.js`, `server/src/routes/telegram-auth-check.js`, `server/src/routes/system-status.js`, `server/deploy.sh`, `server/deploy-cron.sh`, `.ai/13_DEPLOYMENT.md`
**Тип:** fix
**Что изменено:**
- Первопричина отказа авторизации: Telegram не мог установить TCP-соединение с Yandex-контейнером (getWebhookInfo «Connection timed out»); апдейты доставлялись ретраями через 30–70 минут, когда 5-минутная auth-сессия уже истекла. Последняя успешная авторизация — 10.07; доставка деградировала неделями (07.07: 2 успеха из 33 сессий). Код цепочки был исправен (подтверждено сквозным тестом).
- Бот переведён на исходящий getUpdates-поллинг: (1) цикл telegram-auth-check поллит каждую ~1 с, пока клиент ждёт авторизацию; (2) timer-триггер apg-telegram-poll раз в минуту → /api/telegram-poll (CRON_SECRET) для органических команд. Webhook у Telegram удалён (иначе 409-конфликт), обработчик апдейтов вынесен в server/src/lib/telegramUpdates.js (общий для webhook-роута и поллера), offset+lock в config/telegramPolling.
- Наблюдаемость: /api/system-status → блок telegramAuth (lastPollAt, pollAgeSec, lastError) — деградация поллинга видна в админ-Диагностике, а не через жалобы пользователей.
- CRON_SECRET сгенерирован (был пуст) и проброшен в контейнер через deploy.sh; в deploy-cron.sh убран несуществующий флаг --force.
**Почему:** production-блокер — новые пользователи не могли войти через Telegram; сетевой путь Telegram→Yandex вне нашего контроля, поллинг убирает зависимость от него.

---

## [2026-07-13] fix: simplify referral invite text
**Коммит:** `pending`
**Файлы:** `src/referralInvite.js`, `src/UserApp.jsx`, `src/ReferralPage.jsx`, `src/ProfilePanel.jsx`, `src/constants.js`, `scripts/referral-invite-test.mjs`, `package.json`
**Тип:** fix
**Что изменено:**
- Добавлен единый шаблон реферального приглашения: `Присоединяйся к Альянсу Партнёров Зеленограда 👇` + текущая ссылка.
- Telegram/VK/Web Share/clipboard сценарии реферального приглашения больше не отправляют имя, ключи, уровень, стрик или посещённых партнёров.
- Реферальные ссылки с `?ref=` сохраняются полностью; добавлен regression-тест шаблона.
**Почему:** приглашение должно быть коротким и понятным человеку, который ещё не знаком с АПГ, без отвлекающей персональной статистики.

---

## [2026-07-13] feat: add Workspace Intelligence day planner
**Коммит:** `pending`
**Файлы:** `src/intelligence/WorkspaceDayPlanner.js`, `src/intelligence/IntelligenceService.js`, `src/intelligence/index.js`, `src/workspace/DesktopWorkspace.jsx`, `src/UserApp.jsx`, `scripts/workspace-core-test.mjs`
**Тип:** feat
**Что изменено:**
- Добавлен `WorkspaceDayPlanner`, который формирует рабочий день партнёра/эксперта: задачи, приоритеты, изменения, проблемные зоны, возможности, мини-аналитику и совет Локи.
- `IntelligenceService` получил метод `getWorkspaceDayPlan()`, а Workspace Dashboard показывает новый верхний блок `Workspace Intelligence` над существующими рабочими центрами.
- План дня использует уже существующие `AI Context`, `AI Memory`, `Activity Timeline`, `Analytics Collector`, `Recommendation Engine` и app state без новых подписок и без изменения рабочих сценариев.
**Почему:** Workspace должен быть не просто кабинетом, а интеллектуальным координатором рабочего дня: что произошло, что сделать сейчас и куда перейти одним действием.

---

## [2026-07-13] feat: turn Workspace into work centers
**Коммит:** `pending`
**Файлы:** `src/workspace/DesktopWorkspace.jsx`, `src/UserApp.jsx`
**Тип:** feat
**Что изменено:**
- Workspace перестроен из меню разделов в рабочую среду с центрами `Рабочий стол`, `Привлечение клиентов`, `Контент`, `Мероприятия`, `Акции и предложения`, `Клиенты`, `Отзывы`, `Аналитика`, `Финансы`, `Центр уведомлений`, `Настройки`.
- Каждый центр получил собственный контекст, метрики, список действий на сегодня, рабочие модули и задел под филиалы, роли, сотрудников, историю изменений и согласования.
- Workspace начал использовать данные Intelligence Platform: analytics snapshot, Activity Timeline, Recommendation Engine, Daily Summary и Home Experience; на рабочем столе появились компактные рекомендации Локи и быстрые действия.
**Почему:** Workspace должен отвечать на вопрос “что мне нужно сделать сегодня?” и стать ежедневной рабочей средой партнёра/эксперта, а не набором равнозначных ссылок.

---

## [2026-07-13] feat: move Intelligence UI into Loki
**Коммит:** `pending`
**Файлы:** `src/HomePanelV2.jsx`, `src/LokiPage.jsx`, `src/loki/LokiProvider.jsx`, `src/loki/LokiAssistant.jsx`
**Тип:** feat
**Что изменено:**
- С главной страницы удалены видимые Intelligence-рекомендации, включая `Локи заметил`; Home снова остаётся городской навигацией и тематической витриной.
- Loki Home стал единым интерфейсом Intelligence Platform: добавлены блоки `Сегодня для вас`, `Продолжить`, `Локи рекомендует`, `Что изменилось`, `Сегодня` и `Спросите Локи`.
- Dashboard Локи формируется из уже существующих `homeExperience`, `recommendations`, `continueExperience`, `dailySummary`, `aiMemory` и `activityTimeline` без новых источников данных.
**Почему:** интеллект АПГ должен иметь одно понятное место — Локи как личный цифровой помощник пользователя, а не быть размазанным по карточкам Home.

---

## [2026-07-13] fix: restore Nearby card semantics on Home
**Коммит:** `pending`
**Файлы:** `src/HomePanelV2.jsx`
**Тип:** fix
**Что изменено:**
- Из desktop-карточки `Рядом` удалён вложенный блок `Локи заметил`; географический блок больше не показывает AI-подсказки как nearby-контент.
- Карточка `Рядом` стала компактным списком партнёров, мероприятий и экспертов с расстоянием, быстрыми действиями, счетчиками и мини-индикатором карты при наличии координат.
- Сортировка nearby-объектов учитывает расстояние, открыто сейчас, события сегодня, избранное, акции, популярность и сигналы Recommendation Engine/Home Experience без новой архитектуры.
**Почему:** раздел `Рядом` должен показывать только ближайшие объекты и сохранять понятную географическую семантику; Loki остаётся отдельным интеллектуальным слоем приложения.

---

## [2026-07-13] fix: repair AI Context task normalization
**Коммит:** `pending`
**Файлы:** `src/intelligence/AIContextService.js`
**Тип:** fix
**Что изменено:**
- Исправлен вызов нормализации `customTasks` при сборке AI Context: используется существующий `normalizeList`.
- Устранён production runtime crash `ReferenceError: normalized is not defined`, найденный smoke-проверкой после выкладки Intelligence Experience.
**Почему:** AI Context должен строиться прозрачно для Home и Loki без падения приложения в production.

---

## [2026-07-13] feat: launch APG Intelligence Experience
**Коммит:** `pending`
**Файлы:** `src/intelligence/IntelligenceService.js`, `src/intelligence/HomeExperienceService.js`, `src/intelligence/ContinueExperience.js`, `src/intelligence/InterestModel.js`, `src/intelligence/recommendationEngine.js`, `src/intelligence/PersonalHomeContext.js`, `src/intelligence/index.js`, `src/UserApp.jsx`, `src/HomePanelV2.jsx`, `src/NewsPage.jsx`
**Тип:** feat
**Что изменено:**
- Добавлен единый `IntelligenceService` с методами `getHomeExperience`, `getRecommendations`, `getPersonalInsights`, `getContinueExperience`, `getInterestModel`, `getDailySummary`.
- Home Experience теперь рассчитывает динамические приоритеты секций, Smart Home Context, Continue Experience, объяснимые рекомендации и Loki advice поверх AI Context/Memory/Timeline.
- На главной аккуратно показана первая персональная подсказка `Локи заметил`, если есть безопасная рекомендация; существующий UI и сценарии не переписаны.
**Почему:** после инфраструктурного этапа пользователь должен впервые почувствовать, что АПГ стало персональным и “живым”, без риска для текущих разделов.

---

## [2026-07-13] feat: connect Intelligence Platform to user scenarios
**Коммит:** `pending`
**Файлы:** `src/intelligence/EventBus.js`, `src/intelligence/ActivityTimeline.js`, `src/intelligence/AIMemory.js`, `src/intelligence/AnalyticsCollector.js`, `src/intelligence/AIContextService.js`, `src/intelligence/recommendationEngine.js`, `src/intelligence/PersonalHomeContext.js`, `src/intelligence/index.js`, `src/UserApp.jsx`, `src/NewsPage.jsx`, `src/PartnerPage.jsx`, `src/ExpertsPage.jsx`, `src/LokiPage.jsx`
**Тип:** feat
**Что изменено:**
- Event Bus получил пользовательские события для экранов, новостей, мероприятий, партнёров, экспертов, QR, Локи и рекомендаций; основные сценарии начали публиковать non-blocking события.
- Добавлены локальные `ActivityTimeline`, `AIMemory` и `AnalyticsCollector`, которые автоматически подписываются на Event Bus и собирают журнал активности, AI-память и счётчики без сервера.
- AI Context, Recommendation Engine и Personal Home Context начали учитывать последние действия, просмотры, избранное, частые действия, время суток и скрытые home-инсайты.
**Почему:** первый этап создал инфраструктуру Intelligence Platform; второй этап подключает к ней реальные пользовательские сценарии без изменения UI и привычных flows.

---

## [2026-07-13] feat: finalize Workspace 2.2 single-screen role dashboard
**Коммит:** `pending`
**Файлы:** `src/workspace/DesktopWorkspace.jsx`
**Тип:** feat
**Что изменено:**
- Header Workspace унифицирован с пользовательским режимом: используется фирменный логотип АПГ, заголовок `АПГ: ЗЕЛЕНОГРАД` и пользовательская навигация.
- Нижний блок `Быстрые действия` полностью удалён из JSX; hero, KPI, левая панель и отступы уплотнены под одноэкранный Dashboard.
- Добавлен общий role-view слой Workspace (`partner`, `expert`, `admin`) поверх единого Layout/Engine: меняются задачи, KPI-подписи и контекст, но не создаются отдельные приложения.
**Почему:** Workspace должен быть ролевым рабочим кабинетом участника АПГ и помещаться в один desktop viewport без ощущения второй главной страницы.

---

## [2026-07-13] feat: optimize Workspace 2.1 to single-screen dashboard
**Коммит:** `pending`
**Файлы:** `src/workspace/DesktopWorkspace.jsx`
**Тип:** feat
**Что изменено:**
- Workspace dashboard перестал показывать длинную страницу: hero/KPI/top-row уплотнены, задачи ограничены первыми 3 пунктами, мероприятия — первыми 2, сообщения — первыми 3.
- Быстрые действия перенесены из большой секции в компактную горизонтальную панель одной строки.
- Левая панель стала ниже и плотнее: уменьшены пустые зоны, высота пунктов и нижняя карточка пользователя.
**Почему:** Workspace должен работать как приборная панель: всё важное видно одним взглядом на desktop, а полные списки открываются через соответствующие разделы.

---

## [2026-07-13] feat: replace dark Workspace shell with light SaaS dashboard
**Коммит:** `pending`
**Файлы:** `src/workspace/DesktopWorkspace.jsx`
**Тип:** feat
**Что изменено:**
- Основной Desktop Workspace больше не использует старый тёмный `WorkspaceLayoutEngine`, постоянную AI-column и нижний status bar.
- Workspace собран как светлая SaaS-панель по референсу: верхний APG-header, левая навигация, большой рабочий hero, KPI-график, задачи, мероприятия, сообщения и быстрые действия.
- Корень получил маркер `data-workspace-shell="light-saas"` для проверки, что рендерится новый shell, а не старая dark glass-оболочка.
**Почему:** production визуально смешивал новый Workspace 2.0 со старым тёмным shell; нужно было заменить именно сцену и композицию, а не чинить наложение стилями.

---

## [2026-07-13] fix: prevent PWA update from marking version installed before reload
**Коммит:** `pending`
**Файлы:** `src/pwa/PwaUpdateManager.js`, `scripts/pwa-update-manager-test.mjs`
**Тип:** fix
**Что изменено:**
- PWA Update Manager больше не записывает новую версию в `apg_build` до фактической reload-сессии; новая версия хранится как pending update.
- Если reload не произошёл, следующий запуск не считает старый bundle актуальным и продолжает требовать обновление.
- Regression-тест проверяет, что pending version не становится installed до reload и очищается только после подтверждённой reload-сессии.
**Почему:** production мог показывать новый `version.json`, но продолжать работать на старом JS, потому что версия помечалась установленной до реальной перезагрузки.

---

## [2026-07-13] fix: replace legacy workspace components in Workspace 2.0
**Коммит:** `pending`
**Файлы:** `src/workspace/DesktopWorkspace.jsx`
**Тип:** fix
**Что изменено:**
- `DesktopWorkspace` больше не импортирует и не рендерит legacy `WorkspaceComponents.jsx`: `WorkspacePanel`, `SectionHeader`, `ContentGrid` заменены локальными V2-компонентами.
- Корень Workspace получил явный маркер `data-workspace-version="2.0"`, а панели/сетки — V2-маркеры для DOM-проверки единственной реализации.
- Новый Workspace больше не опирается на старый dashboard/component-layer внутри React-дерева; старые общие компоненты остаются только для Business Hub/Cabinet Core, где они реально используются.
**Почему:** production показал визуальное наложение старого Workspace-слоя; Workspace 2.0 должен быть единственной реализацией рабочего пространства.

---

## [2026-07-13] feat: Workspace 2.0 dashboard redesign
**Коммит:** `pending`
**Файлы:** `src/workspace/DesktopWorkspace.jsx`
**Тип:** feat
**Что изменено:**
- Desktop Workspace перестроен из набора равнозначных карточек в рабочую панель «что сделать сегодня»: dashboard hero, Kanban задач, компактные события, сообщения и быстрые действия.
- Левая навигация приведена к рабочим разделам APG: Сводка, События, Новости, Партнёры, Эксперты, Акции, Награды, Ключи, Сообщения, Аналитика, Управление; внизу добавлены карточка пользователя и переключение режимов.
- Правая колонка стала операционной панелью: KPI со sparkline, живая активность, напоминания и быстрый вопрос Локи вместо повторяющихся briefing/context/recommendation-карточек.
**Почему:** Workspace должен быть профессиональным центром управления АПГ, а не второй пользовательской главной страницей.

---

## [2026-07-13] ux: Desktop Home news layout and header search
**Коммит:** `pending`
**Файлы:** `src/HomePanelV2.jsx`
**Тип:** ux
**Что изменено:**
- В desktop Header возвращён компактный glass-поиск `Поиск по АПГ...` перед уведомлениями и кнопкой Workspace; быстрые запросы ведут в существующие разделы, остальные открывают Локи.
- Блок `Главная новость дня` перестроен в систему `главная новость + 4 компактных материала` без увеличения общей высоты секции.
- Главная новостная карточка получила более крупное изображение, заголовок и описание, а боковая колонка теперь показывает новости/партнёра/эксперта/акцию как editorial-подборку.
**Почему:** новостной блок должен быть логически согласован с `Сегодня в АПГ`: один главный материал и несколько дополнительных сигналов, без роста высоты Desktop Home.

---

## [2026-07-13] ux: Desktop Home final layout balance
**Коммит:** `pending`
**Файлы:** `src/HomePanelV2.jsx`
**Тип:** ux
**Что изменено:**
- Header Desktop Home стал визуально солиднее: навигационные кнопки получили больше горизонтального padding, кликабельную область и расстояние между пунктами без заметного увеличения высоты шапки.
- Основная desktop-сетка выровнена в композицию `1fr | 1fr | fixed right rail`: колонки «Сегодня в АПГ / Популярные партнёры» и «Главная новость дня / Эксперты» теперь имеют одинаковую ширину, правая колонка `Мой профиль / Афиша / Рядом` сохраняет прежнюю компактную ширину.
- Внутренние сетки «Сегодня в АПГ» и «Главная новость дня» перераспределены под равные колонки, чтобы главные карточки оставались доминирующими, а второстепенные не выглядели тесными.
**Почему:** финальная балансировка Desktop Home перед завершением этапа: страница должна читаться как единая профессиональная сетка, а не как широкая центральная колонка рядом с узкой supporting-колонкой.

---

## [2026-07-12] ux: Desktop Home V6 final compact polish
**Коммит:** `pending`
**Файлы:** `src/HomePanelV2.jsx`
**Тип:** ux
**Что изменено:**
- Desktop Hero и карточка Локи уплотнены по высоте и внутренним отступам, чтобы первый экран показывал больше ключевой информации без ощущения длинной ленты.
- Блоки «Сегодня в АПГ», «Главная новость дня», «Афиша», партнёры, эксперты, «Рядом» и «Быстрый доступ» приведены к более компактному визуальному ритму.
- Локи оставлен только в Hero-зоне как основной контентный помощник; повторные блоки с рекомендациями ниже страницы не добавлялись.
**Почему:** финальная доводка пользовательской Desktop Home по утверждённому desktop-reference: максимум полезной информации на первом экране, без Workspace-остатков и визуальных повторов.

---

## [2026-07-12] ux: Desktop Home Final UI reference polish
**Коммит:** `pending`
**Файлы:** `src/HomePanelV2.jsx`, `src/UserApp.jsx`, `src/loki/LokiAssistant.jsx`
**Тип:** ux
**Что изменено:**
- Desktop Home перестроена ближе к утверждённому reference: Hero + Loki одной строкой, ниже компактная сетка «Сегодня в АПГ» / «Главная новость» / «Афиша», затем партнёры / эксперты / рядом и быстрый доступ.
- Убран отдельный блок «Локи рекомендует» и скрыты мобильные overlay-элементы в desktop user mode: TabBar и обучающий hint; floating Loki оставлен компактной нижней кнопкой.
- Исключены повторы hero-события в нижних блоках, карточки партнёров/экспертов/афиши уплотнены и адаптированы под partial data.
**Почему:** финальная reference-driven полировка пользовательской Desktop Home: страница должна ощущаться как современный городской сервис, а не Workspace/Dashboard или длинная лента.

---

## [2026-07-12] feat: Desktop Home V4
**Коммит:** `pending`
**Файлы:** `src/HomePanelV2.jsx`
**Тип:** feat
**Что изменено:**
- Переработан второй экран десктопной главной: убран блок highlight-карточек «Сегодня для вас», сетка новостей/рекомендаций/«Что рядом» в три колонки.
- Секция «Рекомендации Локи» заменена на «Что рядом» (категории поблизости, переход на карту); блоки Локи перенесены выше.
- Обновлены тексты: «Сегодня можно» → «Что важно сейчас» (mobile) / «Ваши рекомендации» (desktop), подзаголовок новостей.
**Почему:** итерация V4 главной для desktop-режима (правки из параллельной сессии, задеплоены по команде владельца).

---

## [2026-07-12] fix: главная показывала прошедшее мероприятие — единые правила актуальности событий
**Коммит:** `pending`
**Файлы:** `src/eventSchedule.js`, `src/HomePanelV2.jsx`, `src/EventsPage.jsx`, `src/UserApp.jsx`, `scripts/event-schedule-test.mjs`
**Тип:** fix
**Что изменено:**
- Причина: hero главной выбирался как «первое событие с картинкой» из сырого списка без фильтра прошедших/архивных (девичник 11 июля был published в базе, просто завершился); афиша же фильтрует прошедшие. Кэш/SW не при чём — данные один и тот же public-data.
- Новые единые правила в eventSchedule.js: isEventFinished (endAt + 2ч грейс, fallback на eventDate/deadline для легаси) и selectActualEvents (published, не архив, не удалено, не завершилось, сортировка «ближайшее первым»).
- HomePanelV2 фильтрует events через selectActualEvents в одной точке — hero, «Мероприятие дня», topEvents, счётчики, поиск и адаптивные блоки автоматически используют одну выборку; при отсутствии актуальных событий hero падает на партнёра/заглушку (пустое состояние уже было).
- Клик по hero-карточке открывает именно показанное событие (onOpenEvents(target) → initialEventTarget → сразу деталка), а не просто афишу.
- Афиша (EventsPage.isEventPast) переведена на общий isEventFinished — правила буквально совпадают. Завершившиеся события скрываются с главной автоматически, без ручной архивации.
**Почему:** главная и афиша расходились в правилах отбора; пользователь видел завершившееся событие и попадал по клику в другое.

---

## [2026-07-12] fix: расследование «пропавшего» нетворкинга + единая выборка списка событий + анти-дабл-сабмит
**Коммит:** `pending`
**Файлы:** `src/AdminPanel.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:**
- Расследование по adminActivity: регрессии кода НЕ было. «9-ый Большой Нетворкинг» txDZvGKexcC2omI1Wjdm был штатно удалён owner-аккаунтом 12.07 13:37:54Z (тестирование удаления), фильтр visibleEvents корректно его скрыл. Событие восстановлено через buildLifecyclePatch → published (цена сохранена), запись в adminActivity.
- Журнал также показал: событие изначально создано ДВАЖДЫ (двойной сабмит, 12:41:56 и 12:42:02) — добавлена защита: eSaving-блокировка кнопки + idempotencyKey на entity:create/update события; ошибки сохранения показываются alert-ом с реальной причиной.
- Счётчик в шапке вкладки «События» и список теперь считаются от одной выборки eventListRows (visibleEvents + фильтр «Непроверенные» + сортировка); при активном фильтре счётчик показывает «N из M».
- Проверено: public-data фильтрует events по тем же lifecycle-правилам — пользовательская афиша без регрессий.
**Почему:** сообщение о «пропавшем» мероприятии — событие оказалось реально удалено вручную; заодно закрыты первопричины (дубли при создании, расхождение счётчика и списка).

---

## [2026-07-12] fix: удаление событий в админке + универсальная кнопка «Отправить push»
**Коммит:** `pending`
**Файлы:** `src/AdminPanel.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:**
- Удаление события: причина бага — soft delete срабатывал (lifecycle `deleted`), но вкладка «События», календарь и дашборд рендерили ВСЕ документы events без фильтра статуса, поэтому событие «оставалось». Добавлен `visibleEvents` (скрывает deleted/trash), список обновляется мгновенно без fetchData; после удаления показывается undo-бар «Событие удалено» с восстановлением; ошибки показываются с реальной причиной (alert из lifecycleTransition).
- Кнопка «📲 Отправить push» рядом с «Сохранить» в редакторах событий и новостей (при редактировании существующей записи): независима от публикации, confirm перед отправкой, результат в PushReportModal (получатели/доставлено/ошибки/причины), повторная отправка не блокируется. Каждая отправка фиксируется сервером в `adminActivity` (push:broadcast: кто, когда, сколько) и `pushLogs`.
**Почему:** админ не мог удалить мероприятие (оно «возвращалось»), и не было способа повторить рассылку без пересоздания записи.

---

## [2026-07-12] feat: Центр событий — push при публикации, автосейв черновиков, стоимость мероприятий, занятость календаря
**Коммит:** `pending`
**Файлы:** `src/AdminPanel.jsx`, `src/EventsCalendar.jsx`, `src/EventsPage.jsx`, `src/EventDetailSheet.jsx`, `src/eventSchedule.js` (новый), `src/eventPrice.js` (новый), `src/adminFormDrafts.js` (новый), `server/src/routes/send-push.js`, `scripts/event-schedule-test.mjs` (новый), `package.json`
**Тип:** feat
**Что изменено:**
- Публикация нового события/новости теперь автоматически создаёт in-app уведомление и запускает push-broadcast; администратору показывается модал с результатом (доставлено/не доставлено/причины пропуска). Раньше push отправлялся ТОЛЬКО вручную из вкладки «Уведомления» — из-за этого рассылка по нетворкингу 22 июля не ушла.
- `/api/send-push` broadcast: подробная статистика причин недоставки (noConsent, vkProvider, categoryOptOut, audienceMismatch, noSubscription) + журнал рассылок в коллекции `pushLogs`.
- Автосохранение черновиков форм событий/новостей/партнёров/экспертов в localStorage (каждые 12с + debounce 2.5с + beforeunload/pagehide/visibilitychange), баннер восстановления при открытии, статус «Сохраняется…/Сохранено/Ошибка».
- Стоимость мероприятий: `priceType` (free/paid), `price`, `currency`, `priceIsFrom`; отображение «Бесплатно»/«500 ₽»/«от 700 ₽» во всех карточках; фильтр «Платные» в афише; `src/eventPrice.js` с legacy-fallback на pricePublic/priceClub.
- Календарь «Центра событий»: занятость считается по всему диапазону [startAt, endAt) с почасовыми слотами 9:00–22:00 (занято/частично/свободно) и списком свободных окон; раньше учитывался только час начала. Проверка пересечений при сохранении события с confirm-диалогом. Тест `npm run test:schedule` добавлен в `test:core`.
- Событие «9-ый Большой Нетворкинг» (22 июля): проставлено `priceType: paid`, `price: 2500`, `priceIsFrom: true` прямо в production Firestore (+ запись в adminActivity).
**Почему:** production-инцидент — push по опубликованному мероприятию не ушёл ни одному пользователю, админ потерял заполненную форму, календарь показывал свободными занятые часы.

---

## [2026-07-12] fix: PWA Email auth User Mode stability
**Коммит:** `pending`
**Файлы:** `src/UserApp.jsx`, `src/workspace/WorkspaceCore.js`, `public/sw.js`, `scripts/workspace-core-test.mjs`, `scripts/pwa-user-mode-regression.mjs`, `package.json`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:**
- Исправлена нормализация роли `super_admin` в Workspace Core, чтобы после Email-авторизации PWA User Mode не терял нижнюю навигацию.
- Bootstrap-кэш новостей, мероприятий, партнёров и уведомлений теперь очищается теми же lifecycle-фильтрами, что и свежие public-data, чтобы старые публикации не всплывали после входа.
- Добавлена PWA-диагностика для owner/super_admin и regression-test `test:pwa-user-mode`.
**Почему:** после Email login Identity Core мог вернуть роль `super_admin`, которую навигационное ядро не считало допустимой, а локальный кэш новостей читался без lifecycle-фильтрации.

---

## [2026-07-12] fix: Desktop Home V3 desktop search memo safety + Loki wiring
**Коммит:** `pending`
**Файлы:** `src/HomePanelV2.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:**
- Убрана побочная логика `setState` из `useMemo` в поиске десктопной версии `HomePanelV2` и вынесена ошибка поиска в отдельный `useEffect`.
- Доброшен `onOpenLoki` во все нужные ветки Desktop Home (первый и второй экраны, правый блок рекомендаций), убран разрыв функциональности при работе секции.
- Доработан fallback для поиска/ошибок и устойчивость получения результатов при пустом запросе.
**Почему:** поисковая логика не должна менять состояние внутри `useMemo`, это вызывало лишние перерисовки и нестабильное состояние ошибки; одновременно нужно было довести цепочку действий Локи до секций «Рекомендации».

---

## [2026-07-12] fix: Desktop Home V3 search list rendering
**Коммит:** `pending`
**Файлы:** `src/HomePanelV2.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:**
- Исправлен блок рендера результатов поиска на десктопной главной: убран некорректный тернарный результат и добавлен единый список карточек по типу контента.
- Добавлены понятный empty-state и корректные переходы при клике по партнёрам/экспертам/событиям/новостям.
**Почему:** прежний JSX-выражение ломал render для поиска и мог приводить к пустой выдаче или артефактам при активном поиске.

---

## [2026-07-12] ux: UX Convergence Dashboard
**Коммит:** `pending`
**Файлы:** `src/workspace/DesktopWorkspace.jsx`, `docs/desktop-ux.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** refactor
**Что изменено:**
- Dashboard перестроен вокруг сценария рабочего дня, а не равномерной сетки карточек.
- Добавлен рабочий hero-блок `Сегодня в АПГ` с ключевыми сигналами: уведомления, мероприятия, новости, рекомендации Локи и активный профиль.
- Ниже hero выстроена смысловая последовательность: требует внимания → сегодня → бизнес → статистика → контент → последние действия → быстрые действия.
**Почему:** User Mode ощущался более живым благодаря hero и повествованию, а Workspace — профессиональным, но карточным; convergence объединяет живость User Mode с архитектурой Workspace.

---

## [2026-07-12] ux: Desktop UX 1.1
**Коммит:** `pending`
**Файлы:** `src/components/Apg2ProfileGlass.jsx`, `src/workspace/DesktopWorkspace.jsx`, `src/workspace/WorkspaceWidgets.js`, `docs/desktop-ux.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** refactor
**Что изменено:**
- Desktop Workspace получил grouped sidebar, hover/focus-состояния, collapsed hover-preview, shortcut overlay по `?` и context menu по правому клику на свободной области.
- Dashboard дополнен виджетами `Сегодня` и `Требует внимания`, а горячие клавиши расширены до `⌘2` для Business Hub и `⌘3` для Content.
- В дизайн-токены APG2 добавлен общий `goldGradient`, чтобы active/gold-состояния в desktop UI не зависели от локальных хардкодов.
**Почему:** После Desktop UX 1.0 интерфейс стал шире и плотнее, но ему не хватало desktop-поведения: группировки, command hints, контекстных действий и цельных состояний навигации.

---

## [2026-07-12] ux: Desktop UX 1.0
**Коммит:** `pending`
**Файлы:** `src/UserApp.jsx`, `src/HomePanelV2.jsx`, `src/workspace/DesktopWorkspace.jsx`, `src/workspace/WorkspaceComponents.jsx`, `src/workspace/WorkspaceWidgets.js`, `docs/desktop-ux.md`, `docs/desktop-workspace.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** refactor
**Что изменено:**
- Desktop User Mode перестал быть мобильной колонкой на 480px: главная получила широкую desktop-сетку, hero + быстрые действия, grid-подборки, двухколоночные новости и мероприятия.
- В Workspace исправлено использование экранного `GlassPanel` как маленькой панели; header, sidebar, status bar и виджеты стали нормальными desktop-surfaces без `minHeight: 100svh`.
- Dashboard уплотнён и получил более профессиональную иерархию: 12-column widget grid, сегодняшняя сводка, статистика, бизнес-виджет и контекстный Локи в правой колонке.
**Почему:** Desktop Workspace должен восприниматься как законченный SaaS-интерфейс, а пользовательский режим на desktop — как самостоятельный широкий интерфейс, а не растянутая мобильная версия.

---

## [2026-07-12] feat: Business Hub 1.0
**Коммит:** `pending`
**Файлы:** `src/businessHub/BusinessHubCore.js`, `src/businessHub/BusinessHub.jsx`, `src/workspace/DesktopWorkspace.jsx`, `src/workspace/WorkspaceCore.js`, `scripts/business-hub-test.mjs`, `docs/business-hub.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:**
- Добавлен Business Hub как раздел «Мой бизнес» внутри Desktop Workspace с staged feature flag `off/owner/admin/partner/expert/all`.
- Hub использует существующие данные `ownedPartner`, `ownedExpert`, `news`, `events`, `notifications`, строит заполненность профиля, метрики, акции, отзывы, задачи и business-контекст для Локи без тяжёлых фоновых запросов.
- Существующие редакторы партнёра и эксперта подключены как инструменты внутри Hub, без создания отдельного классического кабинета.
**Почему:** Партнёрам и экспертам нужна единая workspace-среда управления бизнесом, которая развивается поверх Identity Core и Workspace Core без дублирования кабинетов.

---

## [2026-07-11] feat: Identity Core V1
**Коммит:** `pending`
**Файлы:** `server/src/lib/identityCore.js`, `server/src/routes/email-auth.js`, `server/src/routes/user-actions.js`, `server/src/lib/adminSecurity.js`, `server/src/routes/admin-login.js`, `server/src/routes/admin-actions.js`, `src/UserApp.jsx`, `src/ProfilePanel.jsx`, `src/workspace/WorkspaceFeatureFlags.js`, `scripts/identity-core-test.mjs`, `scripts/desktop-workspace-test.mjs`, `docs/identity-core.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:**
- Добавлен Identity Core: email/Firebase resolver выбирает canonical user, обновляет `emailIndex`, `identityLinks`, `canonicalUsers` и помечает legacy-документы без удаления.
- Email login, admin login, user-actions и admin security переведены на canonical identity; `UserApp` уточняет canonical user на старте, а Workspace больше не использует VK id `988504` как owner-доступ.
- В профиль добавлена «Диагностика Identity», показывающая canonical user, роли, кабинеты и найденные документы.
**Почему:** Один человек мог существовать как VK/email/Firebase/Telegram-документы одновременно, из-за чего owner определялся как partner и Workspace/кабинеты получали неверные роли.

---

## [2026-07-11] fix: Workspace owner diagnostics
**Коммит:** `pending`
**Файлы:** `src/UserApp.jsx`, `src/ProfilePanel.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:**
- В профиль owner/super_admin добавлена временная кнопка «Диагностика Workspace».
- Диагностика показывает feature flag, роль, роли Workspace, desktop detection, разрешение Workspace, текущий/сохранённый режим и причину блокировки.
- Добавлена кнопка «Сбросить режим Workspace», которая очищает сохранённый выбор и переводит режим в auto для немедленного повторного определения.
**Почему:** У owner на production Workspace мог не открываться из-за сохранённого ручного выбора `apg_app_mode=user`; теперь это видно без DevTools и сбрасывается из интерфейса.

---

## [2026-07-11] fix: Desktop Workspace owner activation
**Коммит:** `pending`
**Файлы:** `src/workspace/WorkspaceFeatureFlags.js`, `src/UserApp.jsx`, `scripts/desktop-workspace-test.mjs`, `docs/desktop-workspace.md`, `.ai/05_FRONTEND.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:**
- Исправлена активация Workspace: `super_admin` теперь считается владельческим уровнем при feature flag `owner`, а проектный owner-id `988504` синхронизирован с уже существующей privileged-логикой профиля.
- `UserApp` получил auto-mode: если `apg_app_mode` не выбран вручную и пользователь имеет доступ на desktop, открывается Workspace; явный выбор пользовательского режима сохраняется.
- Добавлен явный переключатель `📱 Пользовательский режим / 🖥 Workspace`, а desktop detection учитывает Mac/Windows/Linux/ChromeOS от 1024px без включения iPadOS-touch.
**Почему:** Production содержал Desktop Workspace, но владелец мог видеть обычную мобильную оболочку из-за default `appMode=user` и слишком узкой owner-проверки feature flag.

---

## [2026-07-11] feat: Desktop Workspace 1.0
**Коммит:** `pending`
**Файлы:** `src/workspace/DesktopWorkspace.jsx`, `src/workspace/WorkspaceFeatureFlags.js`, `src/workspace/WorkspaceWidgets.js`, `src/workspace/WorkspaceCore.js`, `src/workspace/index.js`, `src/UserApp.jsx`, `scripts/desktop-workspace-test.mjs`, `scripts/workspace-core-test.mjs`, `docs/desktop-workspace.md`, `docs/workspace-core.md`, `.ai/05_FRONTEND.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:**
- Добавлен Desktop Workspace 1.0 как вторая среда использования АПГ: header, collapsible left sidebar, content, right context panel, status bar и dashboard на реальных данных.
- Добавлен staged feature flag `off/owner/admin/partner/expert/all`; переключение `Пользовательский режим ↔ Workspace` работает внутри `UserApp` без повторной авторизации и перезагрузки.
- Добавлена архитектура workspace-виджетов и drag-ready layout, а плавающий Локи скрывается в Workspace и становится частью правой панели.
**Почему:** Партнёрам, экспертам и команде АПГ нужна профессиональная SaaS-среда, при этом пользовательский режим должен остаться простым городским приложением.

---

## [2026-07-11] feat: Workspace Core foundation
**Коммит:** `pending`
**Файлы:** `src/workspace/WorkspaceCore.js`, `src/workspace/WorkspaceComponents.jsx`, `src/workspace/index.js`, `src/UserApp.jsx`, `src/cabinet/CabinetCorePage.jsx`, `scripts/workspace-core-test.mjs`, `docs/workspace-core.md`, `.ai/05_FRONTEND.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:**
- Добавлен Workspace Core: единый Layout Engine с областями `header/leftSidebar/content/rightSidebar/bottomBar/floatingPanels`, режимами `mobile/tablet/desktop`, Navigation Engine, helper-кэшем, lazy-модулями и виртуализацией.
- Добавлен набор общих APG V2 workspace-компонентов: `WorkspaceShell`, `WorkspaceHeader`, `Sidebar`, `WorkspacePanel`, `WorkspaceContextPanel`, `GlassContainer`, `ContentGrid`, `DashboardCard`, `MetricCard`, `QuickActions`, `InfoPanel`, `SectionHeader`, `ActionCard`.
- `UserApp` теперь строит существующий нижний бар через общий navigation contract, а `CabinetCorePage` начал использовать общий `ContentGrid`.
**Почему:** Desktop Workspace, Cabinet Core, CRM, календарь, админка и Локи должны развиваться поверх одной layout-системы без отдельных mobile/desktop реализаций.

---

## [2026-07-11] feat: Content Lifecycle Engine V1
**Коммит:** `pending`
**Файлы:** `server-shared/content-lifecycle.js`, `src/contentLifecycle.js`, `server/src/routes/admin-actions.js`, `server/src/routes/public-data.js`, `src/AdminPanel.jsx`, `src/UserApp.jsx`, `src/loki/core/context/ContextEngine.js`, `src/loki/core/v2/Reasoner.js`, `scripts/content-lifecycle-test.mjs`, `docs/content-lifecycle.md`, `.ai/04_API.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:**
- Добавлен единый Content Lifecycle Engine со статусами `draft/moderation/scheduled/published/completed/archived/deleted/trash` и совместимостью со старыми полями `status/active/archived/deletedAt`.
- В `/api/admin-actions` добавлены actions `lifecycle:overview`, `lifecycle:transition`, `lifecycle:bulk-transition`; смена статуса пишет `lifecycleHistory`, audit log и историю новостей.
- В админку добавлен «Центр контента» с поиском, фильтрами статусов, массовыми действиями и рекомендациями автоархивации.
- Публичные данные и UserApp фильтруют архив/удалённые через общий lifecycle; прошедшие мероприятия получают отдельный статус `completed`, а Локи может искать по архиву при явном историческом запросе.
**Почему:** Архив и завершение контента должны быть частью единой архитектуры платформы, а не отдельной кнопкой для новостей.

---

## [2026-07-11] refactor: единая Fastify backend-архитектура
**Коммит:** `pending`
**Файлы:** `src/constants.js`, `server/src/server.js`, `server/deploy-cron.sh`, `server/src/routes/*`, `scripts/expert-questionnaire-v2-test.mjs`, `docs/backend-architecture.md`, `.ai/04_API.md`, `.ai/17_CHANGELOG_AI.md`, `api/*`, `vercel.json`, `ship.sh`
**Тип:** refactor
**Что изменено:**
- Удалён legacy слой Vercel Functions `api/*`, `vercel.json` и старый `ship.sh`; runtime backend теперь один — Fastify в Yandex Serverless Containers.
- Frontend больше не имеет пустого fallback на `/api` текущего домена: `API_BASE_URL` по умолчанию указывает на production Yandex Container и нормализует trailing slash.
- Cron перенесён в Yandex timer triggers через `server/deploy-cron.sh`; raffle/activity/expert-rotation вызывают Fastify endpoint.
- Добавлена `docs/backend-architecture.md` с картой маршрутов, cron, webhook, env и новой схемой деплоя.
**Почему:** Проект находился в промежуточном состоянии с двумя backend runtime и двумя системами деплоя; дальнейшие крупные функции должны строиться на единой архитектуре без ограничений Vercel Hobby.

---

## [2026-07-11] fix: контраст тарифов в анкетах ИИ-импорта
**Коммит:** `pending`
**Файлы:** `src/components/TariffOptionCard.jsx`, `src/components/ExpertQuestionnaire.jsx`, `src/components/PartnerQuestionnaire.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:**
- Выбор тарифа в анкетах партнёра и эксперта переведён на общий `TariffOptionCard`.
- Название, описание и преимущества тарифа теперь получают контрастные цвета из дизайн-токенов АПГ.
- Для карточек тарифов добавлены явные состояния hover, selected, active, disabled и focus.
**Почему:** Название выбранного тарифа наследовало белый цвет и плохо читалось на светлом фоне публичной анкеты.

---

## [2026-07-11] feat: тарифные анкеты ИИ-импорта
**Коммит:** `pending`
**Файлы:** `src/tariffConfig.js`, `src/components/ExpertQuestionnaire.jsx`, `src/components/PartnerQuestionnaire.jsx`, `src/PublicSubmitPage.jsx`, `src/AdminPanel.jsx`, `src/expertProfileForm.js`, `api/public-submit.js`, `server/src/routes/public-submit.js`, `scripts/expert-questionnaire-v2-test.mjs`, `.ai/04_API.md`, `.ai/24_EXPERT_QUESTIONNAIRE_V2.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:**
- Публичные анкеты партнёра и эксперта перестроены вокруг тарифов: бизнес `Старт/Альянс/Премиум`, эксперты `Практика/Амбассадор`.
- Добавлена отдельная анкета партнёра, обновлена анкета эксперта с тегами аудитории, автосохранением, индикатором заполненности и скрытием недоступных полей.
- Backend analyzer, AI-import template и draft-публикация синхронно нормализуют тарифы, не выдумывают данные и отбрасывают поля, недоступные выбранному тарифу.
**Почему:** Анкеты ИИ-импорта должны объяснять возможности тарифа и не показывать поля, которыми участник не сможет воспользоваться.

---

## [2026-07-10] refactor: единый renderer карточек для AI Editor
**Коммит:** `pending`
**Файлы:** `src/components/EntityPreviewCard.jsx`, `src/AdminPanel.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** refactor
**Что изменено:**
- Добавлен общий `EntityPreviewCard` для предпросмотра карточек партнёров, экспертов, мероприятий, новостей и призов в AI Editor.
- ИИ-импорт и черновики Локи-редактора больше не используют отдельные локальные JSX-шаблоны карточек; оба слоя подключены к единому renderer.
- Экспертная карточка в AI preview не выводит стоимость услуг и остаётся совместимой с утверждённой концепцией анкеты эксперта.
**Почему:** AI Editor не должен иметь параллельные шаблоны карточек, которые приходится обновлять отдельно после изменений боевого отображения.

---

## [2026-07-10] fix: архив решённых ошибок в админке
**Коммит:** `pending`
**Файлы:** `src/AdminPanel.jsx`, `api/admin-actions.js`, `server/src/routes/admin-actions.js`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:**
- Раздел `Ошибки` теперь по умолчанию показывает только активные записи, а перевод в статус `Решена` автоматически архивирует ошибку без физического удаления.
- Добавлены фильтры `Все / Активные / Решённые / Архив`, сводка состояния, счётчики активных/решённых/архивных/удалённых и безопасная кнопка удаления только архивных ошибок.
- Красные индикаторы и dashboard-сводка учитывают только активные ошибки; лимит загрузки errorLogs увеличен для корректной работы архива.
**Почему:** Решённые ошибки не должны портить текущую аналитику и создавать ощущение нестабильной системы, но история должна сохраняться для разбора инцидентов.

---

## [2026-07-10] feat: переработана анкета эксперта
**Коммит:** `pending`
**Файлы:** `src/expertProfileForm.js`, `src/ExpertCabinetPage.jsx`, `api/user-actions.js`, `server/src/routes/user-actions.js`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:**
- Анкета эксперта перепроектирована как секционная форма с ФИО, категориями, коротким и подробным описанием, форматами работы, тарифом, контактами, ссылками, соцсетями, видео, медиа и AI-подсказками.
- Добавлены индикатор заполнения, локальное автосохранение черновика и тарифные ограничения для новостей, мероприятий и реквизитов.
- Backend `expert:profileUpdate` расширен для сохранения новой структуры анкеты без отдельной параллельной системы.
**Почему:** Экспертам нужна удобная, масштабируемая анкета, готовая к тарифам, медиа, будущему каталогу услуг и онлайн-записи.

---

## [2026-07-10] docs: APG Manifest и Operating System
**Коммит:** `pending`
**Файлы:** `.ai/00_APG_MANIFEST.md`, `.ai/01_APG_OPERATING_SYSTEM.md`, `.ai/03_KNOWLEDGE_NAVIGATOR.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** docs
**Что изменено:**
- Добавлены утверждённые документы `APG Manifest` и `APG Operating System`.
- Knowledge Navigator обновлён: перед любой задачей сначала читаются Manifest и Operating System.
**Почему:** Будущие AI-инженеры должны начинать работу с смысла, принципов и операционной логики АПГ, а уже затем переходить к технической архитектуре.

---

## [2026-07-10] feat: APG Learning System
**Коммит:** `pending`
**Файлы:** `src/learningSystem.js`, `src/Onboarding.jsx`, `src/tasks.js`, `src/TasksPage.jsx`, `src/ReferencePage.jsx`, `src/LokiPage.jsx`, `src/UserApp.jsx`, `src/ProfilePanel.jsx`, `src/loki/core/LokiCore.js`, `api/user-actions.js`, `server/src/routes/user-actions.js`, `api/news-comments.js`, `server/src/routes/news-comments.js`, `.ai/00_PROJECT_STATE.md`, `.ai/18_ARCHITECTURE_MAP.md`, `.ai/19_DEPENDENCY_MAP.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:**
- Создан APG Learning System: 7 экранов первого запуска, учебные задания, одноразовые контекстные подсказки и центр знаний для пользователей, партнёров и экспертов.
- Учебные задания подключены к существующей системе `TasksPage`/`task:claim`, а прогресс действий сохраняется в профиле пользователя.
- Локи получил сценарий «Объяснить этот экран» на основе текущего `activePanel`.
**Почему:** Пользователь должен быстро понимать возможности АПГ через действия, контекст и Локи, а не через отдельный FAQ.

---

## [2026-07-10] feat: APG Economy 1.0
**Коммит:** `pending`
**Файлы:** `server-shared/economy-engine.js`, `src/economyEngine.js`, `src/UserApp.jsx`, `src/RewardsPage.jsx`, `src/AdminPanel.jsx`, `api/user-actions.js`, `server/src/routes/user-actions.js`, `api/admin-actions.js`, `server/src/routes/admin-actions.js`, `api/news-engagement.js`, `server/src/routes/news-engagement.js`, `api/news-comments.js`, `server/src/routes/news-comments.js`, `server-shared/reward-service.js`, `.ai/00_PROJECT_STATE.md`, `.ai/18_ARCHITECTURE_MAP.md`, `.ai/19_DEPENDENCY_MAP.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:**
- Создана отдельная подсистема APG Economy 1.0 с централизованными весами начислений ключей и репутации.
- Добавлены билеты как отдельный баланс, обмен ключей на билеты и участие в розыгрышах только билетами.
- Магазин наград переведён в магазин возможностей, добавлены репутационные статусы, season-ready конфигурация и backend-аналитика экономики.
**Почему:** Ключи должны быть не целью, а способом открывать возможности; экономика должна мотивировать реальные действия пользователя и управляться через единый Economy Engine.

---

## [2026-07-10] feat: AI Profile Layer для партнёров и экспертов
**Коммит:** `pending`
**Файлы:** `src/aiProfile.js`, `src/PartnerCabinetPage.jsx`, `src/ExpertCabinetPage.jsx`, `src/loki/core/context/ContextEngine.js`, `src/loki/core/brain/BrainLayer.js`, `src/loki/core/modules/PartnerExpert.js`, `api/user-actions.js`, `server/src/routes/user-actions.js`, `api/admin-actions.js`, `server/src/routes/admin-actions.js`, `.ai/00_PROJECT_STATE.md`, `.ai/18_ARCHITECTURE_MAP.md`, `.ai/19_DEPENDENCY_MAP.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:**
- Создан `src/aiProfile.js` для нормализации, черновой генерации и search text AI-профилей партнёров/экспертов.
- Кабинеты партнёра и эксперта получили вкладку `AI Profile` с просмотром, редактированием и отправкой на обновление через существующий `/api/user-actions`.
- Context Engine и Brain Layer Локи используют `aiProfile`, а admin-actions получил `ai-profile:generate` для создания черновика без новых коллекций.
**Почему:** Локи должен понимать карточки через единый AI Profile Layer, а не читать разрозненные поля партнёров и экспертов напрямую.

---

## [2026-07-10] feat: APG Life Graph
**Коммит:** `pending`
**Файлы:** `src/lifeGraph.js`, `src/loki/core/context/ContextEngine.js`, `.ai/00_PROJECT_STATE.md`, `.ai/17_CHANGELOG_AI.md`, `.ai/18_ARCHITECTURE_MAP.md`, `.ai/19_DEPENDENCY_MAP.md`
**Тип:** feat
**Что изменено:**
- Создан APG Life Graph Service для универсальной metadata-нормализации всех ключевых объектов АПГ.
- Добавлены методы поиска связанных объектов, похожих объектов и graph-рекомендаций.
- Context Engine Локи получает `lifeGraph` и graph-рекомендации без изменения UI и бизнес-логики.
**Почему:** Локи и будущие AI-модули должны использовать единый слой связей между объектами АПГ, а не строить отдельные механики рекомендаций в каждом экране.

---

## [2026-07-10] feat: Adaptive APG personalization
**Коммит:** `pending`
**Файлы:** `src/interestEngine.js`, `src/UserApp.jsx`, `src/HomePanelV2.jsx`, `src/EventsPage.jsx`, `src/ExpertsPage.jsx`, `src/loki/LokiRecommendationCenter.js`, `src/loki/core/context/ContextEngine.js`, `api/user-actions.js`, `server/src/routes/user-actions.js`, `.ai/00_PROJECT_STATE.md`, `.ai/17_CHANGELOG_AI.md`, `.ai/18_ARCHITECTURE_MAP.md`, `.ai/19_DEPENDENCY_MAP.md`
**Тип:** feat
**Что изменено:**
- Создан общий Interest Engine для автоматического определения интересов пользователя по действиям.
- Главная страница получает Adaptive Feed: существующие карточки и блоки используют персонально отсортированные данные без изменения дизайна.
- Локи получает тот же Interest Profile через Context Engine и использует его в recommendation feed.
**Почему:** АПГ должен постепенно становиться персональным для каждого пользователя без ручного выбора интересов и без новой параллельной архитектуры.

---

## [2026-07-10] feat: APG Partner AI в кабинете партнёра
**Коммит:** `pending`
**Файлы:** `src/PartnerCabinetPage.jsx`, `api/user-actions.js`, `server/src/routes/user-actions.js`, `.ai/00_PROJECT_STATE.md`, `.ai/17_CHANGELOG_AI.md`, `.ai/18_ARCHITECTURE_MAP.md`, `.ai/19_DEPENDENCY_MAP.md`
**Тип:** feat
**Что изменено:**
- Добавлена вкладка `AI-помощник` в кабинет партнёра.
- Помощник анализирует свободный текст и предлагает создать черновики события, новости, акции, push, афиши, задания или ключей.
- Добавлен backend action `partner:aiDraft`, который создаёт только `pending_review` drafts в существующих коллекциях: `events`, `news`, `notifications`, `aiDrafts`, `customTasks`.
**Почему:** Партнёр должен быстро превращать идею в набор материалов для АПГ, но публикация и модерация остаются за системой/администрацией.

---

## [2026-07-10] feat: APG Context Engine для Локи
**Коммит:** `pending`
**Файлы:** `src/loki/core/context/ContextEngine.js`, `src/loki/LokiProvider.jsx`, `src/loki/core/LokiCore.js`, `.ai/00_PROJECT_STATE.md`, `.ai/17_CHANGELOG_AI.md`, `.ai/18_ARCHITECTURE_MAP.md`, `.ai/19_DEPENDENCY_MAP.md`, `.ai/21_LOKI_CORE.md`
**Тип:** feat
**Что изменено:**
- Создан `buildLokiContext()` — единый слой сбора состояния АПГ для Локи.
- `LokiProvider` передаёт в ядро Локи Context Engine object вместо разрозненного чтения `appState`.
- `LokiCore` поддерживает новый контекст и сохраняет совместимость со старыми модулями через `context.appState`.
**Почему:** Локи и будущие AI-модули должны получать состояние приложения через один стабильный интерфейс, без прямого чтения данных из разных частей приложения.

---

## [2026-07-10] feat: Loki Home AI Dashboard
**Коммит:** `pending`
**Файлы:** `src/LokiPage.jsx`, `src/loki/LokiProvider.jsx`, `.ai/00_PROJECT_STATE.md`, `.ai/17_CHANGELOG_AI.md`, `.ai/18_ARCHITECTURE_MAP.md`, `.ai/21_LOKI_CORE.md`
**Тип:** feat
**Что изменено:**
- Стартовый экран Локи переработан из chat-first интерфейса в персональный AI Dashboard.
- Добавлены блоки: приветствие, сводка дня, «Сегодня для тебя», быстрые сценарии-карточки, план дня, прогресс, главная новость дня и большое поле задачи.
- `LokiProvider` теперь отдаёт `dashboard` на основе уже загруженных событий, новостей, заданий, партнёров, ключей и recommendation feed.
**Почему:** Локи должен быть интеллектуальной домашней страницей и помогать пользователю принимать решения внутри АПГ, а не выглядеть как обычный мессенджер.

---

## [2026-07-10] fix: уточнены системные действия Brain Layer
**Коммит:** `pending`
**Файлы:** `src/loki/core/brain/BrainLayer.js`
**Тип:** fix
**Что изменено:**
- Системные APG-сценарии больше не выбирают случайное событие или партнёра как основной объект.
- Запросы про ключи открывают профиль, QR-запросы открывают сканер, уведомления открывают уведомления.
**Почему:** Локи должен вести пользователя к правильному действию по смыслу запроса, а не к первому подходящему объекту из загруженных данных.

---

## [2026-07-10] feat: Локи переведён на Brain Layer и сценарную AI Platform
**Коммит:** `pending`
**Файлы:** `src/loki/core/brain/BrainLayer.js`, `src/loki/core/brain/lokiScenarios.js`, `src/loki/core/LokiCore.js`, `src/loki/core/modules/MemoryEngine.js`, `src/loki/core/modules/PersonalityEngine.js`, `src/loki/lokiActionTypes.js`, `src/UserApp.jsx`, `.ai/00_PROJECT_STATE.md`, `.ai/18_ARCHITECTURE_MAP.md`, `.ai/19_DEPENDENCY_MAP.md`, `.ai/21_LOKI_CORE.md`
**Тип:** feat
**Что изменено:**
- Добавлен Brain Layer для определения сценария, контекста, выбора лучшего варианта и генерации action-плана.
- Создана сценарная база из 50+ сценариев по городским, событийным, партнёрским, экспертным, семейным, бизнес- и APG-задачам.
- Добавлены действия Локи для добавления партнёра в избранное и начала регистрации на событие через существующую навигацию.
**Почему:** Локи должен работать как интеллектуальное ядро АПГ, помогая принимать решение внутри контекста приложения, а не отвечать списком или уводить пользователя в отдельный чат.

---

## [2026-07-10] fix: убран двойной paddingBottom под навигацией (все GlassPanel-страницы)
**Коммит:** `47b94b09`
**Файлы:** `src/UserApp.jsx`
**Тип:** fix
**Что изменено:**
- Удалён `paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))'` из wrapper-div в UserApp (линия 2597).
**Почему:** UserApp-обёртка и компонент `GlassPanel` (`Apg2ProfileGlass.jsx`) оба добавляли 96px + safe-area-inset-bottom. На iPhone (safe-area ≈ 34px) это давало 260px пустого места под контентом. Все страницы управляют своим нижним отступом сами (через GlassPanel, собственный paddingBottom или self-scroll контейнер). Обёртка была лишней.
**Страницы, которые затронуло:** ProfilePanel, LokiPage, EventsPage, TasksPage, LeaderboardPage, OffersPage, ActivityPage, ReferralPage, RewardsPage, ExpertCabinetPage, PartnerCabinetPage, ApgHealthPage, MapPage, NearbyPage, NotificationsPage, ReferencePage.
**Статус деплоя:** Frontend ✓ задеплоен (version: 47b94b09).

---

## [2026-07-10] fix: Локи открывается поверх статьи (stacking context + portal)
**Коммит:** `757ab610`
**Файлы:** `src/loki/LokiAssistant.jsx`, `src/loki/LokiExperience.jsx`
**Тип:** fix
**Что изменено:**
- `LokiAssistant`: `LokiExperience` теперь рендерится через `createPortal(…, document.body)` — выходит из stacking context UserApp wrapper.
- `LokiExperience`: z-index поднят 13000 → 14000 (выше ArticleView z=13000).
**Почему:** UserApp wrapper div создаёт stacking context (position:relative, zIndex:1). LokiExperience внутри него имел эффективный вес z=1 в body, а ArticleView — portal z=13000 в body. Loki всегда был под статьёй.
**Статус деплоя:** Frontend ✓ задеплоен (version: 757ab610).

---

## [2026-07-10] feat: полный редизайн экрана статьи новости
**Коммит:** `2dcd1576`
**Файлы:** `src/NewsPage.jsx`, `src/UserApp.jsx`
**Тип:** feat
**Что изменено:**
- Новый тёплый редакционный фон `#1A1812` — убрано ощущение «тёмной модалки», фон светлее и теплее.
- Новый компонент `SourceBadge`: маленький бейдж «Источник: ВКонтакте» под изображением для импортированных новостей.
- Новый компонент `LokiArticleBanner`: для статей >260 слов показывает Локи-предложение кратко пересказать; кнопка открывает Локи через `onOpenLoki`.
- `ArticleHeader` упрощён: заголовок → 1 строка мета (дата · время · время чтения) → lede-абзац. Убрана тяжёлая сетка из 8 статистических плиток.
- Тело статьи: без контейнера-карточки, 17px / 30px lineHeight, текст дышит на фоне страницы.
- Порядок элементов переработан: source → title → lede → Loki → body → media → actions → feedback → comments → «Читайте также» (4 шт.) → prev/next → VK-ссылка.
- Кнопка «Открыть оригинал в ВКонтакте» переехала в самый конец как маленькая текстовая ссылка.
- «Читайте также» вместо «Локи рекомендует», 4 материала.
- Nav-бар: тёплый `rgba(26,24,18,0.86)` вместо холодного чёрного.
- Hero-изображение: full-width без скруглений (editorial feel).
- Все взаимодействия (лайки, комментарии, реакции, сохранение) работают одинаково для всех источников.
- `UserApp.jsx`: добавлен `onOpenLoki={() => goPanel('loki')}` в NewsPage.
**Почему:** Новости из ВКонтакте воспринимались как «встроенная страница ВК». После редизайна любая новость становится полноценным материалом АПГ.
**Статус деплоя:** Frontend ✓ задеплоен (version: 2dcd1576).

---

## [2026-07-10] fix: читаемость статьи новости и перекрытие кнопки ВК
**Коммит:** `2befb3df`
**Файлы:** `src/NewsPage.jsx`
**Тип:** fix
**Что изменено:**
- Замена GlassCard-контейнера тела статьи на тёмный `div` (`rgba(10,10,12,0.70)`) — контраст текста с ~2.94:1 до ~12:1 (WCAG AAA).
- Весь текст статьи (`body`, `summary`, блоки `note/quote`) переключён с `textSoft` на `APG2_PROFILE.text` (полная непрозрачность).
- Фон блоков `note/quote` снижен до `rgba(255,255,255,0.04)`, граница до `rgba(255,255,255,0.10)` — убран эффект серого на сером.
- `ArticleView` вынесен в `createPortal(…, document.body)` — выходит из stacking context UserApp (zIndex:1), теперь z=13000 корректно перекрывает tab bar (z=10000). Кнопка «Открыть оригинал в ВКонтакте» больше не закрывается нижней навигацией.
**Почему:** Нечитаемый текст (серое на сером) и кнопка ВК, недостижимая из-за фиксированного таб-бара поверх неё.
**Статус деплоя:** Frontend ✓ задеплоен (version: f016f0c3).

---

## [2026-07-10] feat: Центр событий — новый раздел AdminPanel с месячным календарём и списком
**Коммит:** `62d22a66`
**Файлы:** `src/EventsCalendar.jsx` (новый), `src/AdminPanel.jsx`
**Тип:** feat
**Что изменено:**
- Новый компонент `EventsCalendar` — главная рабочая область Центра событий.
- Два режима: «Месяц» (сетка с цветными дот-маркерами по категориям) и «Список» (группировка по датам, поиск, фильтры Все/Предстоящие/Прошедшие/Без даты).
- Клик на день в календаре → список событий дня, клик на событие → открывает существующую форму редактирования.
- Модалка формы события вынесена из `activeTab === 'events'` и рендерится для обоих табов: `'events'` и `'events-center'`.
- Статистика: Всего событий / Сегодня / На этой неделе / Дней с событиями.
- Старый раздел «События» полностью сохранён без изменений.
**Почему:** Первый этап системы управления событиями. Даёт визуальный обзор расписания, базовую навигацию и расширяемую архитектуру для следующих этапов (неделя, день, аналитика).
**Статус деплоя:** Frontend ✓ задеплоен (version: 3b814c44).

---

## [2026-07-10] fix: E1-E5 — отзывы эксперта, toast-уведомления, убраны alert()
**Коммит:** `26b03430`
**Файлы:** `src/ExpertCabinetPage.jsx`, `src/PartnerCabinetPage.jsx`, `src/UserApp.jsx`
**Тип:** fix
**Что изменено:**
- E1: ExpertCabinetPage читал отзывы из неправильной подколлекции `experts/{id}/reviews`. Исправлено на правильный путь: `expertReviews` (where expertId == id) — теперь эксперт видит реальные отзывы.
- E2: handlePrizeClaim теперь показывает toast при ошибке (auth error / server error) вместо молчалого отката ключей.
- E3: handleRaffleEnter теперь показывает toast при ошибке (auth error / server error) вместо молчалого отката ключей.
- E4: handleEventRegister теперь показывает toast при ошибке как в ветке регистрации, так и в ветке отмены.
- E5: Все alert() в PartnerCabinetPage и ExpertCabinetPage заменены на onToast (передаётся из UserApp.jsx как showToast).
**Почему:** Эксперты не видели ни одного отзыва клиентов (данные хранились не там, где читались). Пользователи не получали обратной связи при ошибках транзакций. alert() блокирует UI и некорректно работает в VK Mini App.
**Статус деплоя:** Frontend ✓ задеплоен (version: 26b03430).

---

## [2026-07-10] fix: security — Firestore rules + Telegram auth consistency (P6, P1)
**Коммит:** `dfcfd8de`
**Файлы:** `firestore.rules`, `api/verify-telegram.js`, `server/src/routes/verify-telegram.js`
**Тип:** fix
**Что изменено:**
- P6: Firestore Rules — заблокированы прямые клиентские записи (allow write: if false) на 15 коллекциях: partners, experts, events, news, prizes, notifications, customTasks, reviews, expertReviews, partners/{id}/reviews, stats, scans, prizeClaims, raffleEntries, guestSessions, errorLogs, telegramAuthSessions. Добавлено правило lokiKnowledge (allow read: if true; allow write: if false). Правила задеплоены в Firebase.
- P1: verify-telegram.js (оба варианта) — добавлена проверка tgLinks/{tg_id} перед созданием custom token, аналогично telegram-auth-check.js. Устранён сценарий дублирования аккаунтов при входе через Login Widget.
**Почему:** любой анонимный Firebase-пользователь мог напрямую писать в контент-коллекции через Firestore SDK; два потока Telegram давали разный результат для пользователя с привязанным email.
**Статус деплоя:** Firestore Rules ✓ задеплоены. verify-telegram.js ✓ задеплоен на Vercel (но Vercel не используется в prod). Fastify (Yandex Cloud) — временная ошибка инфраструктуры YC при деплое контейнера; код зафиксирован в git, нужно повторить деплой позже.

---

## [2026-07-10] fix: аудит надёжности авторизации — 6 исправлений (C1–C4, P3, P5)
**Коммит:** `0d2b306a`
**Файлы:** `src/UserApp.jsx`, `src/userApi.js`
**Тип:** fix
**Что изменено:**
- C1: `toggleFavorite` — ловит ошибки, вызывает `logError`, показывает тост «Требуется повторный вход» (401/403) или «Не удалось обновить избранное».
- C2: ежедневный бонус — `setUserKeys(+1)` и тост только после подтверждения от backend (`.then()`), не оптимистично.
- C3: `userApi.js` — `error.isAuthError = true` при статусах 401/403 для всех `userAction`-вызовов.
- C4: полностью удалены `haptic` useCallback, `lastHapticAtRef` и все 9 мест вызова (нарушение правила CLAUDE.md).
- P3: таймаут `ensureOwnerAuthSession` увеличен с 2400 до 5000 мс.
- P5: `handleConsentAccept` — при `STRONG_IDENTITY_REQUIRED` очищает localStorage, делает `signOut`, показывает кнопку «Выйти и войти заново» через `consentReloginNeeded` (без reload).
**Почему:** аудит выявил несколько точек отказа аутентификации: тихое поглощение ошибок, оптимистичное обновление ключей без подтверждения backend, отсутствие флага `isAuthError` для централизованной обработки 401/403.

---

## [2026-07-09] fix: «Ошибка при сохранении» при получении наград — тихий 403 из-за несоответствия Firebase UID
**Коммит:** `bb82a555`
**Файлы:** `src/UserApp.jsx`
**Тип:** fix
**Что изменено:** Обнаружен корень проблемы: при открытии приложения email-пользователем без Firebase-сессии в IndexedDB (новый браузер, сброс хранилища) `ensureOwnerAuthSession` бросал `STRONG_IDENTITY_REQUIRED`, но ошибка поглощалась. `auth.currentUser` оставался анонимным → backend отклонял `task:claim` с 403. Теперь при `STRONG_IDENTITY_REQUIRED` очищаем `apg_email_user`/`apg_tg_user` из localStorage, делаем `signOut` и `reload` — пользователь попадает в гостевой режим и переходит к email-логину. В `handleClaim` добавлено `console.error` с деталями (taskId, userId, authUid, isAnon, code, status) и отдельный текст тоста для 401/403.
**Почему:** `STRONG_IDENTITY_REQUIRED` молча проглатывался → сессия оставалась анонимной → все write-действия через backend падали с 403 «Нельзя менять данные другого пользователя».

---

## [2026-07-09] fix: восстановление сценария согласий и уведомлений
**Коммит:** `5546cfd8`
**Файлы:** `src/UserApp.jsx`, `src/ProfilePanel.jsx`, `src/AdminPanel.jsx`
**Тип:** fix
**Что изменено:** CONSENT_SCREEN_DISABLED_FOR_DEMO=false — экран согласий включён для всех. Новые email-пользователи: ConsentScreen → push-разрешение. Старые без согласий: экран при следующем входе. ProfilePanel: карточка «Уведомления отключены» с кнопкой; при blocked — инструкция. Убрана красная ошибка «Разрешение не получено». AdminPanel→Пользователи: статистика согласий + фильтры + бейджи.
**Почему:** CONSENT_SCREEN_DISABLED_FOR_DEMO был оставлен true после демо-сессии.

---

## [2026-07-09] fix: экран Активности — race condition auth + permission-denied как empty state
**Коммит:** `36865a25`
**Файлы:** `src/UserApp.jsx`, `src/ActivityPage.jsx`
**Тип:** fix
**Что изменено:** 1) `UserApp.jsx`: заменена синхронная проверка `auth.currentUser` на `onAuthStateChanged`-based инициализацию — теперь Firebase сессия восстанавливается из IndexedDB до решения о `signInAnonymously`, что исправляет уничтожение кастомной сессии email-пользователей. 2) `ActivityPage.jsx`: ошибка `permission-denied` от Firestore обрабатывается как пустое состояние (не как сетевая ошибка); текст ошибки убран "Проверьте соединение" и заменён корректным.
**Почему:** Email-пользователи (`daria_samarina@mail.ru`) видели "Ошибка загрузки / Проверьте соединение" вместо пустой истории — из-за race condition в инициализации Firebase Auth.

---

## [2026-07-09] feat: замена шаблона плаката на макет 3 (единственный)
**Коммит:** `a0996ff0`
**Файлы:** `src/PartnerQRSection.jsx`, `public/qr-poster-template-v3.jpg` (удалены: `.jpg`, `-2.jpg`, `-2-v2.jpg`)
**Тип:** feat
**Что изменено:** Убран массив `POSTER_TEMPLATES` и весь UI выбора шаблона. Константа `POSTER_TEMPLATE_URL = '/qr-poster-template-v3.jpg'`. Функция `buildPoster` упрощена (2 аргумента). Убраны: стейт `posterTemplateId`, кнопки «Макет 1/2». Три старых файла удалены из public/ и S3. Python-проверка: threshold=0.97, sq=0.97, центр=(543,932), QR size=290px.
**Почему:** Пользователь хотел один шаблон вместо системы выбора.

---

## [2026-07-09] fix: cache-bust шаблона плаката №2 (переименование в v2)
**Коммит:** `085c6cab`
**Файлы:** `src/PartnerQRSection.jsx`, `public/qr-poster-template-2-v2.jpg`
**Тип:** fix
**Что изменено:** Файл переименован `qr-poster-template-2.jpg` → `qr-poster-template-2-v2.jpg`. URL в `POSTER_TEMPLATES[1]` обновлён. Оба файла присутствуют в dist и S3.
**Почему:** Yandex CDN закэшировал 404 для `/qr-poster-template-2.jpg` (файл не существовал до деплоя), что вызывало `tmpl.onerror` → тёмный APG-постер («старый макет»). Новый URL `/qr-poster-template-2-v2.jpg` гарантированно нет в CDN-кэше.

---

## [2026-07-09] feat: шаблон плаката №2 + squareness-based детекция QR
**Коммит:** `3454a966`
**Файлы:** `src/PartnerQRSection.jsx`, `public/qr-poster-template-2.jpg`
**Тип:** feat
**Что изменено:** Добавлен второй шаблон плаката (`qr-poster-template-2.jpg`, макет 2). `POSTER_TEMPLATE_URL` заменён на массив `POSTER_TEMPLATES`. `buildPoster()` принимает `templateUrl`. Новый алгоритм выбора кластера в `detectWhiteRegion`: `score = sq²×cells` (квадратность в квадрате × число ячеек) — QR-поле (sq≈0.88) всегда побеждает широкие фоновые области (sq≈0.44), даже если они больше по числу ячеек. UI: переключатель «Макет 1 / Макет 2» в табе плаката; смена шаблона сбрасывает postURL. Имя PNG-файла при скачивании: `poster-{id}-m{1|2}.png`.
**Почему:** Светлый фон макета 2 создавал большой горизонтальный кластер (cols 0-25, rows 0-7), который выигрывал по размеру у реального QR-поля (cols 11-20, rows 16-23). Квадратностный скоринг надёжно работает для обоих макетов и для любых будущих шаблонов.

---

## [2026-07-09] feat: новый шаблон плаката А5 + умная детекция белой области QR
**Коммит:** `2e5222ad`
**Файлы:** `src/PartnerQRSection.jsx`, `public/qr-poster-template.jpg` (удалён `qr-poster-template.png`)
**Тип:** feat
**Что изменено:** Шаблон `qr-poster-template.png` (тёмный фон) заменён на `qr-poster-template.jpg` (светлый дизайн А5, `макет1.jpg` с рабочего стола). `detectWhiteRegion` переработан: вместо bounding-box всех «белых» клеток — BFS connected-components с порогом 97% (находит наибольший связный кластер чисто-белых клеток). QR масштаб: 80% от меньшей стороны области (10% отступ с каждой стороны). Кэш сбрасывается автоматически: смена расширения `.png`→`.jpg` = новый URL.
**Почему:** Старый алгоритм bounding-box работал только на тёмном фоне. На светлом шаблоне весь постер определялся как «белый», центр смещался в середину изображения. Connected-components с высоким порогом точно находит белое поле для QR (верифицировано Python-анализом: `grid(11-21, 16-22)`, центр `543×909` из `1054×1492`).

---

## [2026-07-09] fix: восстановление сессии администратора после перезагрузки
**Коммит:** `22c61acc`
**Файлы:** `src/AdminPanel.jsx`
**Тип:** fix
**Что изменено:** В `init()` useEffect после `waitForAdminAuth` добавлен вызов `adminSecurityRequest('status')`. Если Firebase Auth имеет валидного пользователя с ролью администратора и `mustChangePassword = false`, автоматически вызывается `setAdminSession(actor)` и `setAuthed(true)` без необходимости повторного входа. Пользователи с `mustChangePassword = true` по-прежнему попадают на форму входа.
**Почему:** `authed = useState(false)` сбрасывается при каждой перезагрузке. Firebase Auth token хранится в IndexedDB и сохраняется, но `setAuthed(true)` вызывался только в `AdminLoginGate.onAllow` — поэтому каждая перезагрузка требовала повторной авторизации.

---

## [2026-07-09] Loki UX — финальная полировка, блокировка всех авто-триггеров в on_demand
**Коммит:** `dc91545f`
**Файлы:** `src/loki/LokiProvider.jsx`
**Тип:** fix
**Что изменено:** Добавлен mode-фильтр внутри showMessage (единственная точка входа для всех событий через lokiBus). В режиме on_demand разрешены только CHARACTER_TAP, BRAIN_RESPONSE, APP_ERROR, USER_LOGIN, KEY_RECEIVED, ACHIEVEMENT_UNLOCKED. Заблокированы все навигационные триггеры (PARTNER_OPENED, EVENT_OPENED, PRIZE_OPENED, PROFILE_OPENED, REFERENCE_OPENED, MAP_OPENED, VK_ENTRY, VK_EXTERNAL_LINK). Добавлен settings в deps useCallback для корректной реакции на смену режима.
**Почему:** Предыдущие фикс (эффекты в LokiProvider) не перекрывал showLokiMessage-вызовы из UserApp.goPanel и VK entry — они проходили через lokiBus минуя mode-проверку.

---

## [2026-07-09] Loki UX — система режимов помощника, «Только по запросу» по умолчанию
**Коммит:** `c8362e23`
**Файлы:** `src/loki/lokiState.js`, `src/loki/LokiProvider.jsx`, `src/LokiPage.jsx`
**Тип:** feat
**Что изменено:** Добавлен LOKI_MODES enum (on_demand/minimal/standard/active) и поле mode в DEFAULT_LOKI_SETTINGS. В LokiProvider RETURN_VISIT активируется только для standard/active; USER_IDLE пропускается для on_demand, задержка 90с для minimal; Observer пропускается для on_demand, только HIGH-приоритет для minimal. Убран авто-триггер daily_visit на LokiPage. Добавлен селектор режима в нижней части LokiPage с 4 кнопками.
**Почему:** пользователи жаловались на навязчивость Локи — попапы при каждом переходе между разделами. Новая философия: Локи молчит пока пользователь не спросит.

---

## [2026-07-09] Glass readability pass — увеличение непрозрачности glass-карточек
**Коммит:** pending
**Файлы:** `src/index.css`, `src/design.js`, `src/HomePanelV2.jsx`, `src/components/Apg2ProfileGlass.jsx`, `src/NewsPage.jsx`, `src/ExpertCabinetPage.jsx`, `src/PartnerCabinetPage.jsx`
**Тип:** fix
**Что изменено:** белый overlay в glass-карточках поднят с 0.05-0.15 до 0.20-0.46. Изменены токены GLASS/GLASS_STRONG в design.js, V2.glass/glowGlass в HomePanelV2, APG2_PROFILE.glass в Apg2ProfileGlass, CSS-переменные --c-surface и --apg2-glass-border в dark-теме index.css, inline-стили в NewsPage/ExpertCabinetPage/PartnerCabinetPage.
**Почему:** текст на карточках плохо читался из-за чрезмерно тёмного glass overlay; backdrop-filter и border оставлены без изменений.

---

## [2026-07-09] Premium UI Pass — унификация токенов APG2/V2 по всему приложению
**Коммит:** `eab89de9`
**Файлы:** `src/EventsPage.jsx`, `src/RewardsPage.jsx`, `src/HomePanelV2.jsx`
**Тип:** refactor
**Что изменено:**
- EventsPage: исправлен scroll-lock (убран `position:fixed; top:-scrollY` → `overflow:hidden` только); EventModal переведён с `T.*` → `APG2_PROFILE.*` (текст, иконки, описание)
- RewardsPage: ConfirmModal, TicketSheet, ClaimSuccessModal — контейнеры с `GLASS_STRONG` → `APG2_PROFILE.glass`, `borderRadius: '34px'`, safe-area padding; кнопки → `GlassButton`; все `T.*` → `APG2_PROFILE.*`
- HomePanelV2: EventModal (detail sheet) → `V2.glass`, borderRadius 34px, safe-area; EventCard mini-tiles → `V2.*` токены; PartnerLogo border → rgba; NewsDetailSheet (swipe sheet) → `V2.glass`; NewsWidget контейнер → `V2.glowGlass`; News-карточки горизонтальной ленты → `V2.*`; Welcome-карточка пользователя → `V2.glowGlass` вместо `GLASS_STRONG`
**Почему:** Унификация визуального языка — удаление смеси устаревших `T.*`/`GLASS_STRONG` в активных v2-компонентах, переход на `APG2_PROFILE`/`V2.*` токены

---

## [2026-07-09] Fix: смещение экрана при открытии карточки эксперта
**Коммит:** `5868846b`
**Файлы:** `src/ExpertsPage.jsx`, `src/EventsPage.jsx`, `src/components/Apg2ProfileGlass.jsx`
**Тип:** fix
**Что изменено:** 1) Заменён scroll-lock `overflow:hidden` на паттерн `position:fixed + top:-scrollY + width:100%` с восстановлением `window.scrollTo(0, scrollY)` при закрытии — в ExpertsPage (selected), EventsPage (selectedEvent). 2) Добавлен `onTouchStart/Move/End={e => e.stopPropagation()}` на overlay обоих модалей ExpertsPage (v2 и v1) и на ApgModal в Apg2ProfileGlass. В drag-handlers v1 и ApgModal добавлен `e.stopPropagation()` в начало. 3) ApgModal: `handleTouchEnd` принимает `e` параметр для вызова stopPropagation.
**Почему:** iOS и VK Mini App игнорируют `overflow:hidden` на body как средство блокировки скролла — браузер сбрасывает визуальную позицию скролла на 0, из-за чего весь контент «уходит вверх». Touch-события из порталов (createPortal → document.body) всё равно всплывают по React-дереву к UserApp, запуская pull-to-refresh и edge-swipe обратно.

---

## [2026-07-09] ExpertCabinetPage v2 + ApgHealthPage
**Коммит:** `5868846b`
**Файлы:** `src/ExpertCabinetPage.jsx`, `src/ApgHealthPage.jsx` (новый), `src/UserApp.jsx`, `src/ProfilePanel.jsx`
**Тип:** feat
**Что изменено:** ExpertCabinetPage v2 — полная переработка: 6 вкладок (Старт/Аналитика/Контент/QR/Отзывы/Карточка), SVG-кольцо прогресса, чек-лист готовности (8 пунктов), быстрые действия (4 кнопки), контекстный Локи (8 сценариев), блок достижений (6 штук), «ближайшая цель», группированная статистика со столбчатым рейтингом, превью галереи. ApgHealthPage (owner only) — диагностика: 3 вкладки (Обзор/Данные/Активность), проверка сервисов (Auth/Firestore/Backend/Интернет), свежая выгрузка errorLogs из Firestore, счётчики сущностей, лента партнёров и новостей, критические предупреждения. UserApp: lazy import + Panel id="health". ProfilePanel: кнопка «APG Health» под кнопкой администрирования (owner only).
**Почему:** Кабинет эксперта должен быть центром управления профилем с чётким путём к заполнению. Health-экран даёт владельцу мгновенный срез состояния системы без выхода из приложения.

---

## [2026-07-08] Улучшение личного кабинета партнёра (v2)
**Коммит:** `5868846b`
**Файлы:** `src/PartnerCabinetPage.jsx`
**Тип:** feat
**Что изменено:** Переработан v2-вариант кабинета: добавлена строка быстрых действий (фото/акция/QR/карточка), SVG-кольцо прогресса с процентом, карточка «Следующий шаг», нумерованный чек-лист с выделением текущего пункта, контекстно-зависимые подсказки Локи (8 сценариев), мини-метрики на вкладке «Старт», группировка статистики по разделам (Охват / Сканирования / Переходы), доната-конверсия, статус-индикаторы для раздела «Контент», плейсхолдеры в полях редактирования. Вкладка «Аналитика» показывает пустое состояние с кнопкой «Посмотреть QR».
**Почему:** Кабинет должен быть рабочим центром партнёра, а не страницей статистики — с понятным следующим шагом, быстрым доступом к ключевым действиям и персональными подсказками.

---

## [2026-07-08] Мастер публикации и запуск партнёра
**Коммит:** `локально`
**Файлы:** `src/AdminPanel.jsx`, `src/PartnerCabinetPage.jsx`, `api/admin-actions.js`, `server/src/routes/admin-actions.js`, `.ai/04_API.md`, `.ai/07_ADMIN_PANEL.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:** Мастер подключения партнёра получил 5-шаговый progress, полный чек-лист readiness, backend-автосоздание черновика приветственной новости при публикации, отдельное действие `partner:mark-verified` и обновлённый кабинет партнёра с разделами “Старт”, “Аналитика”, “Контент”, “Отзывы”, “Документы”. Автоматический push при создании черновика партнёра отключён: push теперь остаётся launch-рекомендацией после публикации.
**Почему:** После создания и привязки карточки партнёра нужно завершать весь цикл запуска: проверить готовность, опубликовать, подготовить продвижение, дать партнёру полезный кабинет и только потом присваивать доверенный статус.

---

## [2026-07-08] Жизненный цикл публикации партнёра
**Коммит:** `локально`
**Файлы:** `src/AdminPanel.jsx`, `src/PartnerCabinetPage.jsx`, `src/HomePanelV2.jsx`, `src/UserApp.jsx`, `api/admin-actions.js`, `server/src/routes/admin-actions.js`, `api/email-auth.js`, `server/src/routes/email-auth.js`, `api/public-data.js`, `server/src/routes/public-data.js`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:** Подключение партнёра расширено до pipeline запуска: черновик, подключение владельца, оформление карточки, готовность к публикации, публикация в каталог, новые партнёры на 14 дней и launch-чеклист. Админка получила кнопку “Опубликовать в каталог”, публикационный readiness gate 80% с обязательным согласием, действия Локи после публикации и автосоздание приветственной новости. Кабинет партнёра теперь открывается со стартового чек-листа, а публичный каталог скрывает новые `catalogPublished:false` черновики.
**Почему:** После привязки кабинета процесс всё ещё обрывался до фактического запуска партнёра в экосистеме АПГ.

---

## [2026-07-08] Мастер подключения партнёра после ИИ-импорта
**Коммит:** `локально`
**Файлы:** `src/AdminPanel.jsx`, `api/admin-actions.js`, `server/src/routes/admin-actions.js`, `api/email-auth.js`, `server/src/routes/email-auth.js`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:** После сохранения карточки партнёра с email запускается мастер подключения: backend проверяет пользователя по email, показывает найденного пользователя или приглашение, умеет привязать кабинет, отправить персональную ссылку, сохранить статус подключения, readiness-прогресс, рекомендации Локи и журнал событий. Email-регистрация автоматически подхватывает ожидающие partner invite и выдаёт доступ к своему кабинету.
**Почему:** Сценарий ИИ-импорта обрывался после сохранения карточки: администратор не видел следующих действий, партнёр не получал понятного приглашения, а статус подключения не фиксировался.

---

## [2026-07-08] Упрощённая юридическая карточка публичных заявок
**Коммит:** `локально`
**Файлы:** `src/PublicSubmitPage.jsx`, `src/AdminPanel.jsx`, `api/public-submit.js`, `server/src/routes/public-submit.js`, `.ai/04_API.md`, `.ai/07_ADMIN_PANEL.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:** Публичная анкета больше не заставляет проходить отдельный обязательный юридический шаг. Основная форма собирает данные для публикации, связи и обязательный ИНН; юридический блок свёрнут по умолчанию и раскрывается добровольно или при выборе платного сотрудничества. Backend хранит `cooperationPlan`, `cooperationStatus`, `lokiCooperationNote` и различает статусы `legal_not_required`, `legal_recommended`, `legal_partial`, `contract_ready`.
**Почему:** Нужно не отпугивать новых партнёров и экспертов длинной бюрократической формой, но сохранить готовность к договорам, ЭДО, счетам, актам, маркировке рекламы и CRM.

---

## [2026-07-08] Юридические карточки публичных заявок
**Коммит:** `локально`
**Файлы:** `src/PublicSubmitPage.jsx`, `src/AdminPanel.jsx`, `api/public-submit.js`, `server/src/routes/public-submit.js`, `api/upload-photo.js`, `server/src/routes/upload-photo.js`, `api/admin-actions.js`, `server/src/routes/admin-actions.js`, `.ai/04_API.md`, `.ai/07_ADMIN_PANEL.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:** Публичная анкета стала двухшаговой: публичная карточка и закрытая юридическая карточка для ООО, ИП, самозанятых и физических лиц. Backend нормализует реквизиты, проверяет ИНН/КПП/ОГРН/ОГРНИП/БИК/счета, хранит документы, формирует `counterparty` и CRM-заготовку. Админка показывает юридические данные только ролям `owner`, `super_admin`, `admin`, а `/api/admin-actions` вырезает закрытые поля для остальных ролей.
**Почему:** Нужно собирать не только данные для публикации, но и реквизиты для договоров, ЭДО, бухгалтерии и будущей CRM без риска показа юридических данных пользователям.

---

## [2026-07-08] Публичные формы заявок АПГ
**Коммит:** `локально`
**Файлы:** `src/AdminPanel.jsx`, `src/UserApp.jsx`, `src/PublicSubmitPage.jsx`, `api/public-submit.js`, `server/src/routes/public-submit.js`, `server/src/server.js`, `api/admin-actions.js`, `server/src/routes/admin-actions.js`, `.ai/04_API.md`, `.ai/07_ADMIN_PANEL.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:** В «ИИ-импорт» добавлен блок публичных форм для партнёров, экспертов, событий, новостей и призов: генерация токен-ссылки, готовое сообщение, QR-код и история выданных ссылок. Добавлена публичная страница `/submit/:type/:token` с формой, загрузкой фото и отправкой заявки без авторизации. Backend `/api/public-submit` создаёт обработанную запись в `aiImportRequests` и закрывает ссылку после отправки.
**Почему:** Нужно убрать ручной сбор данных через переписки и получать структурированные заявки сразу в редакционную очередь АПГ.

---

## [2026-07-08] Нормализация внешних ссылок партнёров и экспертов
**Коммит:** `локально`
**Файлы:** `src/utils/externalUrls.js`, `src/vk.js`, `src/PartnerPage.jsx`, `src/ExpertsPage.jsx`, `src/AdminPanel.jsx`, `src/PartnerCabinetPage.jsx`, `src/ExpertCabinetPage.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Добавлен единый нормализатор внешних URL для VK, Telegram, WhatsApp, Instagram, YouTube, Rutube, Дзен, Max и сайтов. Карточки партнёров/экспертов и формы сохранения теперь приводят ссылки вроде `www.vk.com/vibes`, `vk.com/vibes`, `@vibes` и `vibes` к безопасному каноническому виду перед сохранением и открытием.
**Почему:** VK-ссылка партнёра Vibes могла пересобираться как `https://vk.com/www.vk.com/...`, из-за чего открывалась страница VK с ошибкой «Такой страницы не существует».

---

## [2026-07-08] ИИ-импорт заявок в админке
**Коммит:** `локально`
**Файлы:** `src/AdminPanel.jsx`, `api/admin-actions.js`, `server/src/routes/admin-actions.js`, `api/_admin-security.js`, `server/src/lib/adminSecurity.js`, `.ai/04_API.md`, `.ai/07_ADMIN_PANEL.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:** Добавлена вкладка «ИИ-импорт» для заявок партнёров, экспертов, событий, новостей и призов. Админ может вставить текст анкеты или загрузить текстовый файл, получить распознанные поля, confidence, список недостающих данных, сохранить заявку в `aiImportRequests` и создать из неё черновик в нужном разделе. Backend whitelist расширен новым ресурсом `aiImportRequests`, права проверяются через `ai:*`.
**Почему:** Нужно ускорить перенос данных из анкет/сообщений в админку, сохранив редакционный контроль и запрет автопубликации.

---

## [2026-07-08] Плавные горизонтальные карусели и карточки «Что интересного сегодня»
**Коммит:** `локально`
**Файлы:** `src/HomePanelV2.jsx`, `src/NewsPage.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Блок «Что интересного сегодня» переведён на native CSS Scroll Snap с едиными размерами карточек, фиксированным нижним текстовым блоком и двухстрочным ellipsis. Горизонтальные ленты главной и страницы новостей получили общий snap/contain стиль с инерционной прокруткой и без VKUI `HorizontalScroll` на главной.
**Почему:** Карточки останавливались между позициями, жесты конфликтовали с вертикальным скроллом, а длинные названия в подборке обрезались неаккуратно.

---

## [2026-07-08] Контекстная Action Bar вместо плавающих быстрых действий
**Коммит:** `локально`
**Файлы:** `src/AdminPanel.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Удалена плавающая вертикальная панель быстрых действий в админке. Верхний toolbar получил компактные контекстные действия `+ Создать`, `Фильтр`, `Обновить`, `Экспорт`; на мобильных меню создания открывается как bottom sheet.
**Почему:** Плавающая стопка больших кнопок перекрывала рабочую область и мешала пользоваться админкой. Действия должны быть доступны из панели, но не закрывать контент.

---

## [2026-07-08] Demo hotfix: временно отключён экран согласий
**Коммит:** `локально`
**Файлы:** `src/UserApp.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Добавлен временный флаг `CONSENT_SCREEN_DISABLED_FOR_DEMO`, который отключает показ `ConsentScreen` и не даёт проверке согласий блокировать авторизованного пользователя. Email-flow при успешной авторизации сразу завершает вход и открывает приложение.
**Почему:** Срочный production hotfix для демонстрации: окно согласий повторно блокировало вход, нужно быстро восстановить доступ к главной без белого экрана и зависаний.

---

## [2026-07-08] Миграция legacy-согласий и защита от повторного экрана документов
**Коммит:** `локально`
**Файлы:** `src/UserApp.jsx`, `api/user-actions.js`, `server/src/routes/user-actions.js`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** `profile:sync` теперь возвращает `profileReady`, `consentRequired`, причину и версию формата согласий. Backend распознаёт старые поля `consentAccepted`, `termsAccepted`, `privacyAccepted`, `acceptedAt` и автоматически нормализует их в новый `consents`. Добавлены owner-only actions `profile:consentStatus` и `profile:forceAcceptConsent` для диагностики и rescue застрявших профилей.
**Почему:** Пользователи, которые уже принимали документы в старом формате, могли снова попадать на экран согласий, потому что frontend проверял только новую структуру `consents.*`.

---

## [2026-07-08] Устойчивое завершение email-входа после документов
**Коммит:** `локально`
**Файлы:** `src/UserApp.jsx`, `src/ConsentScreen.jsx`, `api/user-actions.js`, `server/src/routes/user-actions.js`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Экран документов теперь показывается только после завершённой Firebase Auth и backend `profile:sync`. Сохранение согласий переведено в отдельное backend-действие `profile:acceptConsent` с transaction/merge, без прямого клиентского чтения Firestore на этапе `Продолжить`.
**Почему:** В production вход доходил до документов, но мог падать на сохранении профиля/согласий из-за гонки auth/profile state или отсутствующего документа пользователя. Документы должны быть этапом onboarding после успешной авторизации, а не частью незавершённого входа.

---

## [2026-07-08] Safe bootstrap и lite-диагностика без React
**Коммит:** `локально`
**Файлы:** `index.html`, `public/network-diagnostics-lite`, `src/App.jsx`, `src/main.jsx`, `src/ErrorBoundary.jsx`, `deploy-frontend.sh`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Добавлен аварийный pre-React fallback в `index.html`, статическая страница `/network-diagnostics-lite` без React/Firebase/внешних скриптов, ранний bootstrap trace и режим `?no-sw=1`. `UserApp` переведён в lazy-load, чтобы Firebase/Auth/Firestore не были частью самого первого React shell, а внешний Telegram script больше не блокирует старт приложения.
**Почему:** На телефонах без VPN приложение могло показывать белый экран до роутинга и React-диагностики. Теперь даже при недоступности Firebase/Google/Telegram пользователь должен увидеть shell, ошибку или lite-диагностику вместо пустого экрана.

---

## [2026-07-08] Диагностика запуска без VPN и устойчивый public-data
**Коммит:** `локально`
**Файлы:** `src/main.jsx`, `src/App.jsx`, `src/UserApp.jsx`, `src/networkDiagnostics.js`, `src/NetworkDiagnosticsPage.jsx`, `api/public-data.js`, `server/src/routes/public-data.js`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Добавлена скрытая страница `/#/network-diagnostics` с проверкой доступности myapg.ru, Yandex API, public-data, Firebase/Google, Yandex Storage, VK и Telegram без логирования секретов. Установлен безопасный runtime-лог fetch-запросов. `/api/public-data` теперь возвращает частичные данные через `Promise.allSettled`, чтобы одна проблемная коллекция не отправляла главную обратно в прямой Firestore fallback.
**Почему:** Если приложение открывается только через VPN, нужно точно видеть недоступный домен на устройстве пользователя и убрать Firebase/Google из критичного пути загрузки публичной главной.

---

## [2026-07-08] Защищённый вход админки и bootstrap Owner
**Коммит:** `локально`
**Файлы:** `src/AdminPanel.jsx`, `api/admin-login.js`, `api/_admin-security.js`, `api/admin-security.js`, `server/src/lib/adminSecurity.js`, `server/src/routes/admin-login.js`, `server/src/routes/admin-security.js`, `server/src/server.js`, `server-shared/admin-password.js`, `scripts/bootstrap-owner.mjs`, `.ai/04_API.md`, `.ai/07_ADMIN_PANEL.md`, `.ai/12_SECURITY.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** security
**Что изменено:** Убран автоматический вход в админку по старой Firebase-сессии без ввода email/password. Добавлен `/api/admin-login` с scrypt-хешами паролей и Firebase custom token, создание администраторов через Firebase Auth, смена временного пароля при первом входе, смена пароля администратору, защита `owner` от блокировки/понижения/удаления, серверная проверка `adminStatus`. Создан production owner через Firebase Admin bootstrap.
**Почему:** Закрытие критической уязвимости доступа к админке и переход к полноценным персональным административным аккаунтам.

---

## [2026-07-08] Admin RBAC и центр безопасности
**Коммит:** `локально`
**Файлы:** `src/AdminPanel.jsx`, `api/_admin-security.js`, `api/admin-security.js`, `server/src/lib/adminSecurity.js`, `server/src/routes/admin-security.js`, `server/src/server.js`, `.ai/04_API.md`, `.ai/07_ADMIN_PANEL.md`, `.ai/12_SECURITY.md`, `.ai/17_CHANGELOG_AI.md`
**Тип:** feat
**Что изменено:** Добавлен `/api/admin-security`, server-side RBAC для ролей owner/super_admin/admin/editor/moderator/analyst/partner/expert/user, новый вход в админку через Firebase session/email+password и вкладка «Доступ» с матрицей прав, администраторами и журналом безопасности.
**Почему:** Админке нужна профессиональная система доступа вместо локального парольного gate: роли и действия должны проверяться backend, а изменения доступа должны попадать в аудит.

---

## [2026-07-08] Production smoke script для Chromium
**Коммит:** `локально`
**Файлы:** `package.json`, `scripts/prod-smoke.mjs`, `.ai/17_CHANGELOG_AI.md`
**Тип:** chore
**Что изменено:** Добавлена команда `npm run smoke:prod`, которая открывает production через Playwright Chromium, проверяет `version.json`, React root, критические UI-маркеры и console/page errors.
**Почему:** Headless Chromium стабильно падает внутри macOS sandbox с `MachPort permission denied`; отдельная команда позволяет запускать production smoke сразу вне sandbox без длинного `node -e`.

---

## [2026-07-08] Hotfix скролла статьи новости и iOS zoom комментариев
**Коммит:** `локально`
**Файлы:** `src/UserApp.jsx`, `src/NewsPage.jsx`, `.ai/17_CHANGELOG_AI.md`
**Тип:** fix
**Что изменено:** Pull-to-refresh ограничен корневой лентой новостей и отключён внутри статьи, комментариев и галереи. Поле комментария увеличено до 16px для Safari iOS, после успешной отправки снимается фокус и восстанавливается позиция внутреннего скролла статьи.
**Почему:** В открытой новости жест обновления вмешивался в обычный скролл вверх, мог оставлять пустую область, а Safari сохранял увеличенный масштаб после ввода комментария.

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

## [2026-07-10] Центр событий: предложения от партнёров и экспертов
**Коммит:** `pending`
**Файлы:** `src/EventProposalTools.jsx`, `src/PartnerCabinetPage.jsx`, `src/ExpertCabinetPage.jsx`, `src/UserApp.jsx`, `src/AdminPanel.jsx`, `src/EventDetailSheet.jsx`, `api/user-actions.js`, `api/admin-actions.js`
**Тип:** feat
**Что изменено:** Добавлены вкладки календаря/расписания в кабинеты, форма предложения мероприятия, backend-создание черновика на модерации, блок «Предложения» в новом Центре событий, модерационные действия и внутренние уведомления авторам.
**Почему:** Партнёры и эксперты должны планировать мероприятия самостоятельно, а публикация должна оставаться за администрацией.

---

## [2026-07-10] Центр событий: операционная карточка мероприятия
**Коммит:** `pending`
**Файлы:** `src/EventDetailSheet.jsx`, `src/AdminPanel.jsx`, `src/EventsCalendar.jsx`
**Тип:** feat
**Что изменено:** В карточку события добавлены подготовительный checklist, проверка качества, предпросмотр, план продвижения, предупреждения о конфликтах, дублирование и создание серии черновиков. В календарь добавлены свободные окна выбранного дня.
**Почему:** Администратор должен управлять подготовкой мероприятия из нового Центра событий без перехода в старый раздел.

---

## [2026-07-10] Пользовательский календарь событий V2
**Коммит:** `pending`
**Файлы:** `src/EventsPage.jsx`, `src/EventDetailSheet.jsx`, `src/UserApp.jsx`
**Тип:** feat
**Что изменено:** Раздел «События» превращён в городскую афишу с режимами список/календарь, сохранением режима, быстрыми фильтрами, подборками, чистой месячной сеткой, EventDetailSheet для пользователей, экспортом .ics, локальными напоминаниями, маршрутом, шарингом и регистрацией из карточки.
**Почему:** Пользователь должен ежедневно открывать раздел, чтобы быстро понять, что происходит сегодня, на выходных и рядом.

---

## [2026-07-10] Центр событий: защита от неполных старых событий
**Коммит:** `pending`
**Файлы:** `src/EventsCalendar.jsx`, `src/EventDetailSheet.jsx`
**Тип:** fix
**Что изменено:** Убран прямой вызов `dow.charAt(...)` в `formatDayLabel`, добавлены безопасные преобразования строк и дат, календарь и карточка события стали tolerant к отсутствующим `category`, `title`, `partnerName`, `expertName`, `status`, датам и полям регистраций.
**Почему:** Старые документы Firestore могут не содержать новых полей Центра событий, из-за чего production падал при открытии раздела.

---

## [2026-07-10] Архив партнёров/экспертов и демо-партнёр
**Коммит:** `pending`
**Файлы:** `src/AdminPanel.jsx`, `src/UserApp.jsx`, `api/admin-actions.js`, `api/user-actions.js`, `api/activity-index.js`, `api/expert-rotation.js`, `server/src/routes/admin-actions.js`, `server/src/routes/user-actions.js`, `server/src/routes/activity-index.js`, `server/src/routes/expert-rotation.js`, `scripts/seed-demo-partner.mjs`
**Тип:** feat
**Что изменено:** Добавлен soft-archive для партнёров и экспертов, owner-only окончательное удаление, публичная фильтрация архивных профилей, backend-защита пользовательских действий и seed-скрипт демонстрационного партнёра АПГ.
**Почему:** Партнёров и экспертов нужно скрывать безопасно без потери истории, а owner-аккаунту нужен презентационный кабинет с заполненными данными.

---

## [2026-07-10] Партнёрский кабинет: несколько владельцев
**Коммит:** `pending`
**Файлы:** `src/UserApp.jsx`, `api/user-actions.js`, `api/admin-actions.js`, `server/src/routes/user-actions.js`, `server/src/routes/admin-actions.js`, `scripts/seed-demo-partner.mjs`
**Тип:** feat
**Что изменено:** Добавлена поддержка `ownerUserIds` и `ownerEmails` у партнёров/экспертов, backend-проверки доступа принимают нескольких владельцев, админская привязка добавляет владельца в массивы, демо-партнёр выдаётся нескольким владельцам через единый seed.
**Почему:** Один кабинет партнёра должен быть доступен owner и главному администратору без переключений и повторных привязок.

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

## 2026-07-10 — Hotfix EventDetailSheet React #310

**Задача:** Устранить production crash при открытии карточки события из афиши/Демовстречи: `APG-MRE8CF1T`, minified React error #310, источник `EventDetailSheet`.

**Файлы:** `src/EventDetailSheet.jsx`

**Что изменено:** Исправлен порядок вызова хуков в `EventDetailSheet`: `useMemo(buildParticipants)` больше не находится после раннего `return null`, поэтому при переходе из закрытого состояния sheet в открытое React не получает разный набор хуков. Добавлен локальный error boundary для содержимого карточки события с пользовательским экраном «Не удалось открыть мероприятие», кнопками «Повторить» и «Закрыть», логированием через `logError` и диагностикой отсутствующих полей события.

**Важно:** Это исправляет первопричину React #310, а не маскирует её. Старые события с неполными полями продолжают открываться через безопасные значения по умолчанию.

## 2026-07-10 — Follow-up hotfix EventDetailSheet opening

**Задача:** После hotfix `b3e6d2eb` карточка события перестала открываться корректно из афиши, а Локи оставался поверх интерфейса события.

**Файлы:** `src/EventDetailSheet.jsx`

**Что изменено:** Убран внутренний `EventDetailSheetErrorBoundary`, добавленный в предыдущем hotfix, вместе с диагностическим `useEffect` и импортом `logError`, чтобы вернуть дерево рендера карточки к состоянию до регрессии. Сохранён настоящий фикс React #310: `useMemo(buildParticipants)` остаётся выше раннего `return null`. Слой bottom sheet поднят до `zIndex: 12000`, чтобы открытая карточка события перекрывала Локи и нижние плавающие элементы.

## 2026-07-10 — EventDetailSheet production QA follow-up

**Задача:** По результатам функциональной QA production-сценариев события скрыть Локи при открытой карточке события и добавить настоящее закрытие карточки свайпом вниз.

**Файлы:** `src/EventDetailSheet.jsx`, `src/UserApp.jsx`

**Что изменено:** `EventDetailSheet` отправляет событие `apg:event-sheet-open` при открытии/закрытии и помечает `document.body.dataset.apgEventSheetOpen`. `UserApp` слушает это событие и временно не рендерит `LokiAssistant`, пока карточка события открыта. В `EventDetailSheet` добавлена touch-обработка свайпа вниз: если пользователь тянет sheet вниз больше чем на 86px, вызывается штатное закрытие.

## 2026-07-10 — EventDetailSheet swipe close fix

**Задача:** После production QA закрытие карточки события свайпом вниз не срабатывало в touch-сценарии.

**Файлы:** `src/EventDetailSheet.jsx`

**Что изменено:** Добавлен `onTouchMove` для bottom sheet: если пользователь протягивает карточку вниз больше чем на 110px, вызывается штатное закрытие. `onTouchEnd` оставлен как дополнительный fallback.

## 2026-07-10 — EventDetailSheet pointer swipe support

**Задача:** Touch-only обработчик свайпа вниз не закрывал карточку в production QA через браузерные pointer/touch события.

**Файлы:** `src/EventDetailSheet.jsx`

**Что изменено:** Добавлена параллельная обработка `pointerdown/pointermove/pointerup` для не-mouse указателей. При движении вниз больше чем на 110px карточка закрывается штатным `handleClose`. Touch fallback сохранён.

## 2026-07-10 — EventDetailSheet drag close QA alignment

**Задача:** Production QA должна проверять закрытие карточки события drag/swipe вниз тем же pointer-сценарием, который доступен в браузере.

**Файлы:** `src/EventDetailSheet.jsx`

**Что изменено:** Pointer drag вниз больше чем на 110px теперь работает для всех pointer types, включая mouse. Обычный клик не закрывает карточку, нужен именно заметный drag вниз.

## 2026-07-10 — EventsPage mobile layout width fix

**Задача:** Исправить доказанный разъезд layout афиши на production: горизонтальные подборки событий расширяли страницу до 656-800px при мобильном viewport 390px.

**Файлы:** `src/EventsPage.jsx`

**Что изменено:** В `EventPosterCard` добавлены `width: '100%'`, `maxWidth: '100%'`, `minWidth: 0`, `boxSizing: 'border-box'`, а внутренний grid переведён на `minmax(0, 1fr)`. Для секций подборок добавлены `minWidth: 0`, `maxWidth: '100%'`, `overflow: 'hidden'`. Горизонтальный scroller ограничен `width: '100%'`, `maxWidth: '100%'`, `minWidth: 0`, `boxSizing: 'border-box'`, `overflowY: 'hidden'`; `gridAutoColumns` заменён с `minmax(260px, 82%)` на `minmax(240px, min(82vw, 82%))`, чтобы карточки не могли раздувать родителя шире viewport.

## 2026-07-10 — EventsPage real-device sheet diagnostics

**Задача:** Реальное устройство после `7768c223` показало две проблемы: карточки подборок стали визуально слишком узкими, а `EventDetailSheet` не открывался видимо, несмотря на успешные DOM-проверки.

**Файлы:** `src/EventsPage.jsx`, `src/EventDetailSheet.jsx`

**Что изменено:** Ширина карточек горизонтальных подборок изменена на `clamp(270px, 94%, 420px)`, чтобы на мобильных экранах карточка занимала около 94% доступного контейнера и сохраняла намёк на следующую карточку без расширения страницы. `EventDetailSheet` теперь рендерится через `createPortal(..., document.body)`, чтобы `position: fixed` не зависел от transform/stacking context родительских контейнеров. Добавлена временная визуальная диагностика открытия: яркая рамка sheet, надпись `EVENT SHEET OPEN`, rect, версия приложения, состояние service worker, загруженные JS chunks и timestamp-логи `CARD_POINTER_DOWN`, `CARD_CLICK`, `SET_SELECTED_EVENT`, `SHEET_MOUNT`, `SHEET_VISIBLE`, `BACKDROP_CLICK`, `DRAG_START`, `DRAG_CLOSE`, `SHEET_CLOSE`.

## 2026-07-10 — EventDetailSheet content normalization and final mobile layout

**Задача:** После диагностики стало ясно, что `EventDetailSheet` открывается корректно, но на реальном устройстве секции выглядели пустыми/skeleton-like: данные события не распознавались всеми секциями, а золотая поверхность sheet давала слабый контраст для внутренних glass-блоков.

**Файлы:** `src/EventDetailSheet.jsx`, `src/EventsPage.jsx`

**Что изменено:** Временная диагностика полностью удалена. `EventDetailSheet` оставлен в `createPortal(..., document.body)`, но теперь строит нормализованный `detailEvent` с поддержкой старых и новых полей: `partnerName`, `expertName`, `organizerName`, `speakerName`, `location.address`, `schedule`, `photos/images/gallery`, `registrationDeadline`, `registrations/participants` и других алиасов. Внутренние секции читают нормализованные значения, поэтому описание, дата, место, организатор и регистрация отображаются без ожидания дополнительного loading-state. Sheet переведён на тёмную iOS bottom-sheet поверхность, увеличена читаемость текста, внешний мобильный отступ уменьшен до safe-area + 6px, чтобы карточка занимала почти всю ширину экрана.

## 2026-07-10 — Event center visual APG V2 polish

**Задача:** Перед дальнейшей разработкой исправить два UX-недочёта: слабочитаемый бейдж даты на фото в афише и визуальное отличие `EventDetailSheet` от общей дизайн-системы АПГ V2.

**Файлы:** `src/EventsPage.jsx`, `src/EventDetailSheet.jsx`

**Что изменено:** Бейдж даты на карточках афиши переработан в контрастную золотую glass-пластину с blur, светлым кантом, тенью и более крупной типографикой. `EventDetailSheet` переведён на `APG2_PROFILE`: фон sheet использует `APG2_PROFILE.bg`, секции используют `APG2_PROFILE.glass`, hero стал крупной пользовательской обложкой с градиентом, статусом и быстрыми инфо-плитками. Увеличен воздух между блоками, внешний мобильный отступ сохранён минимальным для почти полноширинного iOS bottom sheet.

**Дополнительно:** При открытии события внутренний scroll карточки принудительно возвращается в начало, чтобы пользователь сразу видел большую hero-обложку, а не середину карточки после предыдущих взаимодействий. Для мобильных браузеров сброс усилен через layout-time reset, remount scroll-контейнера и отложенные fallback-сбросы. Hero-блок вынесен над scroll-областью секций, чтобы обложка всегда была первым видимым экраном bottom sheet.

## 2026-07-10 — Universal Links и path-based deep links

**Задача:** Поддержать открытие новостей, событий, партнёров и экспертов по красивым web/PWA-ссылкам без hash-routing.

**Файлы:** `src/App.jsx`, `src/main.jsx`, `src/UserApp.jsx`, `src/NewsPage.jsx`, `src/EventDetailSheet.jsx`, `src/PartnerPage.jsx`, `src/ExpertsPage.jsx`, `src/PartnerCabinetPage.jsx`, `src/ExpertCabinetPage.jsx`, `src/PartnerQRSection.jsx`, `src/AdminPanel.jsx`, `src/firebase.js`, `src/assistant/AssistantMiniApp.jsx`, `src/utils/shareLink.js`, `public/manifest.json`, `public/sw.js`

**Что изменено:** `App` переведён на `BrowserRouter`, старые `/#/...` ссылки автоматически переписываются в path до рендера, `UserApp` открывает `/news/:id`, `/event/:id`, `/events`, `/partner/:id`, `/expert/:id` и `/experts` сразу в нужной панели/карточке. Добавлен единый helper `shareLink(entityType,id)`, публичные share/QR-ссылки переведены на `/news/...`, `/event/...`, `/partner/...`, `/expert/...`. Manifest теперь использует `id/start_url/scope` от `/`, service worker получил navigation fallback на `/index.html` и фокусирует существующее PWA-окно при push/open.

**Совместимость:** Старые hash-ссылки и старые QR вида `?partner=` / `?expert=` продолжают распознаваться.

## 2026-07-10 — VK news article reader and comments hotfix

**Задача:** Устранить production-проблему VK-новостей: тёмная плохо читаемая статья и отсутствие полноценного блока комментариев/функций АПГ при открытии с главной.

**Файлы:** `src/NewsPage.jsx`, `src/newsUtils.js`, `src/UserApp.jsx`, `src/HomePanelV2.jsx`, `src/ProfilePanel.jsx`, `src/NotificationsPage.jsx`, `src/LokiPage.jsx`, `src/index.css`, `api/news-comments.js`, `server/src/routes/news-comments.js`, `scripts/news-article-regression.mjs`, `package.json`

**Что изменено:** Добавлен единый canonical id новости и legacy aliases для VK/исторических записей. Комментарии, реакции, сохранения, deep links и открытие новости теперь используют один canonical id; backend `/api/news-comments` читает canonical + legacy ids с дедупликацией, а новые комментарии пишет под canonical id. `commentsEnabled` нормализован так, что только boolean `false` отключает комментарии.

**UX:** `ArticleView` получил изолированный светлый режим чтения `.apg-news-article-*`: светлый непрозрачный фон области статьи, тёмный основной текст, стабильные CSS-переменные, без родительского opacity/filter/тёмного overlay поверх текста. Временные диагностические `console.log` из новостных сценариев удалены.

**Проверка:** Добавлен `npm run test:news-article`, который на local production preview с реальными VK API-данными проверяет открытие VK-новости с главной, из `/news` и через `/news/:id`, светлый reader, наличие CommentsPanel, default-on comments, canonical id и кнопку оригинала VK после контента.

## 2026-07-10 — Contextual Loki for news articles

**Задача:** Переработать кнопку «Пересказать с Локи» в статье: вместо перехода в пустой раздел Локи должен открываться в контексте конкретной новости и сразу давать краткий пересказ.

**Файлы:** `src/NewsPage.jsx`, `src/loki/LokiProvider.jsx`, `src/loki/LokiExperience.jsx`

**Что изменено:** Добавлен универсальный `activeContext` в `LokiProvider` и метод `openContextExperience(context)`. `ArticleView` теперь собирает контекст новости: `newsId`, заголовок, текст, категорию, источник, связанные партнёры, эксперты и события, после чего открывает существующий `LokiExperience` поверх статьи без навигации в другую панель. Позиция чтения сохраняется, потому что статья не размонтируется.

**UX:** В контексте новости Локи стартует с готового пересказа, показывает быстрые действия «Кратко», «Главное», «Простыми словами», «Для бизнеса», «Для жителей», «События», «Партнёры», «Эксперты», «Похожие» и кнопку «Прослушать». При повторном открытии Локи использует сохранённый `lastContext` и предлагает продолжить обсуждение последней новости.

## 2026-07-10 — APG engineering knowledge base foundation

**Задача:** Создать фундамент инженерной базы знаний АПГ без изменения функциональности приложения, UI, backend и без deploy.

**Файлы:** `.ai/00_PROJECT_STATE.md`, `.ai/18_ARCHITECTURE_MAP.md`, `.ai/17_CHANGELOG_AI.md`

**Что изменено:** Добавлен паспорт актуального состояния проекта и первая архитектурная карта. Документы заполнены только подтверждёнными фактами из кода, проектной документации и production `version.json`.

## 2026-07-10 — APG dependency map

**Задача:** Построить карту зависимостей проекта без изменения функциональности, UI, backend, merge и deploy.

**Файлы:** `.ai/19_DEPENDENCY_MAP.md`, `.ai/17_CHANGELOG_AI.md`

**Что изменено:** Добавлена первая dependency map по крупным узлам: App, UserApp, AdminPanel, ProfilePanel, News, Events, Partners, Experts, Loki, Firebase, Backend, Push, Telegram, VK и PWA. Для каждого узла зафиксированы пользователи, зависимости, providers, API/backend endpoints, Firestore коллекции, глобальные состояния, маршруты, bottom sheets, portals и критические зависимости.

## 2026-07-10 — APG system philosophy

**Задача:** Создать человеческую инструкцию для будущих AI-разработчиков АПГ без изменения функциональности, UI, backend, merge и deploy.

**Файлы:** `.ai/20_SYSTEM_PHILOSOPHY.md`, `.ai/17_CHANGELOG_AI.md`

**Что изменено:** Добавлен документ с философией проекта: зачем существует АПГ, какие цели и принципы нельзя нарушать, что считается хорошим и плохим решением, какие архитектурные и UX-принципы обязательны, что запрещено делать и как должен думать AI-разработчик перед изменением системы.

## 2026-07-10 — APG knowledge navigator

**Задача:** Создать главный навигатор инженерной базы знаний АПГ без изменения функциональности, UI, backend, merge и deploy.

**Файлы:** `.ai/03_KNOWLEDGE_NAVIGATOR.md`, `.ai/17_CHANGELOG_AI.md`

**Что изменено:** Добавлен навигатор чтения перед задачами. Для ключевых областей указано, какие `.ai` документы читать, какие исходные файлы изучить, какие подсистемы могут быть затронуты и что проверить перед commit.

## 2026-07-10 — UserApp architecture audit V1

**Задача:** Провести архитектурный аудит `src/UserApp.jsx` без изменения рабочего кода, рефакторинга, исправлений, merge и deploy.

**Файлы:** `.ai/audits/USERAPP_AUDIT_V1.md`, `.ai/17_CHANGELOG_AI.md`

**Что изменено:** Добавлен аудит UserApp V1: размеры файла и hook-метрики, обязанности, карта зависимостей, API/backend/Firestore связи, архитектурные риски, подтверждённые кандидаты на выделение и оценка читаемости, масштабируемости, связанности, сложности и риска изменений.

## 2026-07-10 — Referral bonus Telegram audit and fix

**Задача:** Провести production-аудит реферальной цепочки для Telegram-приглашения и устранить потерю начисления без ручного начисления ключей.

**Файлы:** `src/UserApp.jsx`, `server/src/routes/user-actions.js`, `api/user-actions.js`, `scripts/backfill-referral.mjs`, `.ai/17_CHANGELOG_AI.md`

**Что изменено:** Начисление реферального бонуса перенесено в серверный `profile:sync` и выполняется транзакционно для новых и уже созданных Telegram-профилей. Existing-user sync теперь передаёт pending referral на backend. Добавлен безопасный idempotent backfill-скрипт для реально неначисленных приглашений.

## 2026-07-10 — Referral system admin audit panel

**Задача:** Расширить production-аудит реферальной системы, добавить административный раздел контроля цепочек и безопасные действия восстановления начисления.

**Файлы:** `src/AdminPanel.jsx`, `server/src/routes/admin-actions.js`, `api/admin-actions.js`, `.ai/17_CHANGELOG_AI.md`

**Что изменено:** В `admin-actions` добавлены действия `referrals:audit`, `referrals:check`, `referrals:recalculate`, `referrals:grant`. В админке добавлена вкладка «Рефералы» с фильтрами, статусами регистрации/привязки/начисления, причинами ошибок, пересчётом цепочки и защищённой кнопкой повторного начисления. Для реального Telegram-кейса сохранён production-документ компенсации в `referralCompensations`.

## 2026-07-10 — Telegram linking incident fix

**Задача:** Устранить production-инцидент, когда email-пользователь не мог безопасно подключить Telegram без риска второго `tg_*` профиля.

**Файлы:** `src/ProfilePanel.jsx`, `src/AdminPanel.jsx`, `api/telegram-auth-start.js`, `api/telegram-auth-check.js`, `api/telegram-webhook.js`, `api/email-auth.js`, `api/admin-actions.js`, `server/src/routes/telegram-auth-start.js`, `server/src/routes/telegram-auth-check.js`, `server/src/routes/telegram-webhook.js`, `server/src/routes/email-auth.js`, `server/src/routes/admin-actions.js`, `.ai/17_CHANGELOG_AI.md`

**Что изменено:** Telegram auth flow разделён на login и linking. `ProfilePanel` передаёт `ownerUserId`/`ownerEmail` и сохраняет режим `linking` при возврате из Telegram. Webhook больше не создаёт `tg_*` профиль для linking-сессии, а только подтверждает Telegram ID в сессии. `telegram-auth-check` не выдаёт Firebase custom token для linking. Атомарный `link-telegram` сохраняет username и продолжает защищать `tgLinks` от чужой привязки.

**Админка:** В карточку пользователя добавлен блок «Авторизация и привязки» с диагностикой email/Firebase/Telegram, последней auth-сессии, конфликтов `tgLinks`, созданием новой короткоживущей Telegram-сессии, отменой зависшей сессии и повторной проверкой.

**Проверка:** `npm run build` проходит; после commit требуется повторная сборка, чтобы `dist/version.json` получил новый git hash.

## 2026-07-10 — APG Automation Platform foundation

**Задача:** Создать единый движок автоматизации действий внутри АПГ без переписывания существующего функционала и без автоматической публикации.

**Файлы:** `src/AdminPanel.jsx`, `api/admin-actions.js`, `server/src/routes/admin-actions.js`, `.ai/00_PROJECT_STATE.md`, `.ai/18_ARCHITECTURE_MAP.md`, `.ai/19_DEPENDENCY_MAP.md`, `.ai/17_CHANGELOG_AI.md`

**Что изменено:** Добавлен Automation Engine в `admin-actions`: `automation:audit`, `automation:refresh`, `automation:confirm`, `automation:dismiss`. Движок генерирует подтверждаемые рекомендации для событий платформы: создан партнёр, создан эксперт, создано мероприятие, создана новость, создана акция, зарегистрирован пользователь, создан приз, завершено мероприятие.

**Админка:** Добавлен раздел «Автоматизация» со сводкой, фильтрами, списком доступных/выполненных/отклонённых автоматизаций и действиями подтверждения или отклонения. Подтверждение создаёт только черновики в существующих коллекциях (`news`, `notifications`, `customTasks`) либо отмечает рекомендацию выполненной.

**Архитектура:** Automation Engine независим от Локи и сохраняет рекомендации в `automationRecommendations`; Локи сможет использовать этот слой позже как источник действий.
## 2026-07-11 — Loki Core V2 production architecture

**Задача:** Подготовить Локи к роли модульной интеллектуальной операционной системы, сохранив существующие пользовательские сценарии и действия.

**Файлы:** `src/loki/core/LokiCore.js`, `src/loki/core/v2/*`, `scripts/loki-core-v2-test.mjs`, `package.json`, `.ai/21_LOKI_CORE_V2.md`, `.ai/17_CHANGELOG_AI.md`

**Что изменено:** Добавлены независимые реестры сценариев и модулей, role/permission guard, безопасный Action Engine, Planner, Reasoner, Admin Assistant diagnostics, ограниченная Memory Policy, обезличенная Analytics schema, Humor Engine и Voice queue controller. 63 существующих сценария автоматически нормализуются в строгую V2-схему, а legacy pipeline сохраняется как fallback. Привилегированные действия нельзя выполнить на клиенте: они требуют backend executor и подтверждённых прав.

**Проверка:** `npm run test:loki` — успешно; `npm run build` — успешно. Полная карта целевых 270 сценариев и честный статус готовности модулей зафиксированы в `.ai/21_LOKI_CORE_V2.md`.
## 2026-07-11 — Admin Assistant V1

**Задача:** Встроить контекстного интеллектуального помощника Локи во всю административную панель без отдельного экрана и новых тяжёлых запросов.

**Файлы:** `src/AdminPanel.jsx`, `src/adminAssistant/AdminContextEngine.js`, `src/adminAssistant/AdminAssistantEngine.js`, `src/adminAssistant/AdminAssistantPanel.jsx`, `scripts/admin-assistant-v1-test.mjs`, `package.json`, `.ai/22_ADMIN_ASSISTANT_V1.md`, `.ai/17_CHANGELOG_AI.md`

**Что изменено:** Добавлен автоматически обновляемый снимок admin-контекста с вкладкой, ролью, permissions, фильтрами, поиском и выбранными сущностями. Детерминированный движок строит подсказки только по уже загруженным данным пользователей, партнёров, экспертов, новостей, мероприятий, комментариев и ошибок. Команды возвращают подтверждённое количество результатов и безопасно переводят в существующий раздел. Встроенная панель поддерживает сворачивание, закрепление и изменение размера; на desktop она занимает отдельную колонку, а на компактном экране использует ограниченный плавающий режим.

**Проверка:** `npm run test:admin-assistant`, `npm run test:loki`, lint изменённых файлов и `npm run build` проходят.
## 2026-07-11 — Loki Personality Engine V1

**Задача:** Сделать Локи узнаваемым помощником АПГ с контекстными наблюдениями, тремя режимами личности и строгим запретом юмора в критических ситуациях.

**Файлы:** `src/loki/core/modules/PersonalityEngine.js`, `src/loki/core/v2/HumorEngine.js`, `src/loki/personality/*`, `src/loki/LokiProvider.jsx`, `src/loki/LokiExperience.jsx`, `src/loki/lokiState.js`, `src/loki/lokiMemory.js`, `src/loki/core/LokiCore.js`, `scripts/loki-personality-v1-test.mjs`, `package.json`, `.ai/23_LOKI_PERSONALITY_ENGINE_V1.md`, `.ai/17_CHANGELOG_AI.md`

**Что изменено:** Добавлен situation classifier, safety gate, role/screen/time-aware selection, три переключаемых режима, частотный лимит, память последних фраз и анти-повторы. Phrase packs отделены от ядра и дают 1 679 контекстных вариантов. Длительная сессия, повторные действия, первый и повторный визит могут формировать ситуативное наблюдение. Профессиональный режим полностью отключает юмор; авторизация, потеря данных, удаление, финансы, security и critical-контексты блокируются до выбора фразы.

**Проверка:** тест Personality Engine, тест Loki Core, тест Admin Assistant, lint изменённых модулей и production build проходят.
## 2026-07-11 — Анкета эксперта V2

**Задача:** Полностью перестроить публичную анкету эксперта в ИИ-импорте и подготовить её к тарифам, каталогу услуг, новым медиа, юридическому профилю и мультигороду.

**Файлы:** `src/PublicSubmitPage.jsx`, `src/components/ExpertQuestionnaire.jsx`, `src/AdminPanel.jsx`, `src/expertProfileForm.js`, `api/public-submit.js`, `server/src/routes/public-submit.js`, `scripts/expert-questionnaire-v2-test.mjs`, `package.json`, `.ai/24_EXPERT_QUESTIONNAIRE_V2.md`, `.ai/17_CHANGELOG_AI.md`

**Что изменено:** Экспертная анкета разделена на девять раскрывающихся блоков, получила индикатор заполненности, token-scoped autosave, множественные категории, форматы работы, четыре тарифа, отдельные сайт/запись, MAX, дополнительные соцсети, несколько видео с предпросмотром и четыре роли изображений. Premium-поля динамически доступны только Премиуму и Амбассадору. Город, ИНН и стоимость исключены из обязательного набора; стоимость зарезервирована под будущий каталог услуг. Vercel/Fastify analyzer и публикация draft обновлены синхронно, отсутствующие данные не генерируются.

**Проверка:** тест backend parity и тарифной схемы, lint изменённых файлов и production build проходят.

## 2026-07-11 — Cabinet Core / Личные кабинеты 2.0

**Задача:** создать фундамент личных кабинетов 2.0 без отдельной реализации кабинета партнёра и кабинета эксперта.

**Что изменено:** добавлен `src/cabinet/CabinetCorePage.jsx` — единый lazy-loaded экран кабинета. Существующие nav entrypoints `partner-cabinet` и `expert-cabinet` сохранены, но оба рендерят Cabinet Core с разным `preferredRole`. Если пользователь одновременно партнёр и эксперт, ядро показывает переключатель ролей.

**Role Engine:** добавлен `src/cabinet/CabinetRoleEngine.js`. Сейчас он определяет роли `partner`, `expert`, `owner`, `admin`, `moderator`, `editor`, поддерживает multi-role и возвращает список модулей. Новую роль можно добавить role definition-ом и role-specific modules без копирования кабинета.

**Модули:** добавлен `src/cabinet/CabinetModules.js`. Общий snapshot строит Dashboard, метрики, заполненность профиля, центр задач, аналитику, медиа, контакты, контент, отзывы, уведомления, Локи, подписку, настройки и историю. Ролевые модули: для партнёра — акции, мероприятия, будущий каталог товаров; для эксперта — услуги, опыт, запись.

**Backend contract:** `partner:profileUpdate` и `expert:profileUpdate` в Vercel/Fastify расширены под общий модуль контактов и будущие role modules: `whatsappUrl`, `email`, `address`, `hours/workingHours`, `websiteUrl`, `bookingUrl`, соцсети, медиа, услуги/опыт для эксперта. Новых endpoint не добавлено.

**Файлы:** `src/cabinet/CabinetCorePage.jsx`, `src/cabinet/CabinetRoleEngine.js`, `src/cabinet/CabinetModules.js`, `src/UserApp.jsx`, `api/user-actions.js`, `server/src/routes/user-actions.js`, `.ai/04_API.md`, `.ai/05_FRONTEND.md`, `.ai/06_BACKEND.md`, `.ai/09_BUSINESS_LOGIC.md`, `.ai/14_ROADMAP.md`, `.ai/16_DECISIONS.md`, `.ai/17_CHANGELOG_AI.md`.

**Проверка:** scoped eslint по frontend/Vercel-файлам, node smoke Role Engine + Cabinet Modules, production build. Линтер Fastify-файла отдельно всё ещё видит существующие вне текущей правки `no-undef` (`assertOwnedProfile`, `actionEventPropose`), это не связано с whitelist Cabinet Core.

## 2026-07-11 — Partnership onboarding card V2

**Задача:** Заменить невидимую/слишком низкую кнопку «Стать партнёром АПГ» полноценной карточкой вступления для партнёров и экспертов в профиле обычного пользователя.

**Файлы:** `src/ProfilePanel.jsx`, `src/UserApp.jsx`, `src/PartnershipPage.jsx`, `src/AdminPanel.jsx`, `api/public-submit.js`, `server/src/routes/public-submit.js`, `server/src/routes/partnership-application.js`, `.ai/04_API.md`, `.ai/07_ADMIN_PANEL.md`, `.ai/17_CHANGELOG_AI.md`

**Причина старой проблемы:** CTA был встроен ниже основных действий профиля и дублировался с legacy-блоком, поэтому в активном v2-профиле пользователь не видел его без прокрутки. Сценарий также открывался через один общий обработчик без явного выбора направления, из-за чего невозможно было сразу вести пользователя в партнёрскую или экспертную презентацию.

**Что изменено:** В v2-профиле после блока информации о пользователе добавлена стеклянная APG-карточка «🤝 Развивайте своё дело вместе с АПГ» с двумя крупными действиями: «🟦 Стать партнёром» и «🟨 Стать экспертом». Карточка показывается только обычным пользователям: скрыта для владельцев партнёрских/экспертных кабинетов, администраторов и owner.

**Сценарий:** Нажатие открывает отдельную презентацию выбранного направления: партнёру показываются преимущества бизнеса, ключи, возможности и тарифы `Старт/Альянс/Премиум`; эксперту — преимущества, возможности и тарифы `Практика/Амбассадор`. После кнопки «Продолжить» открывается соответствующая анкета ИИ-импорта. Экран успеха обновлён под заявку на подключение. В партнёрской анкете дефолтная категория теперь синхронизируется с состоянием формы, чтобы визуальное значение select не расходилось с валидацией.

**Локи и аналитика:** FAQ Локи расширен вопросами про выбор партнёр/эксперт, отличия, тарифы, проверку и действия после отправки. Analytics events расширены: `partnership_card_opened`, `partnership_partner_selected`, `partnership_expert_selected`, `partnership_presentation_opened`, `partnership_questionnaire_started`, `partnership_application_submitted`.

**Админка:** Фильтр модерации переименован в «Новые заявки на подключение»; условия попадания остались на `source: 'partnership-flow'`, `moderationStatus: 'new_partnership_application'` и CRM lifecycle.

**Почему теперь не повторится:** Видимость CTA централизована в `showPartnershipCard`, карточка стоит сразу после hero-профиля, а вход в сценарий передаёт явный `type` в `UserApp` и `PartnershipPage`, поэтому направление не зависит от скрытого состояния или старого нижнего блока.

**Проверка:** scoped eslint изменённых файлов, тесты `test:expert-questionnaire` и `test:admin-assistant`, production build, локальный UI smoke partner/expert flow.

## 2026-07-11 — Partnership acquisition flow V1

**Задача:** Добавить сценарий привлечения партнёров из профиля обычного пользователя без прямого открытия анкеты.

**Файлы:** `src/ProfilePanel.jsx`, `src/UserApp.jsx`, `src/PartnershipPage.jsx`, `src/AdminPanel.jsx`, `api/public-submit.js`, `server/src/routes/public-submit.js`, `server/src/routes/partnership-application.js`, `server/src/server.js`, `.ai/04_API.md`, `.ai/07_ADMIN_PANEL.md`, `.ai/17_CHANGELOG_AI.md`

**Что изменено:** В профиль добавлена заметная CTA-кнопка «🤝 Стать партнёром АПГ». Новый экран `PartnershipPage` показывает информационную страницу, преимущества, логику ключей, актуальные тарифы из `tariffConfig`, встроенную FAQ-помощь Локи, пошаговый индикатор, выбор «Бизнес / Эксперт», автосохранение анкеты и экран успешной отправки. Для заполнения используются существующие `PartnerQuestionnaire` и `ExpertQuestionnaire`, поэтому тарифная логика и будущие расширения остаются едиными с ИИ-импортом.

**Backend:** Для Vercel сценарий подключён через существующий `POST /api/public-submit` actions `track-partnership` и `partnership-submit`, чтобы не увеличивать количество serverless functions. Fastify дополнительно получил mirror-route `POST /api/partnership-application`. Backend принимает события аналитики и заявки из профиля, создаёт запись в `aiImportRequests` с `source: 'partnership-flow'`, `moderationStatus: 'new_partnership_application'`, CRM lifecycle `new_partnership_application` и пишет события в `partnershipAnalytics`.

**Админка:** В разделе «Модерация» добавлен фильтр «Новые заявки на партнёрство» с карточками заявок и переходом в «ИИ-импорт».

**Проверка:** scoped lint изменённых файлов проходит; общий lint по репозиторию остаётся заблокирован существующими ошибками вне текущего изменения.

## 2026-07-11 — Error Diagnostics Center V2

**Задача:** найти причину постоянного роста `errorLogs`, устранить стартовую ошибку и превратить раздел «Ошибки» в центр диагностики.

**Первопричина:** `actionLogCreate` безусловно использовал `collection.add()`, поэтому одинаковая ошибка после каждого запуска становилась новым документом; клиентская дедупликация жила только до перезагрузки вкладки. В текущем production build гостевой профиль дополнительно вызывал `UserApp.markLearningAction`, получал `Действие доступно только авторизованному пользователю` и записывал её при открытии профиля. Админка могла логировать неудачное чтение `errorLogs` обратно в эту же коллекцию, а ожидаемый отказ по роли для комментариев превращался в backend error.

**Что изменено:** добавлен общий Vercel/Fastify helper `server-shared/error-log.js` с нормализацией stack, SHA-256 fingerprint и транзакционным upsert. Документ хранит `stackHash`, `firstSeen`, `lastSeen`, `occurrences`, уровень, компонент, маршрут, build, окружение, связанные действия и последние 50 occurrences. Гостевые учебные действия и настройки Локи больше не отправляются в защищённый profile API; logger устанавливается один раз и отсекает Abort/cancel/ResizeObserver/extension/auth-timeout noise. News comments не логируют штатные 401/403, а админка не репортит ошибку чтения `errorLogs` саму в себя.

**Админка:** добавлены поиск, фильтры по уровню/версии/маршруту/пользователю/компоненту, сортировки по частоте/новизне/критичности/исправленным и раскрытие stack, stackHash, истории и связанных действий.

**Диагностика до исправления:** 326 документов; 150 уникальных fingerprint по `message + source + normalized stack`; 176 дубликатов. Если группировать только по `message + source`, получалось 92 группы и 234 повтора. В текущей версии три из трёх свежих записей имели один источник: `UserApp.markLearningAction`.

**Проверка:** fingerprint stability test, dry-run migration, scoped eslint и production build проходят.

## 2026-07-11 — Expert directory synchronization V3

**Задача:** синхронизировать анкету эксперта, ИИ-импорт, Firestore, админку, каталог, фильтры и Локи; исправить телефон, акцию и пропавшую категорию нового эксперта.

**Причины:** анкета и каталог использовали два несовместимых массива `EXPERT_CATEGORIES`; поэтому сохранённая у нового эксперта категория `real_estate` отсутствовала в каталоге. Телефоны сохранялись в произвольном формате и напрямую подставлялись в `tel:`. Production-проверка заявки Крутиковой Ольги подтвердила: категория и телефон дошли до Firestore, но старый каталог не знал `real_estate`; поле `offer` в заявке и документе было пустым, то есть акция для этой карточки не терялась при публикации.

**Что изменено:** `server-shared/expert-directory.js` стал единым источником 23 категорий и normalization contract. Vercel/Fastify analyzer, анкеты, AdminPanel, UserApp, ExpertsPage, общий `EntityPreviewCard`, фильтры и Loki search используют этот контракт. Неизвестная категория показывает предупреждение и блокирует публикацию. Телефон нормализуется до международного формата, а кнопка звонка использует безопасный `tel:`. Профиль показывает акцию, категории/подкатегории, услуги, опыт, стоимость, адрес, часы работы, карту и все каналы связи.

**Deep link:** устранена гонка cache/fresh data: ссылка нового эксперта больше не помечается обработанной, пока ID фактически не найден в загруженном каталоге.

**Фильтры:** единый справочник категорий выведен в активный V2-каталог; top-блок скрывается при поиске и фильтрации, поэтому выдача содержит только подходящих экспертов.

**Миграция:** `scripts/migrate-expert-directory.mjs` нормализует существующие телефоны и добавляет canonical `categories` без удаления заполненных данных.

**Проверка:** scoped eslint, Vercel/Fastify parity, category integrity, phone/tel normalization, Loki tests, Admin Assistant tests и production build.

## 2026-07-11 — AI Import Data Integrity V1 (Media + Field Validator)

**Задача:** гарантировать, что после заполнения анкеты ни одно поле, фото или видео не теряются до публикации (кейс Крутиковой Ольги: фото работ отсутствовали в опубликованной карточке).

**Диагностика по production-данным:** в заявке `aiImportRequests/NKfXsrwgFDM4JuF5R8M7` был только 1 файл (аватар, role `avatar`); фото работ и видео в заявку не дошли — потеря произошла на этапе анкеты (загрузка файлов молча отбрасывала не-изображения, файлы >8 МБ, всё сверх лимита 12 и весь пакет при сбое одной загрузки; ошибочные файлы не показывались в анкете эксперта из-за фильтра `files.filter(f => f.url)`). Галерею из 4 фото админ восстановил вручную через AdminPanel (`experts/gallery/…`, на час позже заявки). Дополнительные потери на публикации: у экспертов в галерею попадали только файлы role `gallery|photo` (без страховки как у партнёров), одиночное поле `video` эксперта обнулялось в analyze().

**Что изменено:**
- Анкеты (`PublicSubmitPage`, `PartnershipPage`, `ExpertQuestionnaire`, `PartnerQuestionnaire`): ошибки загрузки видимы (файл >8 МБ, не-изображение/видео-файл, превышение лимита, сбой сети), успешно загруженная часть пакета не теряется, файлы можно удалять; отправка блокируется, пока в списке есть файлы с ошибкой; на сервер уходит `mediaSummary` (заявлено/по ролям/сбои/видео).
- Сервер `public-submit` (Vercel + Fastify parity): одиночное `video` эксперта сливается в `videos` (лимит поднят 6→12), в каждую заявку пишется `mediaManifest` (declared/received/accepted/rejected/failedOnClient/videos + ok) — расхождение видно администратору и блокирует публикацию.
- Публикация (`aiImportDraftPatch`): галерея эксперта и партнёра теперь включает все фото, не занятые как avatar/cover/logo (dedupe); добавлены `adminComment` у партнёра/события/новости/приза, `services/cost/offer` у события, `videos` у новости, `quantityInfo`/`gallery` у приза; `adminComment` добавлен в whitelist NEWS_FIELDS.
- Новый модуль `src/aiImportValidation.js`: Media Validator (каждый файл заявки должен попасть в карточку; видео из черновика — в patch) + Data Integrity Validator (карты соответствия полей анкеты → карточки для expert/partner/event/news/prize; тарифные ограничения — предупреждение, потеря — блокер).
- Validation Center в AdminPanel: кнопка «Проверка и публикация» открывает экран с чипами (фото/видео/поля), списками проверок, manifest-предупреждениями, предпросмотром EntityPreviewCard; публикация доступна только при пройденной проверке; `publishAiImportDraft` дополнительно гейтится валидатором.
- Категории: неизвестная категория больше не тупик — в Validation Center можно выбрать существующую, создать новую или отменить. Новые категории хранятся в `config/expertCategories` (custom[]), регистрируются в едином справочнике `server-shared/expert-directory.js` (`registerCustomExpertCategories`, slugify c транслитерацией) и автоматически доступны в анкете (GET public-submit отдаёт справочник), приложении (public-data → UserApp bootstrap), админке, фильтрах ExpertsPage (CATEGORY_FILTERS перенесён в рендер), поиске и Локи — без правок кода.

**Проверка:** `.tmp-ai-import-tests.mjs` — 10 сценариев (merge видео, динамические категории, валидатор: ok/потеря фото/видео/поля/категория/manifest/тарифные предупреждения) — все проходят; production build (`vite build`) успешен.

## 2026-07-11 — Partner Cabinet Binding Integrity (кейс Татьяны)

**Задача:** business-профиль привязан к двум пользователям; у одного кабинет партнёра появился, у Татьяны — нет.

**Первопричина (production-данные):** у Татьяны три документа пользователя (VK `15065594`, TG `tg_875814883`, активный `email:gordeeva.tatyana@mail.ru`). Привязка `demo-partner-apg` попала на неактивный VK-документ (`ownerUserIds`), её email не был записан в `ownerEmails`, а активный email-документ не получил `partnerId`. Клиент дополнительно имел дефект Cabinet Loader: свежий документ пользователя читается при старте, но его `partnerId`/`partnerCabinetIds` не участвовали в определении `ownedPartner` — проверка шла по localStorage-сессии (там этих полей нет), после чтения Firestore перепроверялся только email.

**Изменения:**
- `src/utils/profileOwnership.js` (новый): единая проверка владения `profileOwnedByUser` с расширенными идентичностями (id, firebaseUid, vkId, telegramId, linkedTelegram.tgId, normalizedEmail, partnerCabinetIds + expertCabinetIds) + `buildCabinetDiagnostics`.
- `UserApp`: после чтения свежего документа пользователя владение перепроверяется по объединённой идентичности; при наличии `partnerId`/`expertId` карточка догружается напрямую даже если не опубликована в каталоге; поля привязки и роли мержатся в state `user`.
- `partner:bind-owner` (Vercel + Fastify): `collectPartnerOwnerIdentity` — привязка записывается на ВСЕ документы пользователя (email/tg/vk/uid + документы с `linkedEmail`), все идентичности и email-ы уходят в `ownerUserIds`/`ownerEmails` партнёра.
- Мульти-роли: кнопка «Администрирование» в профиле теперь видна и для `super_admin`; кабинеты партнёра/эксперта/админа отображаются одновременно (независимые состояния).
- Диагностика: пункт «Диагностика профиля» в настройках — UID, Firebase UID, email, роли, Partner/Expert ID, все идентичности профиля, доступность каждого кабинета и причины скрытия.
- Миграция данных: `demo-partner-apg` получил все идентичности Татьяны в `ownerUserIds` + её email в `ownerEmails`; документы `email:gordeeva.tatyana@mail.ru` и `tg_875814883` получили `partnerId`/`partnerCabinetIds`/`partnerCabinetEnabled` (роль super_admin сохранена).

**Проверка:** `.tmp-ownership-tests.mjs` — 10 сценариев (воспроизведение бага,совпадения по email/tg/vk/cabinetIds, повторная привязка, несколько бизнесов, партнёр+эксперт одновременно, диагностика) — проходят; production build успешен.

## 2026-07-12 — Loki Operating Workspace V1

**Задача:** сделать Локи центром Desktop Workspace: не чатом, не виджетом и не правой заглушкой, а началом рабочего дня и постоянной AI Workspace-областью.

**Что изменено:** Dashboard теперь открывается через `LokiWorkspaceHero`: Локи приветствует пользователя, собирает briefing по реальным данным Workspace, показывает уведомления, новости, мероприятия, заполненность профиля и рекомендации. Добавлен `AIActionBoard` с рабочими действиями: новости, отзывы, мероприятия, заявки, фотографии.

**AI Workspace:** прежняя правая колонка заменена на `AIWorkspacePanel`. Она содержит Локи, Today/briefing, блок “Что требует внимания”, контекстные рекомендации, историю, чат и быстрые действия. Контекст меняется по активному разделу: Dashboard, Business Hub, Контент, Новости, Мероприятия, Партнёры, Эксперты, CRM, Календарь, Настройки.

**Навигация Локи:** `⌘L`, пункт меню “Локи”, контекстное меню и CTA “Спросить Локи” больше не вызывают `onOpenPanel('loki')` и не уводят пользователя из Workspace в отдельный экран. Все ответы остаются внутри `AIWorkspacePanel`.

**Архитектура:** добавлены helpers `getWorkspaceContext`, `buildLokiBriefing`, `buildContextualReply`. Они готовят основу для будущего управления CRM, контентом, мероприятиями, статистикой и рекомендациями без создания второго desktop-layout.

**Документация:** обновлены `docs/desktop-workspace.md`, `docs/desktop-ux.md`, `.ai/05_FRONTEND.md`.

**Проверка:** production build успешен.

## 2026-07-12 — APG Design System 2.0

**Задача:** визуально объединить User Mode, Desktop Workspace и Business Hub, чтобы переключение режима не ощущалось переходом в другой продукт.

**Дизайн-аудит:** User Mode был эмоциональнее, светлее и дороже за счёт hero, мягкой glass-пластики и воздуха. Workspace и Business Hub выглядели плотнее, темнее и местами как классическая рабочая админка: одинаковый вес карточек, мало визуальных пауз, правая AI Workspace-область воспринималась как список.

**Что изменено:** `APG2_PROFILE` расширен до общего DS 2.0 foundation: `workspaceBg`, `heroSurface`, `quietSurface`, `rhythm`. Общий APG2 background и glass стали теплее и мягче, чтобы Workspace перестал выглядеть как отдельный тёмный продукт.

**User Mode:** `HomePanelV2` переведён на `APG2_PROFILE` для базовых `pageBg`, text, glass, hero и gold tokens. Его эмоциональный стиль сохранён, но он больше не живёт на отдельном визуальном наборе.

**Workspace:** hero стал крупнее и спокойнее, добавлен визуальный персонаж Локи со статусом; фон Workspace переведён на `workspaceBg`; header/sidebar/status bar используют `quietSurface`; карточки получили уровни `gold`, `default`, `quiet`; увеличен ритм и воздух между группами.

**AI Workspace:** правая колонка переработана из списка панелей в decision center: аватар Локи, состояние, “следующее лучшее действие”, срез сигналов, briefing, решения, компактный диалог и быстрые действия.

**Business Hub:** dashboard начинается с крупного смыслового блока профиля и следующих шагов, метрики перенесены ниже как supporting layer; табы, строки и action cards используют общие quiet/hero surfaces.

**Документация:** обновлены `.ai/11_DESIGN_RULES.md` и `docs/desktop-ux.md`.

**Проверка:** production build успешен.

## 2026-07-12 — Desktop Workspace Technical Stabilization

**Задача:** стабилизировать production-компоновку Desktop Workspace: убрать перекрытия header/sidebar/content/AI, обрезание навигации, horizontal overflow и emoji/fallback Локи.

**Первопричины:** Desktop Workspace использовал независимые `sticky top` для header/sidebar/AI и жёсткую трёхколоночную сетку `sidebar + content + 390px AI` на всех desktop-размерах. На 1024–1180px это сжимало content до нечитаемой ширины, правая панель визуально заходила на центр, а sidebar получал высоту через приблизительный viewport-minus-top и мог обрезать нижние пункты. Внутри Workspace оставались случайные z-index `13000/14000`, а Локи в Workspace/Business Hub отображался emoji `🦊`.

**Что изменено:** добавлен `src/workspace/WorkspaceLayoutEngine.js` с единым `WORKSPACE_LAYOUT`, `WORKSPACE_Z` и `getDesktopWorkspaceLayoutPlan()`. Header встроен в основную grid-структуру как отдельная строка. Рабочая область стала единым grid `sidebar | content | ai`, root Workspace получил `overflow: hidden`, а scroll перенесён только внутрь sidebar/content/AI. На desktop уже 1180px AI Workspace переходит в drawer, sidebar принудительно collapsed до 1366px, content получает приоритет.

**Sidebar:** стал независимой вертикальной областью с внутренним scroll; collapsed tooltip вынесен за scroll-контейнер, чтобы не обрезаться overflow-ом.

**AI Workspace:** перестал быть sticky-слоем с top-offset; это самостоятельная колонка с внутренним scroll, а на узких desktop — drawer. Сообщения Локи остаются только внутри AI Workspace.

**Z-index:** добавлен workspace scale `base/content/sticky/sidebar/header/drawer/popover/modal`; `WorkspaceShortcutOverlay`, context menu и общие `WorkspaceContextPanel/FloatingPanels` переведены off случайных `9990/12000/13000/14000`.

**Локи:** добавлен общий `src/loki/LokiIdentity.jsx`, который использует реальный asset `/loki.png`. Emoji `🦊` удалён из Workspace и Business Hub как визуальный fallback.

**Visual regression smoke:** добавлен `scripts/desktop-workspace-layout-regression.mjs` и npm script `test:workspace-layout`. Проверяются 1024×768, 1180×820, 1280×800, 1366×768, 1440×900, 1512×982, 1728×1117, 1920×1080: отсутствие horizontal overflow, readable content width, drawer/collapse rules, z-index order и наличие `public/loki.png`.

**Документация:** обновлён `docs/desktop-workspace.md`.

**Проверка:** `npm run test:workspace-layout`, `workspace-core-test`, `desktop-workspace-test`, `business-hub-test`, production build успешны.

## 2026-07-12 — Desktop Workspace Navigation & Loki Polish

**Задача:** довести компоновку Desktop Workspace до production-качества: Sidebar должен быть полноценной колонкой Workspace, collapsed-режим — не временной заглушкой, а Локи — визуальным интеллектом платформы, а не пользовательской аватаркой.

**Layout:** `WORKSPACE_LAYOUT` обновлён под более устойчивую grid-композицию: expanded Sidebar 264px, collapsed Sidebar 88px, минимальная читаемая content-область 430px. Проверяются desktop-размеры 1024, 1180, 1280, 1366, 1440, 1512, 1728, 1920 без horizontal overflow и без пересечения Hero с AI Workspace.

**Collapsed Sidebar:** переработан в полноценный icon rail: круглые кнопки одинакового размера, активная подсветка, hover/focus-анимации, tooltip справа по позиции пункта, групповые разделители, корректный внутренний scroll. Это убирает ощущение overlay/заглушки и делает навигацию частью общей grid-системы.

**Локи:** `LokiIdentity` получил состояния `thinking`, `answering`, `listening`, `waiting`, `recommending`, `attention`, `busy`, визуальную орбиту, статусный индикатор и мягкую анимацию. В Workspace и Business Hub Локи теперь выглядит как отдельный интеллект АПГ, а не как аватар пользователя.

**AI Workspace:** правая область усилена как рабочее место Локи: добавлены статус, контекст, последнее действие, следующее лучшее действие, рабочая память, briefing, решения и компактная история. Текст диалога защищён от overflow длинными строками.

**Smoke:** `desktop-workspace-layout-regression` расширен проверкой ширины icon rail и наличия новых состояний `LokiIdentity`.

## 2026-07-12 — Desktop Workspace Visual Consistency

**Задача:** финально унифицировать Desktop Workspace с User Mode: Workspace должен использовать те же визуальные компоненты АПГ, а не выглядеть отдельным приложением.

**Единый Локи:** `LokiIdentity` стал единственным визуальным компонентом Локи для User Mode, Workspace, Business Hub, AI Workspace, Loki Home, Loki Experience, Assistant Mini App и кабинетов. Добавлен compact-режим `showText={false}` и состояние `speaking`. Прямые `url(/loki.png)` и emoji-аватары Локи удалены из визуальных компонентов.

**Новости:** Workspace больше не рисует отдельную карточку новости через локальный `DataSection`. `NewsCard` экспортирован из `NewsPage` и используется в Desktop Workspace для dashboard-блока и раздела “Новости”. Сохраняются изображения, типографика, badges, мета и переносы из пользовательского режима.

**Мероприятия:** `EventPosterCard` экспортирован из `EventsPage` и используется в Desktop Workspace для dashboard-блока и раздела “Мероприятия”. Даты, изображения, место, переносы и высоты карточек теперь идут через единый live-компонент.

**Навигация:** Sidebar уменьшен до 232px в раскрытом режиме и 76px в collapsed-режиме. Icon rail сохранён как законченный продукт: круглые кнопки, hover/focus, active state, tooltip и группы, но занимает меньше полезной площади Workspace.

**Regression smoke:** `desktop-workspace-layout-regression` дополнительно проверяет, что визуальные места Локи не используют прямую картинку/emoji и что Desktop Workspace переиспользует `NewsCard`/`EventPosterCard`.

## 2026-07-12 — Restore Canonical Loki Visual

**Задача:** срочно восстановить правильный образ Локи после унификации `LokiIdentity`, не откатывая архитектуру единого компонента.

**Первопричина:** в `d210bf91` каноническим стал `LokiIdentity`, но внутри он отображал `public/loki.png` как обычный `<img>` с полным квадратным постером. До унификации правильный Локи показывался в `LokiAssistant`, `LokiExperience` и `LokiPage` как crop из того же asset через `backgroundImage: url(/loki.png)`, `backgroundSize: 285%`, `backgroundPosition: 50% 23%`. Поэтому неправильным был не файл, а способ отображения.

**Исправление:** `LokiIdentity` теперь использует канонический asset `/loki.png` только через сохранённый исторический crop (`285%`, `50% 23%`) и больше не рендерит полный постер через `<img>`. Состояния и единая архитектура сохранены.

**Защита:** `desktop-workspace-layout-regression` проверяет наличие `LOKI_CANONICAL_ASSET`, канонический crop, отсутствие `<img>` в `LokiIdentity`, существование `public/loki.png`, отсутствие прямых альтернативных Loki-изображений/emoji в основных визуальных экранах и использование единого `LokiIdentity`.

## 2026-07-12 — Identity Core: перенос данных при слиянии + фикс tel: (кейс «16 → 9»)

**Проблема №2 (критическая):** после входа по email Identity Core выбирал каноническим ПУСТОЙ tg-документ (штраф -10 за префикс `email:` в userScore), помечал документ с реальными данными `legacy_linked` и НЕ переносил данные. Пользователь оказывался в другом состоянии: ключи 16 → 9, рефералы 2 → 0, «основной способ входа» становился Telegram. Пострадали: daria_samarina@mail.ru (email-док: 16 ключей, 2 реферала → tg_1424650385: 9 ключей) и mrtoredo88@mail.ru (15 ключей на legacy-доке). Жалоба поступила от имени Ольги Крутиковой, но её собственный документ (tg_1670282567, 21 ключ, 1 реферал) един и цел — цифры 16→9/2→0 в точности совпадают с аккаунтом Дарьи.

**Проблема №1:** кнопка «Позвонить» у экспертов. Данные целы по всей цепочке (Firestore → public-data → normalizeExpertRecord → telHref); ломался последний шаг: `openUrl` отправлял `tel:` в `VKWebAppOpenLink`, который поддерживает только https и молча «проглатывает» такие ссылки в нативном VK WebView (catch не срабатывает → fallback не выполняется). Теперь `tel:`/`mailto:` открываются синхронным anchor-кликом (нативный обработчик WebView/браузера).

**Изменения identityCore.js:**
- `userScore`: убран штраф за `email:`; добавлены continuity-буст уже канонического документа (+3000), data-richness (до +2500 за ключи/рефералов/избранное/задания/сканы), запрет на переизбрание опустошённых legacy (-5000 за mergedInto/dataMigratedInto), admin-буст поднят до 10000.
- Новое: `migrateLegacyUserData` — идемпотентный транзакционный перенос в Canonical User: ключи/билеты/репутация/рефералы суммируются, избранное/задания/сканы/события объединяются, streak/даты — максимум, ранняя дата регистрации сохраняется, referredBy-указатели приглашённых перебиваются на canonical; legacy-документ обнуляется и остаётся ссылкой (canonicalUserId/mergedInto/dataMigratedInto); аудит в `identityMerges` со снапшотом до переноса.
- `linkLegacyDocs` теперь выполняет перенос, а не только маркировку.
- `buildIdentityDiagnostics` следует указателю canonicalUserId у прямого документа и подтягивает email-кандидатов — вход через Telegram по legacy-доку приводит к одному Canonical User.

**Миграция:** `scripts/identity-repair.mjs` (постоянный, с --dry-run) — нашёл и перенёс оба разнесённых аккаунта: Дарья теперь 25 ключей (16+9), 2 реферала на tg_1424650385; mrtoredo88 — 17 ключей. Повторный прогон: «данных не найдено».

**Regression-тесты:** `npm run test:identity` (scripts/identity-core-test.mjs) — постоянный кейс «16 → 9» + сценарии: только Email, только Telegram, Email+Telegram, Email+VK, Partner+Expert; проверяются: единый canonical при любом способе входа и порядке кандидатов, сумма ключей при слиянии в обе стороны, перенос рефералов, объединение ролей/кабинетов без понижения, идемпотентность, запрет переизбрания опустошённого legacy, отсутствие нового профиля. Запускать при каждом изменении Identity Core.

**Live-проверка на production:** email-вход ×2 → canonical tg_1424650385, 25 ключей, 2 реферала (стабильно); tg-вход и legacy-док ведут к тому же canonical; Ольга — canonical tg_1670282567, 21 ключ; количество документов users не изменилось (102/102).

## 2026-07-12 — Content Lifecycle: восстановление публичности карточки Ольги + regression-аудит

**Причина исчезновения:** карточка `experts/GmocLuICfZAEwyKE14xR` создана ИИ-импортом 11.07 со `status: 'draft', active: false`; админ включил `active: true`, не меняя status (старый каталог смотрел только на active — карточка была публичной). После внедрения Content Lifecycle `status` стал главнее `active` → normalizeContentStatus вернул draft, карточка выпала из публичной выдачи. Identity Core не при чём.

**Восстановление:** `scripts/content-lifecycle-repair.mjs` (постоянный, с --dry-run) — аудит всех коллекций «публично по старым правилам vs по lifecycle». Результат аудита: партнёры 16/16, события 3/3, новости 37/37, призы 17/17 — без потерь; **единственная потерянная карточка во всей базе — эксперт Ольги**. Восстановлена через buildLifecyclePatch(published) с записью в lifecycleHistory. Данные карточки не тронуты: телефон, галерея 4 фото, Telegram, категория real_estate, услуги, описание, акция («Скидка 30% на CashFlow») — на месте; telHref генерируется.

**Защита от первопричины:** в `entity:update` (admin-actions) добавлен lifecycle-мост — если админ ставит `active: true` карточке в статусе draft/moderation/scheduled без явного статуса, карточка автоматически публикуется (buildLifecyclePatch published c причиной в истории). Ловушка «active включён, status забыт» больше невозможна.

**Полное восстановление пользователя:** карточка эксперта привязана к Canonical User `tg_1670282567` (ownerId/ownerUserIds/ownerEmails на карточке; expertId/expertCabinetIds/role: expert на пользователе) — кабинет эксперта виден в профиле/Workspace/Business Hub; ключи 21 и реферал на месте.

**Постоянный regression-тест:** `npm run test:content-lifecycle` — кейс карточки Ольги (active:true + status:draft: воспроизведение, обнаружение repair-правилом, восстановление без потери данных) + инварианты: published не понижается молча (только явный nextStatus с причиной в истории), неизвестный статус не превращает published в draft, lifecycle.status — источник истины. Сводный `npm run test:core` = Identity Core + Content Lifecycle + Business Hub + Workspace — запускать при каждом изменении этих подсистем.

## 2026-07-12 — Расхождение каналов раздачи: «после email-входа открывается старая версия»

**Первопричина:** каналы раздачи фронтенда разошлись. myapg.ru и Yandex Storage отдают актуальную сборку, а **VK-хостинг мини-аппа (app_id 54601851) остался на v4.4.2** — деплой шёл только через ./deploy-frontend.sh (storage), `vk-miniapps-deploy` не запускался. Доказательство: adminActivity Татьяны от 11.07 записана с `appVersion: v4.4.2`. Пользователь до входа видит свежую версию (браузер/ссылка на myapg.ru), а «приложение» открывает VK Mini App со старым бандлом: старая главная, старый клиентский фильтр новостей (без lifecycle — видна «архивная» новость про баню), старая навигация без нижнего таббара новой версии. Identity Core у Татьяны в порядке: canonical email:gordeeva.tatyana@mail.ru, ключи и роли на месте, ошибок входа в errorLogs нет. Примечание: новость «про баню» в Firestore вообще не архивирована (нет status/archived) — публична и в новой выдаче; «архив» — впечатление от старого интерфейса.

**Изменения:**
- `deploy-frontend.sh` теперь деплоит и VK-хостинг (`vk-miniapps-deploy`, токен из .env.deploy.local) — каналы больше не могут разойтись; при отсутствии токена — громкое предупреждение.
- `scripts/release-parity-test.mjs` (`npm run test:release-parity`) — постоянный regression: version.json всех каналов идентичен (опция --expect-head сверяет с git HEAD), публичная выдача public-data не содержит архивных/удалённых объектов и проходит lifecycle-фильтр.
- Диагностический оверлей в приложении (кнопка ⌗, только owner/super_admin): App version, Canonical User, Active Profile, роли, Navigation (+таббар), Layout (User Mode/Workspace), источник public-data (backend/fallback по коллекциям), возраст кэша, версия Content Lifecycle, feature flags.
- `fetchPublicBootstrap`/`loadPublicSnap` фиксируют источник данных (backend / firestore-fallback) для диагностики.

**Деплой:** VK-хостинг обновлён до актуальной сборки — во всех каналах одна версия.
# 2026-07-12 — Role Engine V1

- Создан единый `server-shared/role-engine.js` и frontend re-export `src/roleEngine.js`.
- Зафиксированы канонические роли, permissions и capabilities для User Mode, Workspace, Business Hub, кабинетов и админки.
- Убрана долгосрочная зависимость от workaround `super_admin → owner`: `super_admin` сохраняет собственную роль и получает доступ через capabilities.
- Переведены ключевые точки доступа: Identity Core, Workspace navigation/feature flags, Business Hub, Cabinet Role Engine, UserApp/ProfilePanel diagnostics, admin login/security/actions, email auth claims и owner-only user actions.
- Добавлен контрактный тест `scripts/role-engine-test.mjs`; `npm run test:roles` включён в `npm run test:core`.
- Документация: `docs/role-engine-v1.md`.

# 2026-07-12 — PWA Update Manager V1

- Создан единый `src/pwa/PwaUpdateManager.js` для регистрации Service Worker, чтения `version.json`, сравнения версий, очистки/migration cache, recovery reload и диагностики.
- `main.jsx` запускает PWA Update Manager до React render; старый update flow из `App.jsx` удалён.
- `UserApp` теперь подписывается на диагностику Update Manager вместо прямых запросов к Service Worker/version.json.
- `ErrorBoundary`, `errorLogger`, `diagnostics` и `userApi` больше не управляют версией/cache самостоятельно.
- `public/sw.js` перестал очищать Cache Storage на install/activate и выполняет очистку только по команде менеджера.
- Добавлен regression test `scripts/pwa-update-manager-test.mjs`; `npm run test:pwa-update` включён в `npm run test:core`.
- Документация: `docs/pwa-update-manager-v1.md`.

# 2026-07-12 — Desktop Home V5 Information Architecture

- Перестроена desktop-главная `HomePanelV2` вокруг пользовательских сценариев, а не вокруг dashboard-сетки разделов.
- Первый экран: Hero + компактный Локи-гид; удалены количественные карточки партнёров/экспертов/мероприятий/новостей/пользователей.
- Второй экран теперь ведёт сверху вниз: `Сегодня в АПГ` → `Главная новость дня` → `Афиша` → `Локи рекомендует` → `Популярные партнёры` → `Эксперты` → `Продолжить` → `Рядом`.
- Убрана постоянная правая колонка; Локи перенесён в самостоятельный смысловой блок страницы.
- Минимизированы повторы: афиша берёт следующие события после главного, а подборка Локи по возможности использует следующие новости/акции/события.
- Проверки: `npm run test:core`, `npm run build`.

# 2026-07-12 — Premium Splash Screen / Loading Experience

- Полностью заменён старый постерный Splash Screen (`splash-v43.png` в мобильной рамке) на единый full-viewport loading experience в `src/SplashScreen.jsx`.
- Новый Splash использует существующий логотип АПГ, тёмный графитово-индиговый живой фон, фиолетово-золотое свечение, минимальный текст и кастомную анимированную progress-line без HTML progress.
- Единый `SplashScreen` подключён как главный загрузочный экран `UserApp` и как общий Suspense fallback в `App.jsx`/`UserApp`, чтобы Web/PWA/Desktop/miniapp surfaces не показывали разные loader-стили.
- Сохранён safety max-timeout загрузки: если данные долго не готовы, splash всё равно мягко закрывается; при readiness выполняется завершение progress → glow → fade out.
- Проверки: `npm run test:core`, `npm run build`, локальная visual-check 1512×982 и 390×844: старый постер не используется, logo/progress присутствуют, horizontal overflow и JS errors отсутствуют.

# 2026-07-12 — Desktop Home Final UI Polish

- Удалён лишний portal-переключатель `Пользовательский режим / Workspace`; переход в Workspace остаётся через единственную кнопку в header.
- Header search превращён из пустой капсулы в полноценное компактное поле `Поиск по АПГ...`; nav-chip больше не клиппится на desktop.
- `Главная новость дня` упрощена до композиции: большая главная карточка + две компактные боковые карточки, чтобы усилить визуальную иерархию.
- Карточки партнёров и экспертов выровнены по padding/line-height; у экспертов имя ограничено двумя строками, специализация — одной строкой.
- Убран большой нижний desktop padding после удаления «Быстрого доступа»; последний ряд теперь естественно завершает страницу.
- Проверки: `npm run build`, visual-check 1366×768 / 1440×900 / 1512×982 / 1920×1080: portal отсутствует, поиск отображается, overflow и JS errors отсутствуют.

# 2026-07-12 — Desktop Home Evolution: профиль вместо верхнего блока Локи

- Desktop User Mode больше не ограничивается внешним wrapper `1240px` в `UserApp`; на desktop ширина раскрывается до `100%`, а `HomePanelV2` сам управляет max-width и боковыми отступами.
- Header Desktop Home очищен: удалены поле поиска, avatar-кнопка и весь связанный search-state/search-results код; в правой части остаются уведомления и Workspace.
- Верхняя правая карточка первого экрана заменена с Локи-рекомендаций на `Мой профиль`: аватар, имя, уровень, ключи, streak, достижения, посещённые партнёры, события, приглашённые друзья, progress bar и кнопки `Профиль / Достижения / Награды`.
- Локи не удалён из приложения: он остаётся плавающим помощником, но больше не дублируется как главный информационный блок Desktop Home.
- Проверки: `npm run test:core`, `npm run build`, visual-check 1366×768 / 1440×900 / 1512×982 / 1920×1080: поиск отсутствует, header avatar отсутствует, профильная карточка и её кнопки видны, Workspace/уведомления видны, horizontal overflow и JS errors отсутствуют.

# 2026-07-12 — Desktop Home Final Layout Optimization

- Правая desktop-колонка унифицирована через `rightRailColumn`: `Мой профиль`, `Афиша` и `Рядом` теперь имеют одинаковую ширину и совпадающие левые/правые границы на всех desktop breakpoints.
- Освобождённая ширина перераспределена в центральную колонку: `Главная новость дня` и `Эксперты` стали заметно шире, при этом высоты секций не увеличены.
- `Сегодня в АПГ` и `Популярные партнёры` оставлены как левая supporting-колонка; центральная часть стала информационным центром страницы, правая — персональным rail пользователя.
- Проверки: `npm run build`, visual-check 1366×768 / 1440×900 / 1512×982 / 1920×1080: right rail aligned, search отсутствует, Loki-блок не дублируется, horizontal overflow и JS errors отсутствуют.

# 2026-07-13 — Context Dialogs V1

- Создан реестр контекстных диалогов `server-shared/context-dialogs.js`: `partner`, `expert`, `event`, `promotion`, а также подготовленные будущие типы `booking`, `review`, `order`, `support`.
- Добавлены серверные действия `dialog:open`, `dialog:message`, `dialog:read`, `dialog:typing`, `dialog:aiAssist` через существующий `userAction` без прямой записи клиента в общую коллекцию.
- Диалоги хранят структурированный контекст объекта и детерминированный ID `user + type + objectId`, поэтому повторное нажатие «Задать вопрос» открывает тот же диалог.
- Реализован экран `ContextDialogsPage`: список диалогов, закреплённая карточка объекта, realtime-сообщения из пользовательских зеркал, unread/read, typing, статусы доставки, фото-вложения малого размера и режим «ИИ помогает отвечать».
- Кнопка «Задать вопрос» подключена к карточкам партнёра, эксперта, мероприятия и акции; кабинет партнёра/эксперта получил модуль «Диалоги».
- Локи получает контекст диалога и умеет отвечать на простые вопросы по данным карточки: график, адрес, телефон, дата.
- Добавлен контрактный тест `scripts/context-dialogs-test.mjs`; `npm run test:core` расширен новым тестом.

# 2026-07-13 — Workspace Dialogs Navigation

- Раздел `Диалоги` поднят в основную навигацию Desktop Workspace: теперь он находится третьим пунктом после `Рабочий стол` и `Мероприятия`.
- Левое меню Workspace переведено на полную доступную высоту окна с учетом safe-area; прокручивается только список пунктов, верхняя часть и профиль остаются закрепленными.
- Для `Диалоги` добавлены иконка сообщений, активное состояние, бейдж непрочитанных сообщений и мягкая pulse-анимация при наличии входящих.
- В Workspace добавлен отдельный центр `dialogs` с метриками, задачами и быстрым переходом к полноценным контекстным диалогам.
- В обычном Кабинете `Диалоги` подняты в верхнюю сетку быстрых модулей и в начало списка модулей, сразу после `Дашборд`.

# 2026-07-13 — Context Dialog Notifications

- Контекстные диалоги подключены к существующей системе уведомлений: каждое новое сообщение создает адресное уведомление категории `messages` с типом `contextDialogMessage`.
- Push для диалогов использует Web Push/FCM подписки пользователя, общий service worker и deep link `/dialogs?dialogId=...`, чтобы открывать конкретную переписку.
- Добавлена защита от дублей: на пару `получатель + диалог` используется стабильная запись уведомления, повторные сообщения агрегируются через `messageCount`, а push throttling не спамит серией уведомлений.
- `dialog:read` сбрасывает unread и помечает уведомление прочитанным только для выбранного диалога; остальные диалоги остаются непрочитанными.
- Добавлена защита от отправки самому себе, активному открытому диалогу, заблокированным/архивным аккаунтам и пользователям с отключенными message-уведомлениями.
- Центр уведомлений получил категорию `Сообщения`, прямое открытие конкретного диалога и отображение `body/text/preview`; PWA app badge синхронизируется с общим unread.

# 2026-07-13 — Online Booking V1

- Добавлен универсальный booking layer `server-shared/booking.js`: статусы записей, услуги, специалисты, даты, слоты, профиль записи и контекст диалога.
- Создан пользовательский сценарий `BookingFlow`: выбор услуги, специалиста, даты, времени, комментарий и подтверждение.
- Серверное действие `booking:create` создаёт запись в `bookings`, зеркала в `users/{id}/bookings`, контекстный диалог `type: booking`, внутреннее уведомление владельцу и best-effort push.
- Карточки партнёров и экспертов получили кнопку `📅 Записаться` через общий flow, если профиль поддерживает онлайн-запись; внешняя `bookingUrl` сохранена как fallback.
- Профиль пользователя получил блок `Мои записи` с будущими, прошедшими и отменёнными записями и быстрым открытием диалога.
- Кабинет партнёра/эксперта получил модуль `Запись`: включение онлайн-записи, базовые интервалы и обзор услуг/специалистов.
- Локи/Intelligence Context получает `bookings`, чтобы записи стали частью персонального состояния пользователя.

# 2026-07-14 — Unified User Journey for Meetings

- Встречи связаны с существующей экономикой АПГ: `booking:complete` теперь идемпотентно фиксирует подтверждённый визит, начисляет ключи/репутацию по economy rules, обновляет `visitCounts`, штамп-прогресс, activity и provider `bookingStats`.
- В `bookings/{id}.journey` добавлен post-visit контекст: `rewardedAt`, `keysAwarded`, `reputationAwarded`, `stampAwarded`, `stampProgress`, `reviewPromptAvailable`, `reviewPublishedAt`, `nextSteps`.
- Контекстный диалог встречи получает post-visit summary и системные события о штампе, ключах и возможности оставить отзыв.
- Профиль пользователя в существующем блоке `Мои записи` показывает начисления после завершённой встречи и действие `Оставить отзыв`, которое открывает карточку партнёра с формой отзыва и передаёт `bookingId`.
- `review:partner` / `review:expert` при наличии `bookingId` закрывают review-step связанной встречи, обновляют зеркала записи, диалог и аналитику владельца.
- Кабинет партнёра/эксперта дополнил модуль `Встречи` компактной journey-аналитикой: завершено, ключи, штампы, отзывы.
- Обновлены контрактные тесты `scripts/booking-test.mjs`.

# 2026-07-14 — Post-Visit Moment

- Добавлен единый экран “Спасибо за визит” после завершённой встречи: Glass UI, карточка партнёра/эксперта, дата/услуга, ключи, баланс, штамп-карта, достижение, отзыв, Локи-сопровождение и повторная запись.
- Экран показывается автоматически при следующем входе/открытии приложения для `completed` booking с `journey.rewardedAt` и `reviewPromptAvailable`; повторный показ защищён localStorage-ключом на пользователя и booking.
- Низкая оценка 1–3 сначала предлагает написать партнёру/эксперту в контекстный диалог, но оставляет возможность опубликованного отзыва.
- Единый push после `booking:complete` теперь говорит “Спасибо за посещение …” и не создаёт серию отдельных уведомлений по ключам/штампам.
- Добавлено серверное действие `booking:moment` и коллекция `bookingMomentAnalytics` для событий `opened`, `review_started`, `review_submitted`, `dialog_clicked`, `rebook_clicked`, `dismissed`.
- Shared-helper `buildPostVisitMomentState` добавлен в `server-shared/booking.js` и покрыт `scripts/booking-test.mjs`.

# 2026-07-14 — Workspace Events Center

- Раздел `Мероприятия` в Desktop Workspace заменён на полноценный рабочий центр профиля: KPI, поиск, фильтры статусов/дат, список, календарь месяц/неделя/день и правая панель ближайших событий.
- Добавлен shared-layer `server-shared/workspace-events.js`: единые статусы, фильтрация своих событий, проверка конфликтов интервалов, дублирование без служебных полей и статистики.
- Добавлены owner-safe серверные действия `workspace:eventCreate`, `workspace:eventUpdate`, `workspace:eventSubmit`, `workspace:eventArchive`, `workspace:eventDelete`, `workspace:eventDuplicate`; все проверяют владение `partnerId/expertId` на сервере.
- Для опубликованных событий правки из Workspace сохраняются как `pendingWorkspacePatch` и отправляются на модерацию, не меняя публичную карточку до админского решения.
- Редактор мероприятий поддерживает обложку через существующий `PhotoUpload`, markdown-описание, autosave, локальный draft в `localStorage`, Cmd/Ctrl+S, предупреждения о прошедшей дате и пересечениях.
- Старое действие `event:propose` оставлено совместимым с новым workspace-layer, чтобы кабинет партнёра/эксперта продолжал отправлять предложения на модерацию.
- `scripts/workspace-core-test.mjs` расширен проверками партнёр/эксперт ownership, статусов, архивов, прошедших событий, конфликтов и безопасного дублирования.

# 2026-07-14 — Workspace Meetings CRM

- Раздел `Встречи` в Desktop Workspace переведён на CRM-экран: KPI на сегодня/завтра/неделю, ожидания, переносы, завершения, неявки и отмены, поиск по клиенту/контактам/услуге, фильтры и создание встречи вручную.
- Добавлен shared-layer `server-shared/workspace-bookings.js`: источники записей, CRM KPI, поиск, приватные заметки, история изменений, свободные интервалы и конфликт слотов поверх существующего `booking.js`.
- `booking.js` получил финальный статус `archived`, чтобы архив встреч был частью единой модели статусов.
- Backend actions расширены без нового API: `booking:manualCreate`, `booking:workspaceUpdate`, `booking:archive`; все используют существующую проверку ownership через `actorOwnsProfile` / `assertBookingAccess`.
- CRM-карточка встречи показывает основную информацию, контакты, источник, историю статусов, внутренние заметки с autosave, связанные диалоги, связь с мероприятием и предыдущие встречи клиента.
- Быстрые действия включают подтверждение, перенос, завершение, неявку, отмену, архив, контактные каналы и открытие существующего контекстного диалога.
- `scripts/booking-test.mjs` и `scripts/workspace-core-test.mjs` расширены проверками CRM helper layer, архива, источников, заметок, конфликтов, свободных интервалов и подключения нового Workspace-компонента.
