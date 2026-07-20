# Account Core Monitoring Readiness

Status: `BLOCKED`

Account Core exposes local metrics and `/api/system-status` includes an Account Core snapshot, but production post-cutover monitoring is not fully proven.

## Existing

- Account metrics counters in `server/src/apg/account/services/AccountMetrics.js`:
  - account reads
  - account writes
  - fallback count
  - role resolution
  - workspace bootstrap
  - profile bootstrap
  - home bootstrap
  - session restore
  - owner resolution
  - PostgreSQL latency
  - Firestore fallback latency
  - last error
- `/api/system-status` includes `account: serverFoundation.account.snapshot()`.
- APG Health fetches `/api/system-status`.

## Missing Or Not Proven

- Production authenticated APG Health access.
- PostgreSQL reads/writes by Account Core after cutover.
- Direct Firestore Account Core reads/writes.
- Hidden legacy bypass count.
- Cabinet resolution metric.
- Owner/admin resolution split.
- Monitoring credentials.
- Alert thresholds and rollback triggers.

## Blocker

Monitoring cannot be considered production-ready until the production metrics surface and alert thresholds are verified with real infrastructure access.
