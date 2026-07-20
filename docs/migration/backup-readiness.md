# Account Core Backup Readiness

Status: `BLOCKED`

Local backup directory structure exists, but production snapshot backup readiness is blocked by missing credentials and encryption configuration.

## Existing

- `backups/account-core/`
- `backups/account-core/preflight/`
- `backups/account-core/snapshot/`
- `backups/account-core/dryrun/`
- `backups/account-core/verify/`
- `backups/account-core/conflicts/`
- `backups/account-core/canary/`
- `backups/account-core/cutover/`
- `backups/account-core/rollback/`
- `backups/account-core/final/`
- Raw snapshot Git exclusions:
  - `backups/account-core/snapshot/raw/`
  - `backups/account-core/snapshot/*.enc`

## Checked

- Local filesystem free space: available.
- Redacted report paths: available.
- SHA-256 manifest path: planned.

## Missing Or Not Proven

- Migration encryption key.
- Production raw snapshot path.
- Encrypted archive generation.
- Immutable file locking policy.
- Production Firestore read access required for snapshot.

## Blocker

Encrypted immutable snapshot cannot be proven until production credentials and encryption configuration are available.
