# APG Environment Loading

Status: `ENV LOADER ADDED`

No secret values are documented here.

## Production Backend Path

```text
server/.env
  -> server/deploy.sh get_env()
  -> yc serverless container revision deploy --environment KEY=...
  -> Yandex Serverless Container runtime
  -> Fastify process.env
```

Observed evidence:

- `server/deploy.sh` reads `server/.env` through `get_env`.
- `server/deploy.sh` passes backend variables with `--environment`.
- `server/src/server.js` and route modules read values from `process.env`.
- `server/src/lib/firebase.js` reads Firebase Admin credentials from `GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_SERVICE_ACCOUNT`.
- `server/src/apg/infrastructure/adapters/PostgresIdentityAdapter.js` reads PostgreSQL DSN from `APG_IDENTITY_DATABASE_URL`, `IDENTITY_DATABASE_URL`, `POSTGRES_DATABASE_URL`, or `DATABASE_URL`.

## Frontend Deploy Path

```text
server/.env / .env.deploy.local
  -> deploy-frontend.sh get_env()
  -> aws s3 upload
  -> optional vk-miniapps-deploy
```

Observed evidence:

- `deploy-frontend.sh` reads `YC_ACCESS_KEY` and `YC_SECRET_KEY` from `server/.env`.
- `deploy-frontend.sh` reads `MINI_APPS_ACCESS_TOKEN` from `.env.deploy.local`.
- Frontend runtime uses `import.meta.env` only for Vite variables such as `VITE_API_BASE_URL` and build mode.

## Migration Operator Path

Before this stage:

```text
server/.env
  -> not loaded by npm scripts
  -> account:preflight process.env missing PostgreSQL/Firebase keys
```

After this stage:

```text
server/.env
  -> scripts/lib/migration-env-loader.mjs
  -> account:* scripts
  -> process.env
```

The loader does not print secrets, does not override already configured environment variables by default, and reports only key names and source filenames.

## Remaining Difference

The migration operator can now see the same local secret source used by deploy scripts. The remaining PostgreSQL blocker is no longer an env-loading problem; it is DNS/network reachability to the configured production PostgreSQL host from the current machine.
