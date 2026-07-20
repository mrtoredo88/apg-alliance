# APG Production Infrastructure Readiness v1

Status: `PREFLIGHT BLOCKED`

Scope: Account Core infrastructure readiness only. No snapshot, import, verify, canary, cutover, rollback, deploy, feature flag change, Firestore write, PostgreSQL write, or production data mutation was performed.

## Component Matrix

| Component | Status | Blocker |
|---|---|---|
| PostgreSQL | BLOCKED | Production DSN is not configured in this operator environment, so connectivity, schema, permissions, indexes, transactions, advisory locks, storage, latency, pool, timeout, SSL, and backup policy cannot be proven. |
| Firebase Admin | BLOCKED | Firebase Admin credentials are not configured in this operator environment, so read access and immutable snapshot capability cannot be proven. |
| Secrets | BLOCKED | PostgreSQL DSN, Firebase Admin credentials, encryption key, backup path, and monitoring credentials are missing from this environment. |
| Rollback | BLOCKED | Rollback flags and script exist, but production rollback manifests, checkpoints, and reports are not yet proven. |
| Monitoring | BLOCKED | Account metrics exist, but full post-cutover observability for PostgreSQL reads/writes, Firestore reads/writes, fallback, role/cabinet/owner bootstrap, and hidden bypasses is not yet proven in production. |
| Backup | BLOCKED | Local directories and Git exclusions exist, but encrypted snapshot capability is blocked by missing encryption key and missing production read credentials. |
| APG Health | BLOCKED | `/api/system-status` exposes Account Core snapshot, but production authenticated APG Health view and full Account Core migration metrics were not verified. |
| Build | PASS | `npm run build` completed successfully. |
| Readiness | BLOCKED | `npm run readiness:production` stops because `account:preflight` is blocked. |

## What Prevents `PREFLIGHT_PASS`

- Production PostgreSQL credentials are missing from the current environment.
- Firebase Admin credentials are missing from the current environment.
- Migration encryption/backup/monitoring secrets are missing from the current environment.
- Working tree is not clean because of existing local artifacts and `.DS_Store`.
- Rollback infrastructure is present only as a flag/script plan; production rollback artifacts are not proven.
- Monitoring is not proven at the production Account Core cutover level.

## Fixable Without Production Data Changes

- Provide the required secrets to the operator environment without printing values.
- Clean or isolate unrelated local artifacts before running production migration commands.
- Add non-secret rollback manifests/checklists and monitoring expectations.
- Re-run `npm run account:preflight` and `npm run readiness:production`.

## Requires Production Access

- PostgreSQL connectivity and schema verification.
- Firebase Admin read verification.
- Backup encryption verification against the real snapshot path.
- APG Health authenticated production verification.
- Monitoring credential verification.

## Requires Owner Confirmation

- Providing production secrets to the migration environment.
- Confirming where encrypted raw snapshots must be stored.
- Confirming rollback/monitoring operators and escalation path.
- Explicit approval before the future `account:snapshot` stage.

## Next Automatic Stage After `PREFLIGHT_PASS`

The next stage is `account:snapshot`, which must create an immutable read-only Account Core Firestore snapshot and stop before conflict analysis/import unless the snapshot is created and verified.
