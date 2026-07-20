# Account Core PostgreSQL Readiness

Status: `BLOCKED`

Production PostgreSQL DSN is now visible to the migration operator through `scripts/lib/migration-env-loader.mjs`, but connectivity is blocked by DNS/network resolution from this machine.

## Checked

- PostgreSQL DSN group: Found through migration environment loader.
- Account Core schema file exists: `server/src/apg/account/schema/account-core.sql`
- PostgreSQL adapter exists: `server/src/apg/account/adapters/PostgresAccountAdapter.js`
- Expected schema version: `account-core-v1-2026-07-20`

## Not Proven

- Connectivity.
- Production database existence from this operator network.
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

`postgres_connectivity`: DNS/network resolution failed for the configured PostgreSQL host. The host value is redacted in reports.

No production writes were performed.
