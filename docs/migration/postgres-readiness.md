# Account Core PostgreSQL Readiness

Status: `BLOCKED`

Production PostgreSQL could not be verified from this environment because no PostgreSQL DSN is configured.

## Checked

- `POSTGRES_DSN`: Missing
- `APG_IDENTITY_DATABASE_URL`: Missing
- `IDENTITY_DATABASE_URL`: Missing
- `POSTGRES_DATABASE_URL`: Missing
- `DATABASE_URL`: Missing
- Account Core schema file exists: `server/src/apg/account/schema/account-core.sql`
- PostgreSQL adapter exists: `server/src/apg/account/adapters/PostgresAccountAdapter.js`
- Expected schema version: `account-core-v1-2026-07-20`

## Not Proven

- Production database existence.
- Connectivity.
- Account Core schema applied in production.
- Schema version table contents.
- User permissions.
- Required indexes.
- Transaction support.
- Advisory lock support.
- Database size and free space.
- Latency.
- Pool and timeout behavior.
- SSL enforcement.
- Backup policy.

## Blocker

`POSTGRES_DSN_NOT_CONFIGURED`

No production writes were performed.
