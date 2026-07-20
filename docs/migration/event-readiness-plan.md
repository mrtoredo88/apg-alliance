# Event Readiness Plan

Purpose: before important public events, APG needs a deterministic readiness check that tells the owner whether the app can survive expected traffic and external-service issues.

## Proposed Command

Future command:

```bash
npm run readiness:event
```

This audit does not implement the command. It defines the required checks.

## Required Checks

| Check | Expected result |
|---|---|
| Frontend build version | Current production version known |
| Backend revision | Current revision known |
| PostgreSQL health | Connected, migration version expected |
| Identity storage | PostgreSQL primary |
| Identity provider | Firebase or APG provider explicitly reported |
| Firestore availability | Read quota/status sampled for legacy domains |
| Firebase Auth availability | Token create/verify smoke where provider is active |
| Email login smoke | Test account passes |
| Telegram login smoke | Test account passes |
| Owner access smoke | Owner/workspace accessible |
| Home public data | partners/events/news load |
| Rewards/keys smoke | safe read-only checks pass |
| Messaging smoke | list/open checks pass where test data exists |
| PWA version/cache | Installed app receives expected version |
| Push status | Provider and token storage reachable |
| Error rate | Below threshold |
| Rollback status | Ready for any active migration wave |

## Event Gate

Recommended statuses:

- `READY`: all critical checks pass.
- `DEGRADED`: non-critical provider degraded, user flows still work.
- `NOT_READY`: login, profile, Home, owner, PostgreSQL, or provider checks fail.

## Firestore/Firebase-Specific Rules

Until migration is complete:

- Firestore quota must be checked before every major event.
- Firebase Auth availability must be checked before every major event.
- If Firestore is degraded, event can proceed only if affected domains have local/PostgreSQL fallback.
- If Firebase Auth is degraded, event is not ready under current architecture.

## Report Artifact

Future reports should be saved to:

```text
backups/readiness/events/<YYYY-MM-DD>/
  readiness-report.json
  readiness-summary.md
```

## Owner Runbook

1. Run readiness 24 hours before event.
2. Run readiness 2 hours before event.
3. Run readiness 30 minutes before event.
4. Keep Identity/Backend/PostgreSQL health dashboard open during event.
5. Do not run migrations, canaries, cutovers, or deploys during event window unless fixing a P0.
