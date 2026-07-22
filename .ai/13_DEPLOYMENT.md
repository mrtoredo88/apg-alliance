# 13 DEPLOYMENT

## Архитектура деплоя

```
Frontend  →  Yandex Cloud S3 (myapg-frontend)  →  https://myapg.ru
API       →  Vercel Functions                   →  https://apg-app.vercel.app/api/
         OR  Yandex Serverless Containers       →  https://bbangqkf2d4pa9855lu0.containers.yandexcloud.net
Photos    →  Yandex Cloud S3 (apg-photos)       →  https://storage.yandexcloud.net/apg-photos/
```

---

## Локальный запуск

### Требования

- Node.js 20+
- npm
- Firebase CLI (опционально)
- Yandex Cloud CLI `yc` (для Docker деплоя)

### Frontend dev server

```bash
cd /Users/vitalijegorov/Desktop/apg-app
npm install
npm start    # Vite dev server на http://localhost:5173
```

### VK Mini App tunnel (для тестирования в VK)

```bash
npm run tunnel   # VK CLI tunnel
```

Требует: VK CLI установлен, конфиг в `vk-hosting-config.json`.

### API локально

Fastify сервер:
```bash
cd server
npm install
# Создать server/.env с нужными переменными
node src/server.js
```

Vercel Functions локально:
```bash
npx vercel dev   # поднимает /api/* через Vercel CLI
```

### Переменные окружения (локальные)

Создать `server/.env`:
```
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
VK_SERVICE_TOKEN=vk1.a...
VK_GROUP_TOKEN=vk1.a...
PUSH_SECRET=your-secret
RAFFLE_SECRET=your-secret
ACTIVITY_SECRET=your-secret
CRON_SECRET=auto
YC_ACCESS_KEY=...
YC_SECRET_KEY=...
TELEGRAM_BOT_TOKEN=...
POSTBOX_KEY_ID=...
POSTBOX_SECRET=...
```

Создать `.env.local` (для Vite):
```
VITE_API_BASE_URL=http://localhost:3000
```

---

## Сборка Frontend

```bash
npm run build
```

**Что происходит:**
1. Vite компилирует React JSX + ESM
2. Tree-shaking, минификация через esbuild + terser
3. Code splitting: `vendor-react-*.js`, `vendor-firebase-*.js`, отдельные чанки per page
4. `versionPlugin` записывает `dist/version.json` с `{ v: "gitShortHash" }`
5. Все файлы в `dist/`

**Чанки в dist/assets/:**
- `vendor-react-*.js` — React, ReactDOM, react-router-dom
- `vendor-firebase-*.js` — Firebase SDK
- `AdminPanel-*.js` — AdminPanel (~218KB gzip 60KB)
- `index-*.js` — UserApp + HomePanel (~206KB gzip 63KB)
- Отдельные чанки для каждого lazy-loaded экрана (6–28KB)

---

## Деплой Frontend → Yandex S3

### Скрипт: `deploy-frontend.sh`

```bash
./deploy-frontend.sh
```

**Что делает:**
1. Читает `YC_ACCESS_KEY` и `YC_SECRET_KEY` из `server/.env`
2. `npm run build` (если dist не актуален)
3. Загружает `dist/assets/` с `cache-control: max-age=31536000, immutable` (1 год)
4. Загружает `index.html`, `manifest.json`, `sw.js` с `cache-control: no-cache`
5. Загружает остальные файлы с `cache-control: max-age=86400` (1 день)
6. Endpoint: `https://storage.yandexcloud.net`, bucket: `myapg-frontend`, region: `ru-central1`

### Правило деплоя (КРИТИЧНО)

```bash
# ❌ НЕПРАВИЛЬНО: сначала build, потом commit
npm run build
git commit -m "feat: ..."

# ✅ ПРАВИЛЬНО: сначала commit src, потом build
git add src/
git commit -m "feat: ..."  # ← version.json запишет ЭТО hash
npm run build              # dist/version.json = новый hash
./deploy-frontend.sh       # деплой с правильным hash
```

Причина: `versionPlugin` берёт hash текущего HEAD коммита. Если коммит не создан — hash будет от предыдущего коммита, и клиенты не поймут что есть обновление.

---

## Деплой API → Vercel

```bash
npx vercel --prod
```

или через `ship.sh`:
```bash
./ship.sh  # build + git commit + git push + vercel --prod
```

Vercel автоматически:
- Подхватывает `api/*.js` как serverless functions
- Применяет `vercel.json` (headers, rewrites, crons)
- Использует env vars из Vercel Dashboard

### Vercel env vars (настраиваются в Dashboard)

Аналог `server/.env` — все те же переменные устанавливаются в Vercel Project Settings → Environment Variables.

### Cron Jobs

Настроены в `vercel.json`:
```json
"crons": [
  { "path": "/api/raffle-draw",    "schedule": "0 10 * * *" },
  { "path": "/api/activity-index", "schedule": "0 3 * * *"  }
]
```

Vercel добавляет `Authorization: Bearer {CRON_SECRET}` автоматически.

---

## Деплой API → Yandex Serverless Containers

### Сборка Docker образа

```bash
cd server
docker build -t cr.yandex/crpvv13u8vr3qjftdvvg/apg-api:latest .
docker push cr.yandex/crpvv13u8vr3qjftdvvg/apg-api:latest
```

### Деплой контейнера

```bash
./server/deploy.sh
```

**Параметры контейнера:**
- CPU: 1 core
- RAM: 512 MB
- Concurrency: 16 запросов одновременно
- Timeout: 30 секунд
- Min instances: 0 (cold start при бездействии)
- Service account: `ajegfv96md2tqri8gjdp`

### Переключение API

Чтобы переключиться с Fastify на Vercel:
```bash
# В .env.local (для local dev)
VITE_API_BASE_URL=''

# Для продакшн: убрать VITE_API_BASE_URL из Vercel env vars
# или установить его в ''
```

---

## Деплой VK Mini App

```bash
npm run deploy   # vite build + vk-miniapps-deploy
```

Деплоит в VK Hosting (альтернатива S3). Используется реже.

---

## Telegram: getUpdates-поллинг (webhook отключён)

С 2026-07-13 бот работает БЕЗ webhook: входящая доставка Telegram → Yandex Cloud
оказалась хронически ненадёжной (getWebhookInfo: «Connection timed out», апдейты
приходили с опозданием 30–70 минут, авторизация с TTL сессии 5 минут ломалась).

Текущая схема (server/src/lib/telegramUpdates.js):
- во время авторизации апдейты забирает цикл `/api/telegram-auth-check` (каждую ~1 с);
- в фоне — Yandex timer-триггер `apg-telegram-poll` раз в минуту → `/api/telegram-poll`
  (секрет CRON_SECRET, создаётся в `server/deploy-cron.sh`);
- offset и метрики — в Firestore `config/telegramPolling`; статус виден в
  `/api/system-status` → `telegramAuth` и в APG Health → Runtime.
- APG Health → Runtime также сверяет frontend `/version.json`, backend `/version`
  и показывает последние `telegramAuthSessions` для быстрого production triage.
- VPC `default` использует NAT gateway `apg-telegram-egress` и route table
  `apg-backend-egress` (`0.0.0.0/0`), привязанную к трём default subnet. Этот route нужен
  container для Telegram Bot API egress при сохранении private network access к PostgreSQL.

⚠️ Webhook НЕ устанавливать: при активном webhook getUpdates возвращает 409 и
поллинг перестаёт работать. Если когда-то возвращаете webhook — сначала уберите
поллинг из auth-check и cron.

---

## Мониторинг

Нет автоматизированного мониторинга. Вручную:
- Vercel Dashboard — функция логи, cron статус
- Firebase Console — Firestore, Auth, FCM
- Yandex Cloud Console — Container логи, S3 статистика

AdminPanel вкладка «Диагностика» — ручная проверка сервисов.

---

## Rollback

### Frontend

S3 не имеет встроенного versioning в этой конфигурации. Rollback:
```bash
git checkout <previous-commit>
npm run build
./deploy-frontend.sh
```

### Vercel API

```bash
npx vercel rollback   # откатывает к предыдущему deployment
```

### Yandex Containers

Пересборка и деплой предыдущего образа:
```bash
docker tag cr.yandex/.../apg-api:previous cr.yandex/.../apg-api:latest
docker push ...
./server/deploy.sh
```

---

## Переменные окружения: полный список

### Frontend (Vite)

| Var | Default | Описание |
|---|---|---|
| `VITE_API_BASE_URL` | `https://bbangqkf2d4pa9855lu0.containers.yandexcloud.net` | URL API бэкенда |

### Backend (Vercel / Fastify)

| Var | Required | Описание |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | ✅ | JSON строка Firebase Admin SDK credentials |
| `VK_SERVICE_TOKEN` / `VK_USER_TOKEN` | ✅ для VK News | Сервисный или пользовательский VK токен для `wall.get`; предпочтительнее group token |
| `VK_GROUP_TOKEN` | fallback | VK Community API токен; может не подходить для `wall.get` |
| `PUSH_SECRET` | ✅ | Секрет для `/api/send-push` |
| `RAFFLE_SECRET` | ✅ | Секрет для ручного розыгрыша |
| `ACTIVITY_SECRET` | ✅ | Секрет для ручного пересчёта активности |
| `CRON_SECRET` | auto | Автоматически Vercel при cron вызовах |
| `YC_ACCESS_KEY` | ✅ | Yandex S3 access key |
| `YC_SECRET_KEY` | ✅ | Yandex S3 secret key |
| `TELEGRAM_BOT_TOKEN` | ✅ | Telegram Bot API token |
| `POSTBOX_KEY_ID` | optional | Yandex Postbox key ID (email) |
| `POSTBOX_SECRET` | optional | Yandex Postbox secret |
| `YANDEX_EMAIL` | optional | SMTP email (fallback) |
| `YANDEX_EMAIL_PASS` | optional | SMTP password (fallback) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Docker only | Путь к service account файлу внутри контейнера |
| `PORT` | 3000 | Порт Fastify сервера |
