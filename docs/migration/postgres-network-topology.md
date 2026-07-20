# PostgreSQL Network Topology

Date: 2026-07-20

Scope: Account Core PostgreSQL production network integration.

No deploy, snapshot, import, verify, canary, cutover, rollback, production write, DNS change, firewall change, or security group change was performed.

## Current Local Path

```text
Migration Script
  -> local Node.js
  -> local DNS resolver
  -> PostgreSQL hostname
  -> ENOTFOUND
  -> TCP/TLS/auth are never reached
```

Evidence:

- `APG_IDENTITY_DATABASE_URL` is loaded by the migration environment loader.
- DSN parses successfully.
- `postgres:diagnostics` stops at `dns_lookup` with `ENOTFOUND`.

## Production Backend Path

```text
Production Fastify
  -> Yandex Serverless Container apg-api
  -> image cr.yandex/crpvv13u8vr3qjftdvvg/apg-api:latest
  -> Yandex VPC network enpa19j9jpki1f67p6kq
  -> Managed PostgreSQL internal/private endpoint
  -> PostgreSQL
```

Evidence:

- `server/deploy.sh` deploys `apg-api` with `--network-id enpa19j9jpki1f67p6kq`.
- The same deploy passes `APG_IDENTITY_DATABASE_URL` into the container environment.
- `server/Dockerfile` runs Fastify with `server/src/server.js`.
- `server/src/apg/infrastructure/adapters/PostgresIdentityAdapter.js` reads the same DSN group.

## Difference

| Layer | Local migration operator | Production backend |
|---|---|---|
| Runtime | local Node.js | Yandex Serverless Container |
| DNS | local resolver | Yandex VPC/container resolver |
| Network | local public internet/private DNS unavailable | `enpa19j9jpki1f67p6kq` |
| PostgreSQL endpoint | configured but not resolvable | expected to resolve from VPC |
| Required change | none to PostgreSQL | run operator in same VPC path |

## Important Security Note

Raw Yandex revision metadata can include environment variable values. Do not paste raw `yc serverless container revision list --format json` output into reports or tickets. Use redacted summaries only.
