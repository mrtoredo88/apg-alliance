# 04 API

## Общее

Все backend endpoint работают через единый Fastify API в Yandex Serverless Containers:
- `server/src/routes/*.js` — единственная runtime-реализация API
- `api/` удалён как legacy Vercel Serverless слой

Frontend всегда строит backend URL через `API_BASE_URL`. По умолчанию используется production Yandex Container:
`https://bbangqkf2d4pa9855lu0.containers.yandexcloud.net`.
`VITE_API_BASE_URL` допускается только как явный override для стенда/локальной проверки, но пустое значение больше не переключает приложение на Vercel.

Лимит тела запроса: **8 MB**.

---

## GET /api/vk-news

**Назначение:** Получить последние посты из VK-группы АПГ для ленты новостей.

**Метод:** GET  
**Auth:** нет  
**Cache:** 3 минуты CDN/API, stale-while-revalidate 15 минут

**Query params:**
- `?health` — probe-запрос, возвращает `{ ok: true }`
- `?count=20` — количество постов стены, максимум 50

**Response 200:**
```json
{
  "posts": [
    {
      "id": "vk_229980067_1234",
      "title": "Первые 40 символов текста поста...",
      "text": "Полный текст поста",
      "imageUrl": "https://...",
      "photos": ["https://..."],
      "gallery": ["https://..."],
      "photoItems": [{ "url": "https://...", "width": 2560, "height": 1707 }],
      "videos": [
        {
          "platform": "vk",
          "videoId": "-229980067_123",
          "embedUrl": "https://vk.com/video_ext.php?oid=-229980067&id=123&hd=2",
          "thumbnailUrl": "https://..."
        }
      ],
      "links": [{ "url": "https://...", "title": "..." }],
      "docs": [{ "url": "https://...", "title": "...", "ext": "pdf" }],
      "stats": { "likes": 0, "comments": 0, "reposts": 0, "views": 0 },
      "emoji": "📰",
      "createdAt": 1719000000000,
      "publishedAt": 1719000000000,
      "linkUrl": "https://vk.com/wall-229980067_1234",
      "linkLabel": "Открыть оригинал в ВКонтакте",
      "source": "vk",
      "category": "apg"
    }
  ]
}
```

**Логика:** `wall.get` для `owner_id: -229980067`, `filter=owner`. Посты без текста и вложений пропускаются. Все фото, видео, ссылки, документы, хэштеги и показатели активности нормализуются в структуру новости АПГ. Для фото выбирается версия с максимальной площадью изображения; вместе с URL сохраняются `width` и `height` в `photoItems`, чтобы frontend мог корректно отображать вертикальные, горизонтальные и квадратные изображения. VK-посты получают `category: "apg"`, поэтому отображаются в категории «Новости АПГ», а переход во ВКонтакте остаётся дополнительной кнопкой внизу статьи.

**Кэш:** после успешной синхронизации API пытается сохранить каждый VK-пост в `news/{vk_postId}` через Admin SDK и обновить `config/vkNewsSync`. Если VK API недоступен или нет токена, API возвращает последние сохранённые VK-посты из Firestore, если Admin SDK доступен.

**Диагностика:** backend пишет безопасные логи без значения токена: найден ли токен, выбранный источник (`VK_SERVICE_TOKEN`, `VK_USER_TOKEN` или `VK_GROUP_TOKEN`), режим `live_vk` или `cache`, код/текст ошибки VK API и количество постов.

---

## GET/POST /api/news-comments

**Назначение:** Комментарии к новостям, включая VK-публикации, без прямой клиентской записи в Firestore.

**Методы:** GET, POST
**Auth:** пользователь передаётся клиентом; модерационные действия требуют Firebase ID Token с ролью `owner/admin/moderator`
**Коллекция:** `newsComments`

**GET query params:**
- `newsId` (required) — id новости или VK-поста (`vk_...`)
- `admin=1` — административная загрузка последних 300 комментариев; требует `Authorization: Bearer <Firebase ID Token>` и роль с `comments:*`

**GET response 200:**
```json
{
  "ok": true,
  "comments": [
    {
      "id": "commentId",
      "newsId": "vk_229980067_1234",
      "parentId": null,
      "userId": "123",
      "userName": "Участник АПГ",
      "userAvatar": "https://...",
      "text": "Комментарий",
      "likes": 0,
      "likedBy": ["123"],
      "hidden": false,
      "createdAt": "2026-07-07T12:00:00.000Z",
      "updatedAt": "2026-07-07T12:00:00.000Z"
    }
  ]
}
```

**POST actions:**
- `create` — создать комментарий или ответ (`newsId`, `text`, `parentId?`, `user`)
- `update` — изменить свой комментарий (`commentId`, `text`, `user`)
- `delete` — скрыть свой комментарий; `admin/owner` может скрывать любой (`commentId`, `user`)
- `like` — поставить лайк один раз от пользователя (`commentId`, `user`)
- `togglePin` — закрепить/открепить комментарий; только `admin/owner`
- `toggleUseful` — отметить/снять «Полезный ответ»; только `admin/owner`
- `blockUser` — заблокировать автора комментария и скрыть комментарий; только `admin/owner`

**Логика:** клиентский Firestore не пишет в `newsComments`, потому что коллекция не открыта в `firestore.rules`. Backend использует Admin SDK, возвращает понятные ошибки пользователю и пишет сбои в `errorLogs` с source `api.news-comments` / `server.news-comments`. Модерация (`togglePin`, `toggleUseful`, `blockUser`, удаление/изменение чужого комментария) больше не доверяет `user.role` из body: сервер проверяет `Authorization: Bearer <Firebase ID Token>` и роль через custom claims / `users` / `auth_map`. Новые комментарии сохраняют `authorRole`, `status`, `isPinned`, `isUseful`, `moderation` и `ai.summaryEligible`, чтобы V4.4-админка и Локи могли модерировать и анализировать обсуждения без миграции структуры. Создание и скрытие комментария синхронизируют `news.comments` и `news.stats.comments`; админка получает список комментариев через `GET /api/news-comments?admin=1`, а не прямым Firestore read.

---

## POST /api/admin-actions

**Назначение:** Защищённый backend-слой административных действий.

**Метод:** POST
**Auth:** `Authorization: Bearer <Firebase ID Token>`
**Headers:** `X-Idempotency-Key`, `X-APG-Version`

**Actions новостей:**
- `news:create`
- `news:update`
- `news:autosave`
- `news:publish`
- `news:pin`
- `news:delete` — soft-delete
- `news:restore`
- `news:reorder`

**CMS-поля новостей:** backend whitelist для `news:create/update/autosave` поддерживает базовые поля (`title`, `subtitle`, `summary`, `text`, `fullText`, `author`, `sourceName`, `source`, `category`, `tags`, `publishedAt`, `expiresAt`, `priority`, `status`, `commentsEnabled`) и медиа/контент поля (`coverPhoto`, `imageUrl`, `photos`, `photoItems`, `gallery`, `videos`, `links`, `socialLinks`, `contentBlocks`, `faq`, `ctaButtons`, `docs`). Это позволяет админке создавать публикации с галереей, видео, социальными кнопками и структурными блоками без отдельного API.

**Actions универсальных ресурсов V4.4.3:**
- `entity:create`
- `entity:update`
- `entity:delete`
- `entity:set`

**Actions Content Lifecycle Engine V1:**
- `lifecycle:overview` — сводка, строки и рекомендации жизненного цикла для выбранного ресурса
- `lifecycle:transition` — сменить статус одного объекта
- `lifecycle:bulk-transition` — массово сменить статус объектов

Поддерживаемые статусы: `draft`, `moderation`, `scheduled`, `published`, `completed`, `archived`, `deleted`, `trash`. Архив не удаляет документ и сохраняет медиа, комментарии, статистику и историю. Смена статуса пишет `lifecycle`, `lifecycleStatus`, `contentStatus`, `lifecycleHistory`; для новостей дополнительно пишется `newsChangeHistory`.

**Resources:** `partners`, `experts`, `events`, `banners`, `prizes`, `notifications`, `customTasks`, `users`, `prizeClaims`, `errorLogs`, `scans`, `raffleEntries`, `expertReviews`, `lokiKnowledge`, `lokiAnalytics`, `aiImportRequests`, `publicFormLinks`, `config`, `stats`.

**Дополнительные поля body для entity-actions:**
- `resource` — имя ресурса из списка выше
- `id` — id документа для update/delete/set
- `patch` — поля для записи
- `increments` — числовые инкременты для update, например `{ "keys": 1 }`
- `serverTimestampFields` — список полей, которые backend заполнит серверным временем

**Логика:** endpoint проверяет Firebase ID Token через Admin SDK, определяет роль по custom claims и документу пользователя (`users/{uid}`, `auth_map/{firebaseUid}`, `firebaseUid/authUid` fallback), проверяет permission matrix и только после этого меняет Firestore. Все операции пишут `adminActivity`, история новостей пишется в `newsChangeHistory`, повторная отправка с тем же `X-Idempotency-Key` возвращает сохранённый результат из `adminIdempotency`. Клиентская админка больше не выполняет прямые записи в Firestore для партнёров, экспертов, событий, баннеров, призов, уведомлений, заданий, пользователей, ошибок и выдачи призов; прямой Firestore SDK в админке используется только для чтения списков.

**ИИ-импорт заявок:** ресурс `aiImportRequests` хранит исходный текст/метаданные файла, распознанные поля, confidence, недостающие поля и статус заявки. Для публичных форм партнёров/экспертов/рекламодателей дополнительно хранит закрытые `legalProfile`, `legalDocuments`, `legalCheck`, `counterparty`, `cooperationPlan`, `cooperationStatus` и CRM-заготовку. Публикации из заявки не выполняются автоматически: админка создаёт только черновик в целевом ресурсе после явного действия редактора.

**Публичные формы:** ресурс `publicFormLinks` хранит выданные администратором токен-ссылки для публичных анкет партнёров, экспертов, событий, новостей и призов. Заполненная публичная форма через `/api/public-submit` создаёт запись в `aiImportRequests` со статусом `processed` или `missing`; публикация остаётся ручным действием редактора. Тарифные анкеты партнёра и эксперта строятся от тарифа: партнёры используют `start/alliance/premium`, эксперты используют `practice/ambassador`. Недоступные тарифу поля скрываются в UI и отбрасываются analyzer: новости, мероприятия и ИНН доступны только `premium` партнёрам и `ambassador` экспертам, запись и видео партнёра доступны с `alliance`. Множественные категории, форматы, аудитории, видео и социальные ссылки сохраняются структурированными массивами. Юридические реквизиты доступны через `/api/admin-actions` только ролям `owner`, `super_admin`, `admin`; остальным ролям backend вырезает закрытые поля.

**Запуск партнёра:** actions `partner:onboarding-check`, `partner:bind-owner`, `partner:send-invite`, `partner:publish-catalog`, `partner:mark-verified`, `partner:remind-later` ведут партнёра от черновика до статуса “Проверенный партнёр АПГ”. Backend возвращает `readiness.checks`, `wizard` с шагами мастера публикации, `launchActions` и пишет `partnerConnectionEvents`. `partner:publish-catalog` публикует карточку в каталог, поиск, карту, рекомендации Локи и блок “Новые партнёры” на 14 дней; при первой публикации backend идемпотентно создаёт черновик приветственной новости, но push-рассылка остаётся только предложением для администратора. `partner:mark-verified` разрешён только после публикации и проверки владельца, контактов и согласия на публикацию.

**Cabinet Core 2.0:** actions `partner:profileUpdate` и `expert:profileUpdate` используются единым личным кабинетом. Они принимают только whitelisted поля, проверяют владельца профиля через `ownerId`/привязку пользователя и пишут `profileUpdatedAt`. Для общего модуля контактов whitelist расширен:

- партнёр: `phone`, `whatsappUrl`, `email`, `address`, `hours`, `workingHours`, `websiteUrl`, `bookingUrl`, `vkUrl`, `telegramUrl`, `maxUrl`, `socialUrl`, медиа и `aiProfile`;
- эксперт: все поля анкеты эксперта плюс `whatsappUrl`, `address`, `hours`, `workingHours`, `services`, `serviceDescription`, `serviceCost`, `experience`, медиа и `aiProfile`.

Новых endpoint для кабинетов 2.0 не добавлено: общий frontend-слой использует существующий `/api/user-actions`, чтобы не раздваивать права и аудит.

---

## GET/POST /api/public-submit

**Назначение:** Публичная отправка заявок по токен-ссылке без входа в приложение.

**Auth:** нет, доступ только по случайному токену из `publicFormLinks`.

**GET query params:**
- `token` — публичный токен формы.

**GET response 200:**
```json
{
  "ok": true,
  "token": "4FD82A...",
  "type": "partner",
  "typeLabel": "Партнёр",
  "title": "Партнёр · публичная анкета",
  "status": "link_created"
}
```

**POST body:**
```json
{
  "token": "4FD82A...",
  "fields": {
    "title": "Vibes",
    "description": "Описание",
    "phone": "+7...",
    "vk": "vk.com/vibes"
  },
  "files": [
    { "name": "photo.jpg", "type": "image/jpeg", "size": 123456, "url": "https://storage.yandexcloud.net/..." }
  ],
  "cooperationPlan": "not_now",
  "legalProfile": {
    "type": "company",
    "typeLabel": "ООО / юридическое лицо",
    "fields": {
      "fullName": "ООО \"Вайбс\"",
      "inn": "7701234567",
      "kpp": "770101001",
      "ogrn": "1027700123456",
      "checkingAccount": "40702810000000000000",
      "bik": "044525225",
      "directorName": "Иванов Иван Иванович"
    }
  },
  "legalDocuments": [
    { "name": "card.pdf", "type": "application/pdf", "size": 123456, "url": "https://storage.yandexcloud.net/...", "documentType": "companyCard", "documentLabel": "Карточка предприятия" }
  ]
}
```

**POST response 200:** `{ "ok": true, "id": "aiImportRequestId", "status": "processed", "missingFields": [], "legalCheck": { "status": "not_required", "score": 100 }, "confidence": 88 }`.

**Логика:** backend ищет токен в `publicFormLinks`, проверяет статус/срок действия, нормализует ссылки, создаёт обработанную заявку в `aiImportRequests`, переносит фото как `sourceFiles`, проверяет обязательный публичный ИНН, нормализует юридическую карточку только если она раскрыта/заполнена или выбран `cooperationPlan: "paid"`, формирует `counterparty`, `cooperationStatus` и CRM-заготовку, затем закрывает ссылку статусом `submitted`. Повторная отправка по той же ссылке возвращает понятную ошибку и не создаёт дубль.

---

## POST /api/admin-security

**Назначение:** Центр безопасности админки: проверка входа, роли, матрица прав, управление администраторами и журнал безопасности.

**Auth:** `Authorization: Bearer <Firebase ID Token>` или `X-Firebase-Auth`.

**Actions:**
- `status` — проверить текущую Firebase-сессию и вернуть actor, роль, флаг `mustChangePassword`, права и данные устройства.
- `overview` — список администраторов, матрица ролей и последние записи `adminActivity` / `adminSecurityLog`.
- `audit:list` — журнал безопасности.
- `admin:selfChangePassword` — сменить временный пароль текущего администратора и снять `mustChangePassword`.
- `admin:create` — создать администратора в Firebase Auth и профиль `users/{uid}`; пароль не пишется в Firestore.
- `admin:updateProfile` — изменить имя, email/login, должность или фото администратора.
- `admin:updateRole` — изменить роль и custom claims; только `owner/super_admin`.
- `admin:block`, `admin:unblock`, `admin:disable`, `admin:deleteAccess` — управление статусом доступа.
- `admin:revokeSessions` — принудительно отозвать refresh tokens администратора.
- `admin:updatePassword` — задать новый временный пароль администратора через Firebase Auth.
- `admin:resetPassword` — сгенерировать Firebase reset password link для email администратора.

**Роли:** `owner`, `super_admin`, `admin`, `editor`, `moderator`, `analyst`, `partner`, `expert`, `user`.

**Логика:** все изменения пишутся в `adminSecurityLog` и `adminActivity`. `owner` нельзя случайно понизить, заблокировать или ограничить из-под интерфейса. Новые администраторы, кроме `owner`, получают `mustChangePassword: true` и меняют временный пароль при первом входе. Биометрия в интерфейсе реализуется только через WebAuthn/Passkeys-ready слой: биометрические данные не попадают в АПГ.

---

## POST /api/admin-login

**Назначение:** Серверный вход администратора по email/password, независимый от Firebase Password provider.

**Auth:** публичный endpoint, но принимает только email/password администратора и не выдаёт данные без успешной проверки.

**Body:**
- `email` / `login`
- `password`

**Ответ:** `{ ok, customToken, actor }`. Клиент вызывает `signInWithCustomToken`, после чего все административные API работают только через Firebase ID Token.

**Безопасность:** пароль сравнивается с scrypt-хешем в `adminCredentials/{uid}` через timing-safe compare. Сырой пароль не пишется в Firestore, логи или исходный код. Успешные и неуспешные попытки пишутся в `adminSecurityLog`.

---

## GET /api/system-status

**Назначение:** Состояние системы для админки.

**Метод:** GET
**Auth:** `Authorization: Bearer <Firebase ID Token>` с правом `system:read`

**Проверяет:** API runtime, Firestore availability, счётчики `news`, `newsComments`, `users`, `errorLogs`, `adminActivity`, состояние VK News sync из `config/vkNewsSync`, backup marker из `backups`, базовое состояние очередей задач.

**Логика:** endpoint не делает тяжёлых агрегаций и ограничивает чтение коллекций лимитами, чтобы статус можно было открывать из админки без нагрузки на production.

## POST /api/user-actions — `log:error`

**Назначение:** безопасная запись клиентских ошибок.

**Логика:** backend нормализует stack trace, вычисляет `stackHash` и fingerprint, затем транзакционно обновляет `errorLogs/err_{fingerprint}`. Повтор не создаёт новый документ: увеличивается `occurrences`, обновляется `lastSeen`, сохраняются окружение и последние 50 occurrences. `AbortError`, отменённые fetch, `ResizeObserver`, extension noise и штатный `auth_timeout` отсекаются на клиенте.

---

## POST /api/loki-editor

**Назначение:** V5.0 Локи · Редакция — сбор разрешённых источников, подготовка AI-assisted черновиков и очередь редакторской проверки.

**Метод:** POST
**Auth:** `Authorization: Bearer <Firebase ID Token>` с правом `news:update`
**Автопубликация:** запрещена. `draft:publish` выполняется только по явному действию редактора в админке.

**Actions:**
- `status` — источники, черновики, последние запуски, журнал и настройки.
- `run-cycle` — проверить активные источники, распарсить материалы, создать/обновить черновики.
- `source:save` — создать/обновить источник (`rss`, `json`, `manual`).
- `source:delete` — удалить источник.
- `draft:update` — отредактировать, отложить или отклонить черновик.
- `draft:publish` — опубликовать выбранный черновик как новость после подтверждения редактора.
- `settings:save` — период проверки, порог доверия, лимит материалов за цикл.

**Коллекции:** `aiSources`, `aiDrafts`, `aiEditorRuns`, `aiEditorActivity`, `config/lokiEditor`.

**Логика:** backend получает материалы из RSS/XML/JSON/manual источников, считает fingerprint, проверяет дубликаты по fingerprint и `news.linkUrl`, формирует черновик через эвристический draft generator (`loki-editor-v1`), рассчитывает категорию, важность, время чтения, confidence и объяснение «почему важно». Секреты и внешние ключи не используются на frontend.

---

## POST /api/user-actions

**Назначение:** Единый backend-first слой пользовательских write-сценариев.

**Метод:** POST
**Auth:** `Authorization: Bearer <Firebase ID Token>`
**Headers:** `X-APG-Version`

**Actions V4.4.4:**
- `auth:linkUser` — связать Firebase uid с APG userId через `auth_map`
- `profile:sync` — создать/синхронизировать профиль, `lastSeen`, daily bonus, referral base state
- `profile:update` — onboarding, согласия, уведомления, публичные поля профиля, `joinedGroup`
- `profile:delete` — удалить свой профиль
- `favorites:toggle` — избранное партнёров + счётчик партнёра + activity
- `news:saved`, `news:readLater`, `news:reaction`, `news:subscriptions`
- `publicQr:view` — публичный QR / просмотр партнёра или эксперта
- `task:claim` — выполнение задания и начисление ключей
- `prize:claim` — получение приза, списание ключей, stock, claim history
- `raffle:enter` — участие в розыгрыше и списание ключей
- `event:toggle` — регистрация/отмена регистрации на мероприятие
- `review:partner`, `review:expert`
- `booking:create` — создать онлайн-запись, зеркала пользователя/владельца, контекстный диалог и уведомление
- `partner:profileUpdate`, `expert:profileUpdate` — кабинеты владельцев с server-side owner check
- `loki:settings`
- `loki:analytics` — best-effort запись запроса Локи: текст, intent, количество результатов, действие, экран и время ответа
- `log:error`, `log:diagnostic`, `guest:session`

**Логика:** клиент больше не пишет пользовательские изменения напрямую в Firestore. Endpoint проверяет Firebase ID Token, определяет APG userId через `auth_map` / `users`, проверяет принадлежность данных пользователю, выполняет бизнес-логику через Admin SDK и пишет `userActivityLog`. Прямые Firestore reads на клиенте сохраняются для публичных каталогов и экранов, чтобы не ухудшать скорость.

---

## GET /api/public-data

**Назначение:** Быстрый публичный bootstrap пользовательского приложения.

**Метод:** GET
**Auth:** нет

**Ресурсы:** `partners`, `events`, `news`, `notifications`, `reviews`, `customTasks`, `experts`, `lokiKnowledge`, `stats`.

**Локи:** `lokiKnowledge` отдаёт только активные публичные записи из админской базы знаний Локи. Если загрузка не удалась, приложение продолжает использовать встроенную APG Knowledge Base.

---

## POST /api/news-engagement

**Назначение:** Сбор вовлечённости новостей: уникальные просмотры, дочитывание, репосты и быстрый feedback.

**Метод:** POST  
**Auth:** пользователь передаётся клиентом; запись выполняет backend через Admin SDK  
**Коллекции:** `newsViewEvents`, `newsReadEvents`, `newsShareEvents`, `newsFeedback`

**POST actions:**
- `view` — уникальный просмотр за сутки (`newsId`, `user`, `source`, `progress?`, `readTimeMs?`)
- `read` — событие чтения/дочитывания (`newsId`, `user`, `progress`, `readTimeMs`, `completed`)
- `share` — факт репоста/шаринга (`newsId`, `user`, `channel`)
- `feedback` — быстрый ответ «полезна ли новость» (`newsId`, `user`, `helpful`)

**Логика:** `view` пишет детерминированный документ `newsViewEvents/{newsId_userId_day}` и увеличивает `news.views`, `stats.views`, `dailyViews.YYYY-MM-DD` только при первом просмотре за сутки. `read` сохраняет `stopPercent`, `readTimeMs` и `completed`, чтобы редакция могла видеть дочитывания и точки выхода. `share` увеличивает `shares` и `stats.reposts`. `feedback` хранит одну оценку на пользователя и корректно переносит счётчик при изменении ответа.

---

## POST /api/upload-photo

**Назначение:** Загрузить фото или документ в Yandex Cloud S3.

**Метод:** POST  
**Auth:** нет (полагается на то, что клиент авторизован в Firebase)  
**Content-Type:** application/json  
**Max body:** 8 MB

**Request body:**
```json
{
  "folder": "partners",
  "filename": "logo.jpg",
  "contentType": "image/jpeg",
  "data": "base64EncodedImageData..."
}
```

**Allowed content types:** `image/jpeg`, `image/png`, `image/webp`, `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

**Allowed folders:** partners, experts, events, news, banners, public-submissions (любая строка, но client code использует эти)  
**Allowed types:** см. whitelist content types выше.

**Response 200:**
```json
{ "url": "https://storage.yandexcloud.net/apg-photos/partners/logo.jpg" }
```

**Response 400:** `{ "error": "Invalid content type" }`

**Процесс на клиенте (PhotoUpload.jsx):**
1. `browser-image-compression` → сжатие до WebP, max 800px, 80% качество
2. `FileReader.readAsDataURL()` → base64
3. `POST /api/upload-photo` с base64 data

---

## POST /api/telegram-auth-start

**Назначение:** Инициировать процесс авторизации через Telegram бота.

**Метод:** POST  
**Auth:** нет  
**Body:** пустой

**Response 200:**
```json
{
  "state": "a1b2c3d4e5f6...",
  "url": "https://t.me/apg_zelenograd_bot?start=auth_a1b2c3d4e5f6..."
}
```

**Логика:**
1. Генерирует `state` = 32 hex символа (`crypto.randomBytes(16).toString('hex')`)
2. Записывает `telegramAuthSessions/{state}` со `status: 'pending'`, `expiresAt: now+5min`
3. Возвращает deep link для открытия бота

---

## GET /api/telegram-auth-check

**Назначение:** Проверить статус Telegram авторизации (long-polling).

**Метод:** GET  
**Auth:** нет

**Query params:**
- `state` (required) — токен сессии из `telegram-auth-start`

**Response:**
```json
{ "status": "pending" }
{ "status": "done", "userId": "1234567890", "userName": "Виталий", ... }
{ "status": "expired" }
{ "status": "not_found" }
```

**Логика:** Опрашивает Firestore каждую секунду, максимум 25 секунд. Клиент вызывает в цикле. При `status: 'done'` проверяет `tgLinks/{tgId}` — если есть привязанный email-аккаунт, добавляет `linkedUserId` в ответ.

---

## POST /api/telegram-webhook

**Назначение:** Webhook для Telegram Bot API.

**Метод:** POST  
**Auth:** нет (Telegram подписывает запросы, но подпись не проверяется — TODO)

**Request body:** Telegram Update объект

**Обрабатываемые команды:**

| Команда | Действие |
|---|---|
| `/start auth_{state}` | Завершить сессию авторизации. Найти/создать `users/{tgId}`, обновить сессию `status: 'done'` |
| `/start` (без параметра) | Поиск последней `pending` сессии → завершить. Если нет — welcome message |
| `/links` / `/social` | Клавиатура с ссылками: App, VK, Telegram, YouTube, Instagram, Dzen |
| `/help` | Список команд |
| Любой текст | "Открой приложение: {APP_URL}" |

**Создание пользователя при `/start auth_*`:**
- Проверяет `tgLinks/{tgId}` — если есть связанный userId, обновляет его профиль
- Иначе создаёт `users/{tgId}` с базовыми полями из Telegram: first_name, username, photo_url

---

## POST /api/verify-telegram

**Назначение:** Верификация Telegram Login Widget (web авторизация через виджет).

**Метод:** POST  
**Auth:** нет (верифицируется через HMAC)  
**CORS:** `https://myapg.ru` only

**Request body:**
```json
{
  "id": 123456789,
  "first_name": "Виталий",
  "username": "vitaliy",
  "photo_url": "https://...",
  "auth_date": 1719000000,
  "hash": "abc123..."
}
```

**Верификация:** HMAC-SHA256(data_check_string, SHA256(botToken))  
**Проверка свежести:** auth_date не старше 24 часов

**Response 200:**
```json
{
  "ok": true,
  "token": "firebaseCustomToken...",
  "user": { "id": "123456789", "name": "Виталий", ... }
}
```

---

## POST /api/email-auth

**Назначение:** Многоцелевой эндпоинт email-авторизации.

**Метод:** POST  
**Auth:** нет (для `send`/`verify`/`login`); Firebase token для остальных

**Параметр `action` в body:**

### action: "send"
Отправить OTP код на email.
```json
{ "action": "send", "email": "user@example.com" }
```
- Rate limit: 1 запрос/минуту
- Код: 6 цифр, TTL 10 минут, макс 5 попыток
- Отправка через Yandex Postbox (SES v2) или SMTP fallback

### action: "verify"
Проверить OTP код.
```json
{ "action": "verify", "email": "user@example.com", "code": "123456" }
```
Response: `{ "ok": true, "token": "firebaseCustomToken", "user": {...} }`

### action: "login"
Мгновенный вход без кода (автологин для уже известного email).
```json
{ "action": "login", "email": "user@example.com" }
```

### action: "verify-email"
Подтвердить email через ссылку из письма.
```json
{ "action": "verify-email", "token": "verifyToken123" }
```

### action: "resend-verification"
Повторно отправить письмо с ссылкой подтверждения.
```json
{ "action": "resend-verification", "email": "user@example.com" }
```

### action: "link-telegram"
Привязать Telegram к email аккаунту.
```json
{ "action": "link-telegram", "tgId": 123456789, "userId": "email:user@example.com" }
```
- Создаёт `tgLinks/{tgId}` → userId

### action: "link-email"
Записать linkedEmail на TG-пользователя.
```json
{ "action": "link-email", "userId": "123456789", "email": "user@example.com" }
```

### action: "grant-referral"
Начислить ключи за реферала (вызывается при регистрации нового пользователя).
```json
{ "action": "grant-referral", "newUserId": "...", "referrerId": "..." }
```
- Проверяет `users/{newUserId}.referredBy` и `users/{referrerId}` существование
- Начисляет +2 ключа реферреру

**resolveEmailUser() логика:**
1. Проверить `emailIndex/{email}` → получить userId
2. Если нет — проверить `users/email:{email}`
3. Если нет — создать нового пользователя с id `email:{email}`, добавить в `emailIndex`
4. Если `referredBy` валиден — начислить +2 реферреру
5. Создать Firebase Custom Token → вернуть клиенту

---

## POST /api/raffle-draw

**Назначение:** Провести розыгрыш призов (cron или ручной из AdminPanel).

**Метод:** POST  
**Auth:**
- Cron: Yandex timer trigger отправляет `body.secret === RAFFLE_SECRET`
- Ручной: `body.secret === RAFFLE_SECRET`

**Request body (ручной):**
```json
{ "secret": "your-raffle-secret", "prizeId": "optional-specific-prize-id" }
```

**Логика:**
1. Найти призы с `type: 'raffle'` и `raffleDate <= now` и без winner
2. Для каждого приза: `raffleEntries` → взвешенный случайный выбор (вес = `ticketsCount`)
3. Обновить `prizes/{id}.winner`
4. Отправить FCM push победителю через `/api/send-push`
5. Добавить в `users/{uid}/activity` и `notifications`

**Response 200:**
```json
{ "ok": true, "drawn": [{ "prizeId": "...", "winner": { "userId": "...", "userName": "..." } }] }
```

---

## POST /api/send-push

**Назначение:** Отправить push-уведомление одному пользователю или сегментированной аудитории.

**Метод:** POST  
**Auth:** `x-push-secret` header = `PUSH_SECRET` / `RAFFLE_SECRET` или Firebase admin token с правом `push:*`

**Single push:**
```json
{
  "userId": "vk_123456",
  "title": "Вы выиграли!",
  "body": "Приз ждёт вас",
  "url": "https://myapg.ru",
  "tag": "raffle_win",
  "notificationId": "notificationsDocId",
  "category": "prizes",
  "type": "important",
  "priority": "high",
  "actionLabel": "Открыть приз"
}
```

**Broadcast:**
```json
{
  "broadcast": true,
  "title": "Новый партнёр!",
  "body": "Открылась кофейня в центре",
  "category": "partners",
  "type": "info",
  "priority": "normal",
  "url": "/#/partners",
  "audience": { "type": "active" }
}
```

**Логика:**
- Для single: читает `users/{userId}.fcmTokens`, отправляет FCM multicast
- Для broadcast: читает пользователей с включёнными уведомлениями и Web Push токенами, фильтрует по `notificationPreferences`, категории и аудитории (`all`, `new`, `active`, `inactive`, `partners`, `experts`, `admins`, `city`, `min_keys`, `max_keys`), отправляет батчами по 500 токенов
- Удаляет невалидные токены из `users/{id}.fcmTokens`
- Если передан `notificationId`, записывает в `notifications/{id}` поля `pushStatus`, `pushStats`, `pushSentAt`
- Service Worker `public/sw.js` не кэширует приложение, но принимает `push` и открывает `data.url` / `fcmOptions.link`

---

## POST /api/expert-rotation

**Назначение:** Сменить «топ-амбассадора» в каждой категории экспертов.

**Метод:** POST  
**Auth:** `Authorization: Bearer {ACTIVITY_SECRET}` (из AdminPanel)

**Логика:**
1. Читает всех экспертов с `tier: 'ambassador'` по категориям
2. Читает `expertRotation/{category}` — текущий ротирующийся
3. Выбирает следующего по дате `ambassadorSince` ASC (по кругу)
4. Записывает `expertRotation/{category}` с `expertId`, `weekKey`, `updatedAt`

---

## POST /api/activity-index

**Назначение:** Пересчитать индекс активности партнёров. Cron daily 03:00 UTC.

**Метод:** GET (cron) или POST (ручной)  
**Auth:**
- Cron: Yandex timer trigger отправляет `body.secret === ACTIVITY_SECRET`
- Ручной: `body.secret === ACTIVITY_SECRET`

**Request body (ручной):**
```json
{ "secret": "...", "forceAward": true }
```

**Формула activity score:**
```
score =
  newClientsScore  × 0.30  (новые клиенты за месяц)
  + returningScore × 0.25  (повторные визиты)
  + ratingScore    × 0.20  (средний рейтинг, нормализован к 5)
  + profileScore   × 0.10  (обновлял ли профиль в последний месяц)
  + engagementScore× 0.15  (избранные + отзывы + публичные QR)
```

**1-е число месяца (или forceAward=true):**
1. Определить победителя (максимальный score)
2. Обновить `partners/{id}.partnerOfMonth = true` (у остальных = false)
3. Записать `monthlyWinners/{YYYY-MM}`
4. Отправить broadcast push о победителе

---

## POST /api/public-submit — partnership actions

**Назначение:** Приём заявок на партнёрство из пользовательского сценария «Стать партнёром АПГ» и запись аналитики этого сценария.

**Runtime:** единый Fastify backend. Заявки пользовательского сценария принимаются через `POST /api/public-submit`; отдельный Fastify endpoint `POST /api/partnership-application` оставлен как явный маршрут сценария подключения без Vercel mirror.

**Actions:**

### `action: "track-partnership"`

Записывает событие в `partnershipAnalytics`.

Разрешённые события:

- `partnership_card_opened`
- `partnership_partner_selected`
- `partnership_expert_selected`
- `partnership_presentation_opened`
- `partnership_questionnaire_started`
- `partnership_page_opened`
- `partnership_tariff_selected`
- `partnership_form_started`
- `partnership_application_submitted`

**Request body:**
```json
{
  "action": "track-partnership",
  "event": "partnership_card_opened",
  "payload": { "surface": "profile" },
  "user": { "id": "user-id", "name": "Имя", "email": "mail@example.ru" }
}
```

### Submit application

Создаёт документ в `aiImportRequests`.

**Request body:**
```json
{
  "action": "partnership-submit",
  "type": "partner",
  "fields": { "title": "Компания", "tariff": "start" },
  "files": [{ "name": "photo.jpg", "type": "image/jpeg", "size": 120000, "url": "https://...", "role": "main" }],
  "user": { "id": "user-id", "name": "Имя", "email": "mail@example.ru" }
}
```

**Запись `aiImportRequests`:**

- `source: "partnership-flow"`
- `sourceLabel: "Заявка на партнёрство из профиля"`
- `moderationStatus: "new_partnership_application"`
- `crm.lifecycleStage: "new_partnership_application"`
- `draft` строится через общий analyzer публичного ИИ-импорта

**Response 200:**
```json
{
  "ok": true,
  "id": "request-id",
  "status": "processed",
  "missingFields": [],
  "confidence": 90
}
```

---

## GET /health (Fastify only)

**Назначение:** Health check для мониторинга Yandex Serverless Container.

**Response 200:**
```json
{ "ok": true, "ts": "2026-07-05T12:00:00.000Z" }
```

Читает документ `_health` из Firestore — если Firestore недоступен, возвращает 503.

---

## Коды ошибок API

| Код | Причина |
|---|---|
| 400 | Невалидный запрос (неверный action, отсутствует обязательный параметр) |
| 401 | Неверный secret/token |
| 429 | Rate limit (email OTP: 1/минута) |
| 500 | Внутренняя ошибка (Firestore недоступен, S3 ошибка) |

## Переменные окружения API

| Переменная | Используется в |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | все функции (Firebase Admin) |
| `VK_SERVICE_TOKEN` / `VK_USER_TOKEN` | vk-news.js (предпочтительно для `wall.get`) |
| `VK_GROUP_TOKEN` | vk-news.js (fallback; часть методов VK может быть недоступна с group-auth) |
| `PUSH_SECRET` | send-push.js |
| `RAFFLE_SECRET` | raffle-draw.js, send-push.js |
| `ACTIVITY_SECRET` | activity-index.js |
| `CRON_SECRET` | опциональная backward-compatible авторизация для ручных/внешних вызовов cron endpoint; Yandex timer triggers используют `RAFFLE_SECRET` / `ACTIVITY_SECRET` |
| `YC_ACCESS_KEY` | upload-photo.js |
| `YC_SECRET_KEY` | upload-photo.js |
| `TELEGRAM_BOT_TOKEN` | telegram-webhook.js, verify-telegram.js |
| `POSTBOX_KEY_ID` | email-auth.js |
| `POSTBOX_SECRET` | email-auth.js |
| `YANDEX_EMAIL` | email-auth.js (fallback SMTP) |
| `YANDEX_EMAIL_PASS` | email-auth.js (fallback SMTP) |
