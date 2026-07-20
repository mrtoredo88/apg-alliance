# One-Off Migration Operator

Date: 2026-07-20

## Goal

Run only `account:remote-preflight` from the same Yandex VPC path as production `apg-api`, without changing `apg-api` or opening PostgreSQL publicly.

## Guardrails

Forbidden:

- Account Core snapshot/import/verify/canary/cutover/rollback
- Firestore reads and writes
- PostgreSQL schema changes, table reads, and writes
- `apg-api` revision deploy
- production traffic switch
- VPC, DNS, subnet, security group, or PostgreSQL access changes
- printing environment values or credentials

Allowed:

- create a temporary `apg-migration-operator` Serverless Container
- deploy the dedicated operator image
- run no-data remote preflight
- collect redacted reports
- delete or leave the operator at `min-instances=0`

## Runtime

The operator uses:

- Yandex Serverless Container: `apg-migration-operator`
- VPC: `enpa19j9jpki1f67p6kq`
- Service account: `ajegfv96md2tqri8gjdp`
- Concurrency: `1`
- Min instances: `0`
- Command executed by endpoint: `npm run account:remote-preflight -- --execute`

## Minimal Environment

Only these values are copied from the latest `apg-api` revision:

- `APG_IDENTITY_DATABASE_URL`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `IDENTITY_PROVIDER`
- `IDENTITY_STORAGE`
- `IDENTITY_DUAL_READ`
- `IDENTITY_DUAL_WRITE`
- `IDENTITY_FALLBACK`

Operator-only environment:

- `APG_REMOTE_OPERATOR_RUNTIME=production-vpc`
- `APG_REMOTE_PREFLIGHT_EXECUTION=1`
- `APG_OPERATOR_TOKEN`

## Local Pre-Checks

```bash
npm run account:remote-preflight
npm run build
```

## Deploy Operator

```bash
SOURCE_COMMIT=$(git rev-parse --short HEAD) node scripts/account-operator-deploy.mjs
```

The helper prints the generated operator token once. Do not paste it into reports.

## Invoke Operator

```bash
curl -sS -X POST "$OPERATOR_URL/run" \
  -H "Authorization: Bearer $(yc iam create-token)" \
  -H "x-operator-token: $APG_OPERATOR_TOKEN"
```

Expected counters:

- `productionDataReads: 0`
- `firestoreReads: 0`
- `postgresWrites: 0`
- `firestoreWrites: 0`

## Stop

After the report is collected, do not run snapshot. Leave the operator at `min-instances=0` or delete it after explicit owner approval.
