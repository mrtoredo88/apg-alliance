# Serverless Retry Plan

Date: 2026-07-20

## Goal

Retry only the one-off `apg-migration-operator` revision deploy after correcting image platform to `linux/amd64`.

Do not retry until owner approval is explicit.

## Minimal Fix

Build the operator image with an explicit platform:

```bash
docker buildx build \
  --platform linux/amd64 \
  -f ops/migration-operator/Dockerfile \
  -t cr.yandex/crpvv13u8vr3qjftdvvg/apg-migration-operator:<commit> \
  --push \
  .
```

Then verify manifest before deploy:

```bash
docker manifest inspect cr.yandex/crpvv13u8vr3qjftdvvg/apg-migration-operator:<commit>
```

Required result:

```text
platform.os = linux
platform.architecture = amd64
```

## Retry Scope

Allowed after approval:

1. Deploy only a new revision for `apg-migration-operator`.
2. Use VPC `enpa19j9jpki1f67p6kq`.
3. Use service account `ajegfv96md2tqri8gjdp`.
4. Use minimal operator env.
5. Invoke `/run` once.
6. Collect redacted remote preflight report.

Forbidden:

- deploying or updating `apg-api`
- switching production traffic
- snapshot/import/verify/canary/cutover/rollback
- Firestore reads/writes
- PostgreSQL schema changes/table reads/writes
- VPC/DNS/Security Group changes

## Expected Success Criteria

Remote preflight must report:

- `runtime_assertion`: PASS
- `environment_loader`: PASS
- `dsn_parse`: PASS
- `dns`: PASS
- `tcp`: PASS
- `tls`: PASS
- `postgres_auth`: PASS via `SELECT 1`
- `firebase_admin_initialization`: PASS without Firestore reads
- `productionDataReads`: 0
- `firestoreReads`: 0
- `postgresWrites`: 0
- `firestoreWrites`: 0

## Stop Conditions

Stop immediately if:

- deploy revision fails again;
- image manifest is not `linux/amd64`;
- `/run` returns `REMOTE_PREFLIGHT_BLOCKED`;
- any counter is non-zero;
- any output prints env values, DSN, tokens, private keys, or service account JSON.

## Next Step After Success

If and only if remote preflight returns `REMOTE_PREFLIGHT_PASSED`, the next separate owner-approved stage is the first immutable Account Core production snapshot.

