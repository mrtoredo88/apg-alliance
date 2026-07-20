# Account Core Production Migration v1 — Phase 1 Summary

Generated: 2026-07-20T11:09:34.237Z
Branch: migration/account-core-phase1
Commit: 4f56a07e

## Status

PHASE 1 BLOCKED

Gate: Conflict Analysis
Reason: unresolved P0 conflicts found after immutable snapshot.

## Operator

- Operator rebuilt: YES
- Required architecture: linux/amd64
- Architecture verified: YES
- Yandex CA installed: YES
- Yandex CA SHA-256: 6d148f85b5213445b23ad22ff45e47e1aa2be968f183f9bd6ff39de54d47a8ef
- TLS verification enabled: YES
- rejectUnauthorized: true
- Operator deployed: YES
- Operator container: apg-migration-operator
- Operator revision: bbaqatlcq7101bk9q7c8
- Operator image digest: sha256:adec1e8b094f0cc9ac77f50f2afcc224ea151d16b87c3e02eb2af59c9ea51c4c
- VPC: enpa19j9jpki1f67p6kq
- apg-api deployed: NO
- apg-api traffic switch: NO

## Remote Preflight

- Remote preflight: PASSED
- Runtime assertion: PASS
- Environment loader: PASS
- DSN parse: PASS
- DNS: PASS
- TCP: PASS
- Yandex CA: PASS
- Verified TLS: PASS
- PostgreSQL auth: PASS
- PostgreSQL SELECT 1: PASS
- Firebase Admin init: PASS
- Migration manifests: PASS
- Rollback manifests: PASS
- Monitoring: PASS
- Production data reads: 0
- Firestore reads: 0
- PostgreSQL business-table reads: 0
- PostgreSQL writes: 0
- Firestore writes: 0

## Immutable Snapshot

- Snapshot: CREATED
- Snapshot status: SNAPSHOT_CREATED
- Snapshot SHA-256: 3e470904ebcdbd54aebd363ec8f65e9367cea28d87fd04d73f0ef2a38e2ce8d7
- Account records: 127
- users: 127
- tgLinks: 10
- telegramAuthSessions: 166
- partners: 18
- experts: 8
- bookings collection group: 12
- Raw snapshot path: backups/account-core/snapshot/raw/account-core-snapshot-2026-07-20T11-08-53-201Z.json
- Raw snapshot committed to Git: NO

## Conflict Analysis

- Conflict analysis: BLOCKED
- Conflict count: 14
- Unresolved P0 conflicts: 1
- P0 type: duplicate_admin_or_owner_email
- Report redacted: YES

## Dry Run

- Dry run: NOT RUN
- Expected inserts: N/A
- Expected updates: N/A
- Expected unchanged: N/A

## Stop Gate

- Import: NOT RUN
- Verify: NOT RUN
- Canary: NOT RUN
- Observation: NOT RUN
- Cutover: NOT RUN
- Rollback: NOT RUN
- Production writes: 0
- Firestore writes: 0
- PostgreSQL migration writes: 0

## Next Allowed Stage

Resolve or explicitly approve the unresolved P0 Account Core conflict, then rerun conflict analysis. Dry run remains locked until unresolved P0 conflicts = 0.
