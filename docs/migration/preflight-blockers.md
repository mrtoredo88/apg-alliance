# Account Core Preflight Blockers

Current status: `PREFLIGHT_BLOCKED`

## Confirmed Blockers

| Blocker | Evidence | Resolution |
|---|---|---|
| Working tree is not clean | `git status --short` shows `.DS_Store` and many pre-existing untracked local artifacts. | Clean or isolate unrelated artifacts before production migration. Do not stage them into migration commits. |
| PostgreSQL DSN missing | Environment check shows all supported DSN variables are missing. | Provide production PostgreSQL DSN through the approved secret channel. |
| Firebase Admin credentials missing | Environment check shows `FIREBASE_SERVICE_ACCOUNT` and `GOOGLE_APPLICATION_CREDENTIALS` are missing. | Provide production Firebase Admin read credentials through the approved secret channel. |
| Migration encryption key missing | Environment check shows no migration encryption key. | Provide encryption key before immutable snapshot creation. |
| Backup path not configured | Environment check shows no explicit backup path. | Confirm approved local/encrypted snapshot location. |
| Monitoring credentials missing | Environment check shows no monitoring credentials. | Provide monitoring credentials or confirm APG Health-only observation mode. |
| Rollback artifacts not proven | Rollback script exists, but production manifest/checkpoint/report are not proven. | Generate non-secret rollback artifacts before canary/cutover. |
| Production Account Core monitoring incomplete | Metrics exist, but full cutover monitoring is not proven. | Verify production `/api/system-status`/APG Health and add missing non-runtime docs or metrics in a separate approved step if needed. |

## Not Blockers

- Production frontend version endpoint is reachable.
- Production backend `/health` is reachable.
- Account Core local tests pass.
- Account Core architecture guard passes.
- Account Core Firestore outage simulation passes locally.
- Build passes.

## Next Command

After blockers are resolved:

```bash
npm run account:preflight
```

Do not run `account:snapshot`, `account:import`, `account:canary`, or `account:cutover` before `PREFLIGHT_PASSED`.
