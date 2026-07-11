# Backend architecture

Дата актуализации: 2026-07-11.

## Целевая схема

```text
Frontend / VK Mini App / PWA
        ↓
Fastify API в Yandex Serverless Containers
        ↓
Firestore
        ↓
Yandex Object Storage
        ↓
Push / Telegram / VK / AI providers
        ↓
Yandex timer triggers
```

Backend больше не имеет обязательной зависимости от Vercel Functions. Runtime-реализация API находится в `server/src/routes/*`, точка входа — `server/src/server.js`.

## Frontend routing to backend

Frontend использует `src/constants.js`:

- production default: `https://bbangqkf2d4pa9855lu0.containers.yandexcloud.net`;
- `VITE_API_BASE_URL` можно задать только для явного стенда или локального backend;
- пустой override не переключает приложение на `/api` текущего домена.

## Fastify routes

| Route | Method | Purpose | Main callers |
|---|---:|---|---|
| `/health` | GET | Container health + Firestore ping | smoke/deploy |
| `/api/public-data` | GET | Public bootstrap data | `UserApp`, partnership/profile flows |
| `/api/vk-news` | GET | VK wall sync/cache for news | `UserApp`, diagnostics, regression scripts |
| `/api/news-comments` | GET/POST | News comments and moderation | `NewsPage`, `AdminPanel` |
| `/api/news-engagement` | POST | News views/reactions/share feedback | `NewsPage` |
| `/api/user-actions` | POST | Protected user/cabinet/economy actions | `userApi`, `rewardApi`, profile/cabinet flows |
| `/api/admin-actions` | POST | Protected admin mutations | `AdminPanel` |
| `/api/admin-security` | POST | Admin roles, sessions, security journal | `AdminPanel` |
| `/api/admin-login` | POST | Admin password login and custom token | `AdminPanel` |
| `/api/system-status` | GET | Admin system diagnostics | `AdminPanel` |
| `/api/upload-photo` | POST | Upload media to Yandex S3 | `PhotoUpload`, questionnaires |
| `/api/email-auth` | POST | Email OTP, linking, referral actions | auth/profile flows |
| `/api/telegram-auth-start` | POST | Start Telegram auth session | `ProfilePanel` |
| `/api/telegram-auth-check` | GET | Poll Telegram auth session | `ProfilePanel` |
| `/api/telegram-webhook` | POST | Telegram bot webhook | Telegram Bot API |
| `/api/verify-telegram` | POST | Telegram Login Widget verification | login/linking |
| `/api/send-push` | POST | FCM/Web Push single/broadcast send | `AdminPanel`, raffle |
| `/api/raffle-draw` | POST | Scheduled/manual raffle draw | Yandex timer, `AdminPanel` |
| `/api/activity-index` | POST | Scheduled/manual partner activity score | Yandex timer, `AdminPanel` |
| `/api/expert-rotation` | POST | Scheduled/manual expert ambassador rotation | Yandex timer, `AdminPanel` |
| `/api/qr-token` | POST | QR token issue/scan logic | `rewardApi` |
| `/api/loki-editor` | POST | Loki editorial/AI tooling | `AdminPanel` |
| `/api/public-submit` | GET/POST | Public questionnaires, AI import, partnership flow | `PublicSubmitPage`, `PartnershipPage` |
| `/api/partnership-application` | POST | Dedicated partnership application route | partnership flow/future integrations |

## Removed Vercel Functions

The legacy `api/` directory was removed after route parity was confirmed in Fastify:

- `_admin-security.js`
- `_firebase-admin.js`
- `activity-index.js`
- `admin-actions.js`
- `admin-login.js`
- `admin-security.js`
- `config.js`
- `email-auth.js`
- `expert-rotation.js`
- `loki-editor.js`
- `news-comments.js`
- `news-engagement.js`
- `public-data.js`
- `public-submit.js`
- `qr-token.js`
- `raffle-draw.js`
- `send-push.js`
- `system-status.js`
- `telegram-auth-check.js`
- `telegram-auth-start.js`
- `telegram-webhook.js`
- `upload-photo.js`
- `user-actions.js`
- `verify-telegram.js`
- `vk-news.js`

`vercel.json` and the old `ship.sh` deploy wrapper were removed with the same migration.

## Cron

Cron is configured by `server/deploy-cron.sh` through Yandex timer triggers.

| Trigger | Schedule | Target |
|---|---|---|
| `apg-raffle-draw` | `0 10 * * ? *` | `POST /api/raffle-draw` |
| `apg-activity-index` | `0 3 * * ? *` | `POST /api/activity-index` |
| `apg-expert-rotation` | `0 0 ? * MON *` | `POST /api/expert-rotation` |

`raffle-draw` получает `RAFFLE_SECRET`, `activity-index` получает `ACTIVITY_SECRET`. Секреты берутся из `server/.env` во время создания trigger payload и не печатаются в лог деплоя.

## Webhook and external integrations

- Telegram webhook: `POST /api/telegram-webhook` on the Yandex container URL.
- Telegram Login Widget: `POST /api/verify-telegram`.
- VK: `/api/vk-news` pulls VK wall posts; отдельного входящего VK webhook сейчас нет.
- Push: `/api/send-push`.
- AI/Loki: `/api/loki-editor` and AI import logic inside `/api/public-submit`.
- Payments: production route is not implemented yet; future payment webhooks must be added under `server/src/routes/*` and registered in `server/src/server.js`.

## Deploy process

1. Commit source changes first.
2. `npm run build`
3. `./deploy-frontend.sh`
4. Build and push container image:
   `docker buildx build --platform linux/amd64 -f server/Dockerfile -t cr.yandex/crpvv13u8vr3qjftdvvg/apg-api:latest --push .`
5. Deploy Yandex Container:
   `./server/deploy.sh`
6. Deploy/update Yandex timer triggers:
   `./server/deploy-cron.sh`
7. Smoke test production.

## Environment variables

Runtime env is owned by Yandex Container deployment. Main groups:

- Firebase Admin: service account/project/private key/client email;
- Firebase client config used by auth helpers;
- Telegram bot: token, bot username, optional webhook secret;
- VK news import: service/user/group token;
- Yandex Object Storage: endpoint, bucket, region, access key, secret key;
- Push: VAPID and FCM credentials;
- Cron/manual operations: `RAFFLE_SECRET`, `ACTIVITY_SECRET`; optional `CRON_SECRET` remains only as backward-compatible external authorization in the route code;
- Loki/AI: provider keys where enabled.

## Request lifecycle

1. Frontend builds request URL from `API_BASE_URL`.
2. Fastify receives request, applies CORS and frame headers.
3. Route validates auth/role/secret where required.
4. Route reads/writes Firestore through Firebase Admin SDK.
5. Media routes use Yandex Object Storage.
6. Integration routes call Telegram, VK, Push or AI providers.
7. Response returns a normalized JSON shape to the client.
8. Diagnostics/errors are recorded through the centralized logging flow.

## Audit result

- Frontend direct calls to legacy Vercel host: none found.
- Frontend `/api/*` calls: all are built through `API_BASE_URL`.
- Used Vercel Functions left in repo: none.
- Duplicate endpoint implementations left in repo: none.
- Remaining Vercel references are only historical notes in older `.ai` knowledge files or package metadata, not runtime code.
