# Firebase / Firestore Failure Matrix

| # | Failure case | Current impact | User-visible risk | Target behavior after PostgreSQL migration |
|---:|---|---|---|---|
| 1 | Firestore `RESOURCE_EXHAUSTED` | Identity normal path mostly safe after cutover; other domains fail/degrade | Login may pass, Home/profile/product flows can break | No critical path reads Firestore; alert only |
| 2 | Firestore read timeout | Direct client/server reads wait or show fallback/generic errors | Empty screens, stale Home, admin failures | Bounded repository timeout with cached/read-model fallback |
| 3 | Firestore write timeout | Actions can fail after UI intent | Lost bookings/rewards/messages risk | PostgreSQL transaction + retry/idempotency queue |
| 4 | Firestore transaction failure | Rewards/scans/news engagement fail | Duplicate/lost reward or generic error | SQL transaction with explicit rollback and audit row |
| 5 | Firestore realtime listener dropped | Social/messaging/profile updates stop | Stale unread/messages/requests | Realtime adapter reconnects; truth remains PostgreSQL |
| 6 | Firebase Auth custom token outage | Email/Telegram login cannot complete | P0 login failure | APG session provider works without Firebase Auth |
| 7 | Firebase Auth verify token outage | Backend protected routes reject users | Workspace/admin/user actions fail | APG session verification independent of Firebase |
| 8 | Anonymous auth failure | Guest boot and Firebase-backed calls degrade | First launch feels broken | Anonymous identity becomes optional APG guest session |
| 9 | FCM send outage | Push not delivered | Notifications delayed | Push provider failure logged; in-app notification remains |
| 10 | FCM token write failure | Device cannot receive push | Silent push gap | Token repository retry; user flow unaffected |
| 11 | Firestore IAM/service usage disabled | Broad backend failures | P0/P1 depending route | No runtime Firestore dependency after final wave |
| 12 | Firestore billing disabled | Quota failures recur | Same as previous RESOURCE_EXHAUSTED | Billing affects only legacy fallback/archives |
| 13 | PostgreSQL unavailable | Identity and migrated domains fail | New primary outage | Rollback-ready feature flags during migration; HA/backups |
| 14 | PostgreSQL partial latency | Slower APIs | Perceived slowdown | Timeouts, pool metrics, read-model cache, alerts |
| 15 | Dual-read mismatch during migration | Conflicting results | Data trust issue | Verification blocks cutover; mismatch report |
| 16 | Rollback needed after canary/cutover | Current rollback manual per domain | Slow recovery | Standard rollback package per domain |

## Readiness Rule

No domain can enter cutover unless its failure behavior is better than or equal to the current production behavior and rollback has been tested.
