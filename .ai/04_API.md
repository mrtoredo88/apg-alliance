# 04 API

## Общее

Все API функции существуют в двух местах с идентичной логикой:
- `api/*.js` — Vercel Serverless Functions (primary)
- `server/src/routes/*.js` — Fastify (Docker/Yandex Serverless Containers, fallback)

Переключение через переменную `VITE_API_BASE_URL`:
- `''` (пусто) → Vercel `/api/` routes
- URL Yandex Container → Fastify

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

**Логика:** клиентский Firestore не пишет в `newsComments`, потому что коллекция не открыта в `firestore.rules`. Backend использует Admin SDK, возвращает понятные ошибки пользователю и пишет сбои в `errorLogs` с source `api.news-comments` / `server.news-comments`. Модерация (`togglePin`, `toggleUseful`, `blockUser`, удаление/изменение чужого комментария) больше не доверяет `user.role` из body: сервер проверяет `Authorization: Bearer <Firebase ID Token>` и роль через custom claims / `users` / `auth_map`. Новые комментарии сохраняют `authorRole`, `status`, `isPinned`, `isUseful`, `moderation` и `ai.summaryEligible`, чтобы V4.4-админка и Локи могли модерировать и анализировать обсуждения без миграции структуры.

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

**Actions универсальных ресурсов V4.4.3:**
- `entity:create`
- `entity:update`
- `entity:delete`
- `entity:set`

**Resources:** `partners`, `experts`, `events`, `banners`, `prizes`, `notifications`, `customTasks`, `users`, `prizeClaims`, `errorLogs`, `scans`, `raffleEntries`, `expertReviews`, `config`, `stats`.

**Дополнительные поля body для entity-actions:**
- `resource` — имя ресурса из списка выше
- `id` — id документа для update/delete/set
- `patch` — поля для записи
- `increments` — числовые инкременты для update, например `{ "keys": 1 }`
- `serverTimestampFields` — список полей, которые backend заполнит серверным временем

**Логика:** endpoint проверяет Firebase ID Token через Admin SDK, определяет роль по custom claims и документу пользователя (`users/{uid}`, `auth_map/{firebaseUid}`, `firebaseUid/authUid` fallback), проверяет permission matrix и только после этого меняет Firestore. Все операции пишут `adminActivity`, история новостей пишется в `newsChangeHistory`, повторная отправка с тем же `X-Idempotency-Key` возвращает сохранённый результат из `adminIdempotency`. Клиентская админка больше не выполняет прямые записи в Firestore для партнёров, экспертов, событий, баннеров, призов, уведомлений, заданий, пользователей, ошибок и выдачи призов; прямой Firestore SDK в админке используется только для чтения списков.

---

## GET /api/system-status

**Назначение:** Состояние системы для админки.

**Метод:** GET
**Auth:** `Authorization: Bearer <Firebase ID Token>` с правом `system:read`

**Проверяет:** API runtime, Firestore availability, счётчики `news`, `newsComments`, `users`, `errorLogs`, `adminActivity`, состояние VK News sync из `config/vkNewsSync`, backup marker из `backups`, базовое состояние очередей задач.

**Логика:** endpoint не делает тяжёлых агрегаций и ограничивает чтение коллекций лимитами, чтобы статус можно было открывать из админки без нагрузки на production.

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
- `partner:profileUpdate`, `expert:profileUpdate` — кабинеты владельцев с server-side owner check
- `loki:settings`
- `log:error`, `log:diagnostic`, `guest:session`

**Логика:** клиент больше не пишет пользовательские изменения напрямую в Firestore. Endpoint проверяет Firebase ID Token, определяет APG userId через `auth_map` / `users`, проверяет принадлежность данных пользователю, выполняет бизнес-логику через Admin SDK и пишет `userActivityLog`. Прямые Firestore reads на клиенте сохраняются для публичных каталогов и экранов, чтобы не ухудшать скорость.

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

**Назначение:** Загрузить фото в Yandex Cloud S3.

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

**Allowed folders:** partners, experts, events, news, banners (любая строка, но client code использует эти)  
**Allowed types:** image/jpeg, image/png, image/webp

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
- Cron: `Authorization: Bearer {CRON_SECRET}` (Vercel добавляет автоматически)
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

**Назначение:** Отправить push-уведомление одному или всем пользователям.

**Метод:** POST  
**Auth:** `x-push-secret` header = `PUSH_SECRET` или `RAFFLE_SECRET`

**Single push:**
```json
{
  "userId": "vk_123456",
  "title": "Вы выиграли!",
  "body": "Приз ждёт вас",
  "url": "https://myapg.ru",
  "tag": "raffle_win"
}
```

**Broadcast:**
```json
{
  "broadcast": true,
  "title": "Новый партнёр!",
  "body": "Открылась кофейня в центре"
}
```

**Логика:**
- Для single: читает `users/{userId}.fcmTokens`, отправляет FCM multicast
- Для broadcast: читает всех пользователей с `notificationProvider === 'webpush'`, батчами по 500 токенов
- Удаляет невалидные токены из `users/{id}.fcmTokens`

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
- Cron: `Authorization: Bearer {CRON_SECRET}`
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
| `CRON_SECRET` | raffle-draw.js, activity-index.js |
| `YC_ACCESS_KEY` | upload-photo.js |
| `YC_SECRET_KEY` | upload-photo.js |
| `TELEGRAM_BOT_TOKEN` | telegram-webhook.js, verify-telegram.js |
| `POSTBOX_KEY_ID` | email-auth.js |
| `POSTBOX_SECRET` | email-auth.js |
| `YANDEX_EMAIL` | email-auth.js (fallback SMTP) |
| `YANDEX_EMAIL_PASS` | email-auth.js (fallback SMTP) |
