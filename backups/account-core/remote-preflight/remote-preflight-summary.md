# Account Core Remote Preflight

Generated: 2026-07-20T10:18:10.000Z

Status: `REMOTE_PREFLIGHT_BLOCKED`

## Result

The one-off operator flow stopped before remote preflight execution.

Completed:

- Created separate Serverless Container `apg-migration-operator`.
- Built and pushed operator image `cr.yandex/crpvv13u8vr3qjftdvvg/apg-migration-operator:ab88f027`.
- Confirmed image digest `sha256:1d13806e6e37b9ad6396fe9b9970cfe5049709f97a265a4dcafcddf0bdfa915b`.

Blocked:

- Yandex `revision deploy` for `apg-migration-operator` failed with `code=13 Internal error`.
- Operation ID: `bbac9l7ls7gbhu8igrac`.
- No active operator revision exists, so `/run` was not invoked.

## Production Safety

- Production `apg-api` changed: `NO`
- Production traffic switched: `NO`
- PostgreSQL public access changed: `NO`
- VPC/DNS/security groups changed: `NO`
- Feature flags changed: `NO`
- Snapshot/import/verify/canary/cutover/rollback: `NO`

## Counters

- Production data reads: `0`
- Firestore reads: `0`
- PostgreSQL writes: `0`
- Firestore writes: `0`

## Next Safe Step

Investigate Yandex operation `bbac9l7ls7gbhu8igrac` or retry only the operator revision deploy after explicit owner approval. Do not run Account Core snapshot until remote preflight passes.
