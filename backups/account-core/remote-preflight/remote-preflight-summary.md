# Account Core Remote Preflight

Generated: 2026-07-20T10:44:46.551Z
Status: REMOTE_PREFLIGHT_BLOCKED

## Runtime

- Operator container: apg-migration-operator
- Operator container ID: bbatdc5luq828rcn1tav
- Operator revision ID: bbavierknh9n40hoco0r
- Image digest: sha256:e3072e32ff65dddea604ba649d887afd17cb3ad092a786c40f97a9057c8d9188
- VPC: enpa19j9jpki1f67p6kq
- Service account: ajegfv96md2tqri8gjdp
- Source commit: fa432f0c

## Checks

- DNS: PASS
- TCP: PASS
- TLS: BLOCKED
- PostgreSQL auth: BLOCKED
- Firebase Admin init: PASS

## Counters

- Production data reads: 0
- Firestore reads: 0
- PostgreSQL writes: 0
- Firestore writes: 0

## Guardrails

- Snapshot started: false
- Import started: false
- Verify started: false
- Canary started: false
- Cutover started: false
- Rollback started: false
