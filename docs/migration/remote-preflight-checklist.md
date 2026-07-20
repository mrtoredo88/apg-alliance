# Remote Preflight Checklist

Date: 2026-07-20

## Pre-Run

- [ ] Confirm branch/commit approved for operator runtime.
- [ ] Confirm no application deploy is planned.
- [ ] Confirm one-off runtime is attached to Yandex VPC network `enpa19j9jpki1f67p6kq`.
- [ ] Confirm production PostgreSQL is not exposed publicly.
- [ ] Confirm migration environment is loaded through `scripts/lib/migration-env-loader.mjs`.
- [ ] Confirm Firebase Admin credentials are available in the operator runtime.
- [ ] Confirm raw Yandex revision metadata will not be copied to reports.

## Command

```bash
APG_REMOTE_PREFLIGHT_EXECUTION=1 npm run account:remote-preflight -- --execute
```

## Expected Checks

- [ ] DNS PASS
- [ ] TCP PASS
- [ ] TLS PASS
- [ ] read-only auth PASS
- [ ] `account:preflight` PASS
- [ ] productionChanged false
- [ ] postgresWrites 0
- [ ] snapshotStarted false
- [ ] importStarted false
- [ ] verifyStarted false
- [ ] canaryStarted false
- [ ] cutoverStarted false
- [ ] rollbackStarted false
- [ ] deployStarted false

## Stop Conditions

Stop if any of these happen:

- DNS still returns `ENOTFOUND`;
- TCP/TLS/auth fails;
- `account:preflight` reports a blocker;
- a command attempts snapshot/import/verify/canary/cutover/rollback/deploy;
- any report prints a DSN, token, private key, service account, or secret value.

## Success State

Status:

```text
REMOTE PREFLIGHT READY
```

Next step:

Create the first immutable Account Core production snapshot only after explicit owner approval.
