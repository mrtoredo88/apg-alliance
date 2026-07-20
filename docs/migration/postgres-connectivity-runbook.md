# PostgreSQL Connectivity Runbook

Date: 2026-07-20

## Goal

Run Account Core preflight from the same network class that production Fastify already uses.

## Guardrails

Forbidden:

- snapshot
- import
- verify
- canary
- cutover
- rollback
- deploy
- production writes
- DNS changes
- security group changes
- firewall changes
- opening PostgreSQL to the public internet

## Local Confirmation

Local command:

```bash
npm run postgres:diagnostics
```

Expected local result until operator networking is changed:

```text
POSTGRES_CONNECTIVITY_BLOCKED
blocked: dns_lookup ENOTFOUND
```

## Remote Production-Network Preflight

Run inside a one-off runtime attached to Yandex VPC network `enpa19j9jpki1f67p6kq`:

```bash
APG_REMOTE_OPERATOR_RUNTIME=production-vpc APG_REMOTE_PREFLIGHT_EXECUTION=1 npm run account:remote-preflight -- --execute
```

Expected successful result:

```text
REMOTE_PREFLIGHT_PASSED
```

Expected failure behavior:

- stop without snapshot/import/verify/canary/cutover/rollback/deploy;
- do not run the legacy `account:preflight` path, because it can perform Firestore reads and PostgreSQL schema checks;
- perform only no-data checks: DNS, TCP, TLS, PostgreSQL auth with `SELECT 1`, Firebase Admin initialization, env loader, manifest files, rollback files, monitoring files;
- keep `firestoreReads: 0`, `productionDataReads: 0`, and `postgresWrites: 0`;
- write only redacted local reports;
- print no DSN, token, service account, or secret value.

## Raw Metadata Warning

Do not use raw `yc serverless container revision list --format json` output in shared reports. It can include environment values. Use only redacted summaries such as container id, runtime type, image, network id, and status.

## Next Step After Success

After `REMOTE_PREFLIGHT_PASSED`, the next operator action is explicit owner approval for the first immutable Account Core production snapshot.
