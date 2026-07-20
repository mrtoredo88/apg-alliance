# Account Core Preflight Blockers

Current status: `PREFLIGHT_BLOCKED`

## Confirmed Blockers

| Blocker | Evidence | Resolution |
|---|---|---|
| Working tree is not clean | `git status --short` shows `.DS_Store` and many pre-existing untracked local artifacts. | Clean or isolate unrelated artifacts before production migration. Do not stage them into migration commits. |
| PostgreSQL connectivity | PostgreSQL DSN is visible to migration scripts, but DNS/network resolution fails from this machine. | Confirm VPN/network/DNS access or run the migration operator from an allowed production network/runtime. |
| Migration encryption key missing | Environment audit shows no migration encryption key. | Provide encryption key before immutable snapshot creation. |
| Backup path not configured | Environment audit shows no explicit backup path. | Confirm approved local/encrypted snapshot location. |
| Monitoring credentials missing | Environment audit shows no monitoring credentials. | Provide monitoring credentials or confirm APG Health-only observation mode. |
| Rollback artifacts not proven | Rollback script exists, but production manifest/checkpoint/report are not proven. | Generate non-secret rollback artifacts before canary/cutover. |
| Production Account Core monitoring incomplete | Metrics exist, but full cutover monitoring is not proven. | Verify production `/api/system-status`/APG Health and add missing non-runtime docs or metrics in a separate approved step if needed. |

## Not Blockers

- Production frontend version endpoint is reachable.
- Production backend `/health` is reachable.
- Firebase Admin read access is reachable through the migration loader.
- PostgreSQL DSN is visible to migration scripts.
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
