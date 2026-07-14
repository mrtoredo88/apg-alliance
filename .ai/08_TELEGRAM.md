# 08 TELEGRAM

## Важное уточнение

**Этот проект НЕ является Telegram Mini App.** Telegram используется только для:
1. Альтернативного способа авторизации
2. Рассылки уведомлений через Telegram канал (вне кода)
3. Telegram Bot как посредник при auth flow

Основное приложение — **VK Mini App** + PWA.

---

## Telegram Bot

**Bot:** `@apg_zelenograd_bot`  
**Webhook:** `POST /api/telegram-webhook`  
**Token:** `TELEGRAM_BOT_TOKEN` (env var)

### Команды

| Команда | Действие |
|---|---|
| `/start auth_{32hexState}` | Завершить сессию авторизации |
| `/start` (без параметра) | Только welcome message; авторизация требует персональный `auth_{state}` |
| `/links` / `/social` | Отправить кнопки с ссылками на все ресурсы АПГ |
| `/help` | Список доступных команд |
| Любое сообщение | "Открой приложение: {APP_URL}" |

### Кнопки при /links

```
🌐 Приложение АПГ
👥 VK сообщество
📢 Telegram канал
▶️ YouTube
📸 Instagram
📝 Дзен
```

---

## Telegram Auth Flow

Используется когда пользователь хочет войти через Telegram (в web PWA режиме).

```
Пользователь нажимает "Войти через Telegram" в ProfilePanel
│
▼
POST /api/telegram-auth-start
→ Создаёт telegramAuthSessions/{state} (status: 'pending', TTL 5 min)
→ Возвращает { state, url: "telegram.me/apg_zelenograd_bot?start=auth_{state}" }
│
▼
Клиент открывает deep link в браузере / VK Browser
│
▼
Пользователь открывает бота в Telegram
│
▼
Бот получает /start auth_{state}
│
▼
POST /api/telegram-webhook обрабатывает:
├── Ищет/создаёт users/{tgUserId} в Firestore
├── Обновляет telegramAuthSessions/{state}:
│     status: 'done'
│     tgUserId: ...
│     tgFirstName: ...
└── (опционально) Проверяет tgLinks/{tgId} для связи с email-аккаунтом
│
▼
Клиент polling GET /api/telegram-auth-check?state={state}
├── Каждую секунду, до 25 секунд
├── status: 'pending' → продолжать
├── status: 'expired' → показать ошибку
└── status: 'done' → получить Firebase Custom Token для точного APG userId и войти
│
▼
Firebase Admin createCustomToken(linkedUserId ?? tgId)
│
▼
signInWithCustomToken(token) на клиенте
│
▼
localStorage['apg_tg_user'] = { id, name, photo, ... }
│
▼
UserApp перезагружает данные пользователя
```

### Состояния сессии

| Состояние | Описание |
|---|---|
| `pending` | Создана, ждём бота |
| `done` | Бот подтвердил |
| `expired` | Прошло 5 минут без подтверждения |

---

## Telegram Login Widget (альтернативный метод)

`POST /api/verify-telegram` — верификация данных от официального Telegram Login Widget (для web-только страниц, не используется в основном приложении).

**Верификация:**
1. Строка для проверки: все поля отсортированы и соединены `\n` в формате `key=value`
2. Secret key: `SHA256(TELEGRAM_BOT_TOKEN)`
3. Проверка: `HMAC-SHA256(data_check_string, secret_key) === hash`
4. Проверка свежести: `Date.now()/1000 - auth_date < 86400` (24 часа)

---

## Привязка Telegram к Email аккаунту

Пользователь может связать Telegram и Email аккаунты:

### Email → добавить Telegram

В ProfilePanel: кнопка «Привязать Telegram». Запускает тот же auth flow, но после успеха:
```js
POST /api/email-auth
Authorization: Bearer <Firebase ID Token текущего пользователя>
{ action: 'link-telegram', tgId, userId: 'email:user@...' }
// Transaction: проверяет владельца Firebase UID, tgLinks/{tgId}, users.linkedTelegram.tgId
```

### Telegram → добавить Email

В ProfilePanel у TG-пользователя: форма email.
```js
POST /api/email-auth
Authorization: Bearer <Firebase ID Token текущего пользователя>
{ action: 'link-email', userId: tgUserId, email }
// Transaction: проверяет владельца Firebase UID, emailIndex/{email}, users.email
```

После привязки при следующем TG-входе `/api/telegram-auth-check` возвращает `linkedUserId` и Firebase custom token. Если Telegram/email уже принадлежат другому пользователю, backend возвращает 409 и ничего не меняет.

---

## Telegram Channel

**Канал:** `https://telegram.me/apgzel`

Используется командой АПГ для публикации новостей и анонсов. Не интегрирован в код приложения (ссылка присутствует только в bot-кнопках `/links`).

---

## Хранение TG данных в Firestore

### `telegramAuthSessions/{32hexState}`

```js
{
  status: 'pending' | 'done' | 'expired',
  tgUserId: number,      // Telegram User ID
  tgUsername: string,    // @username (без @)
  tgFirstName: string,
  tgPhotoUrl: string,
  expiresAt: Timestamp,  // now + 5 minutes
  createdAt: Timestamp
}
```

Доступ: **только Admin SDK**. Client code не может ни читать, ни писать.

### `tgLinks/{tgId}`

```js
{
  userId: string,   // userId платформы (email аккаунт)
  createdAt: Timestamp
}
```

### `users/{tgUserId}` (Telegram-пользователи)

Создаются с числовым string ID Telegram: `users/'123456789'`

```js
{
  name: string,
  photo: string,
  authProvider: 'telegram',
  keys: 0,
  // ... стандартные поля users
}
```

---

## Deep Links

**Формат deep link в Telegram:**
```
https://telegram.me/apg_zelenograd_bot?start=auth_a1b2c3d4e5f6...
```

При открытии бота Telegram передаёт start parameter в `/start auth_{payload}`.
Команда `/start` без payload не завершает авторизацию и не ищет pending-сессии, чтобы исключить привязку Telegram не к тому браузеру/пользователю.

**APP URL deep links** (для перехода в приложение):
```
https://myapg.ru/?partner=abc123    ← открыть партнёра
https://myapg.ru/?expert=def456     ← открыть эксперта
https://myapg.ru/?ref=userId        ← реферальная ссылка
```

Эти ссылки публикуются в Telegram канале для привлечения пользователей в PWA.

---

## Безопасность Telegram Webhook

**Текущее состояние:** Vercel endpoint `/api/telegram-webhook` не верифицирует Telegram-подпись запроса.

**Риск:** любой может отправить POST запрос на endpoint и симулировать команды бота.

**TODO:** Добавить верификацию заголовка `X-Telegram-Bot-Api-Secret-Token` (устанавливается при `setWebhook`).

---

## Настройка Webhook

Webhook устанавливается вручную через Telegram Bot API:
```
https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://apg-app.vercel.app/api/telegram-webhook
```

При переключении на Fastify нужно обновить URL webhook.
