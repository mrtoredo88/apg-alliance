# Account Core Rollback Readiness

Status: `BLOCKED`

Rollback is prepared at the script/flag-plan level, but production rollback readiness is not fully proven.

## Existing

- Rollback script: `scripts/account-rollback.mjs`
- Default rollback flags:
  - `ACCOUNT_STORAGE=firestore`
  - `ACCOUNT_DUAL_READ=0`
  - `ACCOUNT_DUAL_WRITE=0`
  - `ACCOUNT_FALLBACK=1`
  - `ACCOUNT_CANARY=0`
- Rollback directory: `backups/account-core/rollback/`

## Missing Or Not Proven

- Production rollback manifest.
- Production rollback checkpoint.
- Production rollback report.
- Feature flag write mechanism for production rollback.
- Post-rollback owner login check.
- Post-rollback Home/Workspace check.

## Blocker

Rollback cannot be considered production-ready until manifests/checkpoints and the flag rollback path are verified with production configuration.
