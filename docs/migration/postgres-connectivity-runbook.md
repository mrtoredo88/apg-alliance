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
APG_REMOTE_PREFLIGHT_EXECUTION=1 npm run account:remote-preflight -- --execute
```

Expected successful result:

```text
REMOTE_PREFLIGHT_READY
```

Expected failure behavior:

- stop after first failed connectivity stage;
- do not run `account:preflight` if PostgreSQL diagnostics fail;
- write only redacted local reports;
- print no DSN, token, service account, or secret value.

## Raw Metadata Warning

Do not use raw `yc serverless container revision list --format json` output in shared reports. It can include environment values. Use only redacted summaries such as container id, runtime type, image, network id, and status.

## Next Step After Success

After `REMOTE_PREFLIGHT_READY`, the next operator action is explicit owner approval for the first immutable Account Core production snapshot.
