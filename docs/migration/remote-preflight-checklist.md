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
APG_REMOTE_OPERATOR_RUNTIME=production-vpc APG_REMOTE_PREFLIGHT_EXECUTION=1 npm run account:remote-preflight -- --execute
```

## Expected Checks

- [ ] runtime assertion PASS
- [ ] environment loader PASS
- [ ] DSN parse PASS, without printing DSN
- [ ] DNS PASS
- [ ] TCP PASS
- [ ] TLS PASS
- [ ] PostgreSQL auth PASS via `SELECT 1`
- [ ] Firebase Admin initialization PASS, without Firestore reads
- [ ] migration manifests PASS
- [ ] rollback manifests PASS
- [ ] monitoring manifests PASS
- [ ] productionDataReads 0
- [ ] firestoreReads 0
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
- runtime assertion is missing;
- Firebase Admin cannot initialize;
- any step attempts a Firestore read;
- any step attempts a PostgreSQL production data read or write;
- a command attempts snapshot/import/verify/canary/cutover/rollback/deploy;
- any report prints a DSN, token, private key, service account, or secret value.

## Success State

Status:

```text
REMOTE PREFLIGHT PASSED
```

Next step:

Create the first immutable Account Core production snapshot only after explicit owner approval.
