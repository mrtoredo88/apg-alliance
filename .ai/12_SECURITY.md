# 12 SECURITY

## Авторизация

### VK Mini App (основная)

VK Bridge предоставляет гарантированный VK User ID — его нельзя подделать на уровне VK платформы. Но в Firebase:

1. Клиент делает `signInAnonymously()` — получает Firebase UID
2. Записывает `auth_map/{firebaseUid} = { vkId: 'vkUserId' }`
3. Firestore Rules используют `auth_map` для `isOwner(userId)` проверки

**Уязвимость:** любой Firebase-авторизованный пользователь может записать любой `vkId` в `auth_map`. Нет верификации что этот VK ID принадлежит именно этому Firebase пользователю. Частично митигируется тем, что `auth_map` правило — только `create` (не `update`), а атакующий всё равно не знает чужого VK ID.

### Email OTP

- OTP: 6-значный случайный код, TTL 10 минут
- Rate limit: `lastSentAt` в Firestore — нельзя запросить код чаще 1/мин
- Max attempts: 5 попыток (`attempts` счётчик) — после 5 код становится невалидным
- Коды хранятся в `emailAuthCodes/{email}` — доступ только Admin SDK

### Telegram Auth

- Telegram-подпись: HMAC-SHA256 (`verify-telegram.js`)  
- Webhook подпись: **НЕ верифицируется** (`telegram-webhook.js`) — известная уязвимость
- Deep link state: 32 случайных байта hex — достаточная entropy для предотвращения угадывания
- TTL сессии: 5 минут — короткое окно атаки

---

## Firestore Security Rules

**Файл:** `firestore.rules`

### isOwner function

```js
function isOwner(userId) {
  return request.auth != null &&
    exists(/databases/$(database)/documents/auth_map/$(request.auth.uid)) &&
    get(/databases/$(database)/documents/auth_map/$(request.auth.uid)).data.vkId == userId;
}
```

Эта функция стоит 2 дополнительных Firestore read при каждой write-операции. Важно понимать затраты.

### Уровни доступа

| Уровень | Коллекции |
|---|---|
| **Публичное чтение** | partners, experts, events, news, prizes, notifications, customTasks, banners, stats, monthlyWinners, expertRotation, expertReviews, partners/{id}/reviews |
| **Authenticated write** | все публичные + выше — любой авторизованный |
| **Owner only read/write** | users/{id}, users/{id}/activity, users/{id}/claims |
| **Admin SDK only** | scans (read), telegramAuthSessions (all), emailAuthCodes, emailIndex, emailVerifyTokens, tgLinks |
| **Self-only create** | auth_map (create, no update) |
| **Unrestricted create** | errorLogs, diagnostics, guestSessions (любой auth создаёт) |

### Известные проблемы в Rules

1. **AdminPanel частично перенесён на серверную авторизацию.** V4.4.2 закрыл news admin actions, push из админки и модерацию комментариев через Firebase ID Token + role guard. Legacy-разделы `partners`, `experts`, `events`, `banners` всё ещё частично используют прямые Firestore-записи и требуют следующего этапа миграции.

2. **Upload photo без авторизации.** `/api/upload-photo` не требует Firebase token — любой может загрузить файл в S3.

3. **Leaderboard читает чужие данные.** `users` коллекция публично читается любым auth пользователем (нужно для лидерборда). Поля keys, name, photo — открыты.

---

## API Security

### Admin Role Guard V4.4.2

Административные операции должны выполняться через backend, а не через прямые клиентские записи.

**Проверка:**
1. Клиент отправляет `Authorization: Bearer <Firebase ID Token>`.
2. Backend вызывает `verifyIdToken`.
3. Роль определяется по custom claims и документу пользователя: `users/{uid}`, `auth_map/{firebaseUid}`, `firebaseUid/authUid`.
4. Permission matrix проверяется на сервере.
5. Результат пишется в `adminActivity`, история новостей — в `newsChangeHistory`.

**Роли:**
- `owner` — полный доступ;
- `super_admin` — почти полный доступ, кроме случайного ограничения Owner;
- `admin` — новости, комментарии, push, пользователи, партнёры, эксперты, события, статистика;
- `editor` — новости, комментарии, события, ИИ-редактор;
- `moderator` — модерация комментариев, пользователей и ограниченное изменение новостей;
- `analyst` — статистика, отчёты, аудит, только просмотр;
- `partner`, `expert`, `user` — без административных прав.

**Endpoints:**
- `/api/admin-login` — публичная точка входа администратора, проверяет scrypt-хеш в `adminCredentials/{uid}` и выдаёт Firebase custom token;
- `/api/admin-actions` — защищённые news admin actions;
- `/api/admin-security` — вход в админку, матрица прав, создание администраторов через Firebase Auth, обязательная смена временного пароля, управление администраторами, журнал безопасности;
- `/api/system-status` — защищённый health/status для админки;
- `/api/news-comments` — модерационные действия требуют роль `owner/admin/moderator`;
- `/api/send-push` — принимает legacy secret или роль `push:*`.

**Owner bootstrap:**
- первый `owner` создаётся скриптом `scripts/bootstrap-owner.mjs` через Firebase Admin SDK;
- пароль передаётся только при запуске скрипта и хранится только как scrypt-хеш в `adminCredentials/{uid}` и, при включённом provider, как Firebase Auth password hash;
- в Firestore пишутся только `uid`, email/login, role/userRole/roles, `adminStatus`, permissions и audit-запись;
- `owner` защищён от блокировки, удаления и случайного понижения через UI/API.

### Секреты в env vars

| Secret | Где используется | Тип |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | все functions | JSON (Admin SDK credentials) |
| `PUSH_SECRET` | send-push.js | shared secret в header |
| `RAFFLE_SECRET` | raffle-draw.js | body secret |
| `ACTIVITY_SECRET` | activity-index.js | body secret |
| `CRON_SECRET` | raffle-draw, activity-index | Vercel auth header |
| `VK_GROUP_TOKEN` | vk-news.js | VK API token |
| `TELEGRAM_BOT_TOKEN` | telegram functions | Bot API token |
| `YC_ACCESS_KEY` / `YC_SECRET_KEY` | upload-photo.js | S3 credentials |
| `POSTBOX_KEY_ID` / `POSTBOX_SECRET` | email-auth.js | Yandex Postbox |

### CORS

Fastify сервер разрешает:
- `https://myapg.ru`
- `https://apg-alliance.vercel.app`
- `localhost:*` (любой порт)

Vercel functions: `Access-Control-Allow-Origin: *` (для большинства endpoints).

`verify-telegram.js`: строго `https://myapg.ru` only.

---

## Firebase Storage Rules

**Файл:** `storage.rules`

Firebase Storage используется только для rules-файла — фактическое хранилище фото в **Yandex Cloud S3**, не в Firebase Storage.

---

## Критические уязвимости (TODO)

### HIGH

1. **`firebase-service-account.json` в `server/`**  
   Файл с приватным ключом Firebase Admin SDK. Если он не в `.gitignore` server-директории и попал в git — это компромисс всего проекта. Нужно проверить git history.  
   **Митигация:** убедиться что файл в `.gitignore`; ротировать ключ если он был в git.

2. **Webhook Telegram без верификации подписи**  
   `/api/telegram-webhook` не проверяет `X-Telegram-Bot-Api-Secret-Token`.  
   **Митигация:** добавить при установке webhook `?secret_token=RANDOM` и проверять заголовок.

3. **Upload Photo без авторизации**  
   Любой может загрузить файл в S3 bucket `apg-photos`.  
   **Митигация:** добавить проверку Firebase ID token в handler.

### MEDIUM

4. **AdminPanel legacy-разделы ещё не полностью за backend role guard**  
   News admin actions, push и модерация комментариев защищены сервером. Партнёры, эксперты, события и баннеры нужно поэтапно перевести на `/api/admin-actions` или отдельные role-guarded endpoints.  
   **Митигация:** продолжить миграцию административных операций на backend и после этого ужесточать Firestore rules.

5. **VK ID в `auth_map` не верифицируется сервером**  
   Клиент сам записывает VK ID без серверной проверки.  
   **Митигация:** использовать VK Bridge `VKWebAppGetUserInfo` → проксировать через API → Admin SDK записывает auth_map.

### LOW

6. **Rate limiting только через Firestore timestamp**  
   Email OTP rate limit: 1/мин через `lastSentAt` в Firestore. Легко обойти если знать алгоритм.

7. **PWA manifest**  
   `short_name` заполнен как `АПГ`; при изменении PWA настроек проверять `start_url`, `scope`, icons и service worker cache version.

---

## Environment Variables Management

`.env.local` — локальные переменные (в `.gitignore`).  
Продакшн env vars хранятся в Vercel Dashboard.

**Никогда не коммитить:**
- `.env.local`
- `.env.production`
- `firebase-service-account.json`
- Любые файлы с приватными ключами

**Vercel автоматически шифрует** env vars при хранении.

---

## VK Mini App Security

VK платформа сама верифицирует пользователя через VK ID. Дополнительная авторизация на стороне приложения (Firebase Auth) используется только для работы с Firestore.

VK заголовки (`vk_app_id`, `vk_user_id`, `vk_sign`) передаются в URL Mini App при запуске — их можно верифицировать на сервере через VK secret key, но в этом проекте не реализовано.

---

## Session Management

| Провайдер | Как хранится | Как истекает |
|---|---|---|
| VK | Firebase anonymous session (IndexedDB) | Не истекает |
| Email | `localStorage['apg_email_user']` | Нет TTL (вручную: `manualLogout`) |
| Telegram | `localStorage['apg_tg_user']` | Нет TTL |
| Firebase | `persistentLocalCache` (IndexedDB) | Firebase auto-refresh |

**Выход из системы:** `localStorage.setItem('manualLogout', 'true')` + `window.location.reload()`. Следующий запуск проверяет этот флаг и показывает LoginScreen.
