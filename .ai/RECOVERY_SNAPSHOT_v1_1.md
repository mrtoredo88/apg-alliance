# APG Recovery Snapshot v1.1

Дата фиксации: 2026-07-16 17:33:58 MSK

## Snapshot Identity

- Production commit: `8cb55af7be6d431c15c54590e7d660ada31261ca`
- Production version: `8cb55af7`
- Git tag: `v1.1-production`
- Branch: `main`
- Production domains:
  - `https://myapg.ru`
  - `https://apg-alliance.vercel.app`

## Production Verification

На момент создания snapshot оба production-домена возвращают одну версию:

- `https://myapg.ru/version.json` -> `{"v":"8cb55af7"}`
- `https://apg-alliance.vercel.app/version.json` -> `{"v":"8cb55af7"}`

Git state:

- `main` синхронизирован с `origin/main`.
- Tracked working tree чистый.
- Последний commit: `8cb55af7 feat: add living feed article sheet`.

## Completed Modules

Текущая production-основа включает:

- Desktop Framework
- Catalog Framework
- Detail Framework
- Living Profile
- Feed Framework
- Feed Reading
- LivingFeedArticleSheet
- Smart Media
- Profile Dashboard
- Content Studio
- Autosave
- Draft Recovery
- Scanner Reliability
- Workspace
- PWA
- Dialogs
- Meetings
- Booking
- Notifications
- Loki

## Production Architecture Notes

- Living Profile uses `LivingFeedArticleSheet` for profile feed publications.
- `News ArticleView` remains the global News section article screen.
- Shared article body/media rendering lives in `ArticleContentRenderer`.
- Profile feed publication opening is contextual and must not navigate to global News.
- Smart Media remains the shared media preview/viewer direction.
- Desktop and mobile UX must remain functionally equivalent where the same entity detail is shown.
- `myapg.ru` and `apg-alliance.vercel.app` must stay synchronized on every production release.

## Configuration Inventory

Required configuration files/directories checked in the current repo state:

- `firebase.json` - present
- `.firebaserc` - present
- `firestore.rules` - present
- `storage.rules` - present
- `vercel.json` - present
- `vite.config.js` - present
- `deploy-frontend.sh` - present
- `server/` - present
- `server/src/routes/` - present
- `server/deploy.sh` - present
- `server/deploy-cron.sh` - present
- `api/` - not present in current production repo state; backend routes are under `server/src/routes/`

Environment files present locally and not to be committed as secrets:

- `.env.local`
- `.env.deploy.local`
- `server/.env`
- `server/.env.example`

## Environment Variables

Names only. Do not store secrets in this document.

Frontend/build/runtime:

- `VITE_API_BASE_URL`
- `VITE_APP_VERSION`
- `APG_BUILD_VERSION`
- `VERCEL_GIT_COMMIT_SHA`
- `GITHUB_SHA`
- `MODE`
- `DEV`

App/backend:

- `APP_URL`
- `APP_VERSION`
- `PORT`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `FIREBASE_SERVICE_ACCOUNT`
- `FIRESTORE_EMULATOR_HOST`

Firebase/admin/maintenance:

- `OWNER_EMAIL`
- `OWNER_PASSWORD`
- `DEMO_PARTNER_OWNER_EMAILS`

Secrets and scheduled jobs:

- `CRON_SECRET`
- `ACTIVITY_SECRET`
- `EMAIL_SECRET`
- `PUSH_SECRET`
- `QR_TOKEN_SECRET`
- `RAFFLE_SECRET`

Push:

- `WEB_PUSH_VAPID_PUBLIC_KEY`
- `WEB_PUSH_VAPID_PRIVATE_KEY`
- `WEB_PUSH_VAPID_SUBJECT`

Telegram/VK:

- `TELEGRAM_BOT_TOKEN`
- `VK_SERVICE_TOKEN`
- `VK_USER_TOKEN`
- `VK_GROUP_TOKEN`

Yandex/S3/email:

- `YC_ACCESS_KEY`
- `YC_SECRET_KEY`
- `YANDEX_EMAIL`
- `YANDEX_EMAIL_PASS`
- `POSTBOX_KEY_ID`
- `POSTBOX_SECRET`

Smoke/tests/scripts:

- `SMOKE_URL`
- `SMOKE_TIMEOUT_MS`
- `SMOKE_WAIT_MS`
- `TARGETS`
- `AUTH_LIFECYCLE_URLS`
- `AUTH_LIFECYCLE_TIMEOUT_MS`
- `NEWS_TEST_API_BASE_URL`
- `NEWS_TEST_PORT`
- `REFERRER_ID`
- `INVITED_USER_ID`

## Recovery Plan

1. Clone the repository.
2. Checkout the recovery tag:

   ```bash
   git checkout v1.1-production
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Restore required environment files/secrets from the secure secret store:

   - `.env.local`
   - `.env.deploy.local`
   - `server/.env`
   - Firebase service account for server deployments

5. Verify repository state:

   ```bash
   git status
   git log -1
   ```

6. Build frontend:

   ```bash
   npm run build
   ```

7. Run core checks:

   ```bash
   npm run test:core
   ```

8. Deploy frontend:

   ```bash
   ./deploy-frontend.sh
   ```

9. Deploy backend only if recovery requires backend redeploy:

   ```bash
   cd server
   ./deploy.sh
   ```

10. Verify production versions:

   ```bash
   curl https://myapg.ru/version.json
   curl https://apg-alliance.vercel.app/version.json
   ```

11. Run production smoke:

   ```bash
   npm run smoke:prod
   ```

12. Manually check critical paths:

   - PWA startup
   - Auth login/logout
   - Home
   - Partner profile
   - Expert profile
   - Living Profile feed opening
   - Scanner
   - Workspace
   - Dialogs
   - Notifications

## Backup Recommendations

- Keep Git tag `v1.1-production` immutable.
- Keep secure backup of `.env.local`, `.env.deploy.local`, and `server/.env`.
- Maintain a secure Firebase service account backup.
- Schedule Firestore exports before major migrations.
- Keep Storage/Yandex S3 backups for uploaded media.
- Preserve DNS/domain configuration for `myapg.ru`.
- Preserve VK Mini App deployment credentials.
- Keep deploy access credentials for Yandex Cloud and Vercel/server fallback.

## QA Performed For Snapshot

- `git status --branch --short --untracked-files=no`
- `git branch --show-current`
- `git log -1 --oneline`
- `curl https://myapg.ru/version.json`
- `curl https://apg-alliance.vercel.app/version.json`
- `npm run smoke:prod`

## Snapshot Rule

This recovery point reflects production version `8cb55af7`.

Do not move or rewrite tag `v1.1-production`. If a future production checkpoint is needed, create a new tag and a new snapshot document.
