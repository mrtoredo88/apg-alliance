# APG Recovery Snapshot v1.0

Дата: 2026-07-16

## Snapshot Identity

- Recovery name: APG Foundation Release
- Git commit: `acf1149dc5f96b7350f7241893e237cf78de82cc`
- Git tag: `v1.0-foundation`
- Branch: `main`
- Production version: `acf1149d`
- Production status: stable at snapshot time

## Production Domains

- `https://myapg.ru`
- `https://apg-alliance.vercel.app`

Both production domains returned:

```json
{"v":"acf1149d"}
```

## Completed Foundation Modules

- Shared Desktop UI Framework
- Desktop Catalog Framework
- Desktop Detail Framework
- Desktop Experience v1
- Desktop Top Overview
- Desktop public sections: News, Events, Partners, Experts, Offers, Rewards, Profile
- Living Profile
- Feed Framework
- Smart Media Framework
- Profile Media Viewer
- Photo Gallery and Video Viewer
- Performance Optimization
- Workspace v1
- Workspace Intelligence
- Workspace Meetings
- Workspace Events
- Workspace News
- Workspace Analytics
- Workspace Promotions
- Workspace Gifts
- PWA runtime and update flow
- Booking and Meetings
- Context Dialogs
- Dialog Notifications
- Notification Pipeline
- Loki assistant
- Intelligence Platform foundation
- AI Context
- AI Memory
- Activity Timeline
- Recommendation Engine
- Analytics Collector
- Telegram URL normalization
- Auth lifecycle regression guard

## Deployment Snapshot

Build pipeline:

1. Commit source changes first.
2. Run `npm run build`.
3. `vite.config.js` writes `dist/version.json` from current Git commit.
4. Deploy frontend with `./deploy-frontend.sh`.

Frontend deploy pipeline:

1. `./deploy-frontend.sh` runs `npm run build`.
2. Uploads hashed assets from `dist/assets/` to S3 bucket `myapg-frontend` with immutable cache.
3. Uploads no-cache files:
   - `index.html`
   - `sw.js`
   - `manifest.json`
   - `version.json`
   - `network-diagnostics-lite` when present
4. Uploads static files with one-day cache.
5. Deploys the same build to VK Mini App hosting when `MINI_APPS_ACCESS_TOKEN` is available.

Production domains:

- `myapg.ru` serves the S3 production build.
- `apg-alliance.vercel.app` serves the Vercel production build.
- Both domains must expose the same `version.json` value before a release is considered closed.

Legacy support:

- Vite legacy chunks are present.
- `nomodule` fallback is present in production HTML.
- Production HTML must not reference `/src/main.jsx`.

## Firebase And Hosting Configuration

Detected configuration files and directories:

- `.firebaserc`
- `firebase.json`
- `firestore.rules`
- `storage.rules`
- `vercel.json`
- `vite.config.js`
- `deploy-frontend.sh`
- `server/`
- `server/src/server.js`
- `server/deploy.sh`
- `server/deploy-cron.sh`
- `server/Dockerfile`
- `api/` was not present in the current max-depth config scan.
- `functions/` was not present in the current max-depth config scan.
- `firestore.indexes.json` was not present in the current max-depth config scan.

`firebase.json` currently defines:

- Firestore rules: `firestore.rules`
- Storage rules: `storage.rules`
- Firestore emulator: port `8080`
- Emulator UI: port `4000`

No Firebase or Firestore files were changed for this snapshot.

## Environment Variable Names

Only names are listed. Values and secrets must never be committed.

Frontend/build:

- `VITE_API_BASE_URL`
- `VITE_APP_VERSION`
- `VERCEL_GIT_COMMIT_SHA`

Firebase/server:

- `GOOGLE_APPLICATION_CREDENTIALS`
- `FIREBASE_SERVICE_ACCOUNT`

Yandex/S3/deploy:

- `YC_ACCESS_KEY`
- `YC_SECRET_KEY`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

VK:

- `MINI_APPS_ACCESS_TOKEN`
- `VK_SERVICE_TOKEN`
- `VK_USER_TOKEN`
- `VK_GROUP_TOKEN`

Telegram:

- `TELEGRAM_BOT_TOKEN`

Email:

- `YANDEX_EMAIL`
- `YANDEX_EMAIL_PASS`
- `EMAIL_SECRET`

Test-only / diagnostics:

- `NEWS_TEST_API_BASE_URL`
- `NEWS_TEST_PORT`

## Recovery Plan

1. Clone repository.
2. Checkout the recovery tag:

```bash
git fetch --tags
git checkout v1.0-foundation
```

3. Restore required environment files and secrets from the secrets backup.
4. Install dependencies:

```bash
npm install
```

5. Build:

```bash
npm run build
```

6. Verify local `dist/version.json` points to the checked-out commit.
7. Deploy frontend:

```bash
./deploy-frontend.sh
```

8. Deploy backend only if backend recovery is required:

```bash
cd server
./deploy.sh
```

9. Verify production:

```bash
curl -fsS https://myapg.ru/version.json
curl -fsS https://apg-alliance.vercel.app/version.json
npm run smoke:prod
```

10. Confirm:

- `myapg.ru/version.json` matches the recovery commit short hash.
- `apg-alliance.vercel.app/version.json` matches the same short hash.
- Root pages load without fatal runtime text.
- Production HTML does not reference `/src/main.jsx`.

## Backup Recommendations

Git:

- Keep `v1.0-foundation` tag protected.
- Do not rewrite history around this tag.
- Keep GitHub `main` and tags backed up.

Firestore:

- Schedule regular Firestore exports.
- Store exports outside the primary Firebase project.
- Keep a dated export matching this recovery snapshot.

Storage:

- Back up Yandex S3 bucket `myapg-frontend`.
- Back up uploaded user media and QR/static assets separately if stored outside the frontend bucket.

Secrets:

- Store all ENV values in a password manager or cloud secret manager.
- Include S3/Yandex, Firebase service account, Telegram bot, VK tokens, email credentials, and Vercel/VK deployment secrets.
- Never store secret values in Git.

DNS and domains:

- Back up DNS records for `myapg.ru`.
- Document domain registrar access.
- Document Vercel project access for `apg-alliance.vercel.app`.

Release verification:

- Every production restore must end with `version.json` checks on both domains and `npm run smoke:prod`.

## QA Evidence

Git:

- Branch checked: `main`
- Last commit checked: `acf1149dc5f96b7350f7241893e237cf78de82cc`
- Commit message: `feat: polish living profile ux`
- Tracked working tree: clean at snapshot creation time.
- Existing untracked artifacts were present and intentionally not modified.

Production:

- `https://myapg.ru/version.json` returned `{"v":"acf1149d"}`
- `https://apg-alliance.vercel.app/version.json` returned `{"v":"acf1149d"}`

Smoke:

- `npm run smoke:prod` had passed on `myapg.ru` for version `acf1149d` after the previous production deploy.

## Restore Command Summary

```bash
git fetch --tags
git checkout v1.0-foundation
npm install
npm run build
./deploy-frontend.sh
curl -fsS https://myapg.ru/version.json
curl -fsS https://apg-alliance.vercel.app/version.json
npm run smoke:prod
```
