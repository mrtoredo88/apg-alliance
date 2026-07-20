# Account Core Preflight Resolution Plan

Current status: `PREFLIGHT BLOCKED`

## Fixed In This Stage

The migration scripts now load the same local environment source that deployment scripts use.

Before:

```text
server/.env exists
  -> npm run account:preflight
  -> process.env missing PostgreSQL/Firebase Admin keys
```

After:

```text
server/.env exists
  -> migration-env-loader
  -> npm run account:preflight
  -> PostgreSQL/Firebase Admin keys visible to the script
```

## Remaining Blockers

| Blocker | Why It Remains | Owner Action |
|---|---|---|
| `working_tree_clean` | The workspace contains existing local artifacts and `.DS_Store`. | Clean or isolate unrelated files before migration. |
| `postgres_connectivity` | The configured PostgreSQL host cannot be resolved from this machine. The value is not printed. | Confirm VPN/network/DNS access to the production PostgreSQL endpoint, or run migration operator from an allowed network/runtime. |

## No Longer Blocking

| Previous Blocker | Status |
|---|---|
| `FIREBASE_ADMIN_CREDENTIALS_NOT_CONFIGURED` | resolved for migration operator |
| `POSTGRES_DSN_NOT_CONFIGURED` | resolved for migration operator |

## After Blockers Are Cleared

Run:

```bash
npm run account:preflight
npm run readiness:production
```

Only after `PREFLIGHT_PASSED`, the next automatic stage is:

```bash
npm run account:snapshot
```

Snapshot/import/verify/canary/cutover remain forbidden until their gates pass.
