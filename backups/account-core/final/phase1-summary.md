# Account Core Production Migration v1 — Phase 1 Summary

Generated: 2026-07-20T10:44:46.551Z
Branch: migration/account-core-phase1
Commit: fa432f0c

## Status

PHASE 1 BLOCKED

## Operator

- Operator rebuilt: YES
- Required architecture: linux/amd64
- Architecture verified: YES
- Image: cr.yandex/crpvv13u8vr3qjftdvvg/apg-migration-operator:fa432f0c
- Image digest: sha256:e3072e32ff65dddea604ba649d887afd17cb3ad092a786c40f97a9057c8d9188
- Operator deployed: YES
- Operator container: apg-migration-operator
- Operator revision: bbavierknh9n40hoco0r
- apg-api deployed: NO
- apg-api traffic switch: NO

## Remote Preflight

- Remote preflight: FAILED
- Runtime assertion: PASS
- Environment loader: BLOCKED
- DNS: PASS
- TCP: PASS
- TLS: BLOCKED
- PostgreSQL auth: BLOCKED
- Firebase Admin init: PASS
- Migration manifests: PASS
- Rollback manifests: PASS
- Monitoring: PASS

## Blockers

1. environment_loader returned BLOCKED with loadedKeyCount 0 while direct DSN and Firebase Admin configuration were present.
2. TLS handshake timed out during the explicit TLS check.
3. PostgreSQL auth check failed with SELF_SIGNED_CERT_IN_CHAIN.

## Guardrails

- Snapshot: NOT RUN
- Conflict Analysis: NOT RUN
- Dry Run: NOT RUN
- Import: NOT RUN
- Verify: NOT RUN
- Canary: NOT RUN
- Cutover: NOT RUN
- Rollback: NOT RUN
- Production writes: 0
- Firestore writes: 0
- PostgreSQL writes: 0
- Firestore reads: 0
- Production data reads: 0

## Next Allowed Stage

Resolve the remote preflight blockers in the migration operator runtime, then rerun remote preflight only. Immutable snapshot remains locked until REMOTE_PREFLIGHT_PASSED.
