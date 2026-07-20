# Target PostgreSQL Architecture

## Principles

1. PostgreSQL is the source of truth for APG business data.
2. Firebase/Firestore are not imported directly by frontend, domain services, repositories, or business logic.
3. External providers are hidden behind infrastructure adapters.
4. Every domain uses the same migration lifecycle.
5. Realtime and push are provider capabilities, not data ownership layers.

## Target Layers

```text
Frontend
  |
  v
APG API / Backend
  |
  +-- Domain Services
  |     |
  |     +-- Repositories
  |           |
  |           +-- PostgreSQL adapters
  |
  +-- Infrastructure Adapters
        |
        +-- Firebase Auth provider (transition)
        +-- FCM push provider (transition)
        +-- Yandex S3 media provider
        +-- Optional legacy Firestore fallback (migration only)
```

## Repository Families

| Family | Repositories |
|---|---|
| Account Core | Identity, User, Session, Role, Ownership, TelegramLink |
| Public Catalog | Partner, Location, Expert, Event, News, Promotion |
| Transactions | Booking, Scan, RewardLedger, Key, Referral, Favorite |
| Social | Dialog, Message, ConversationRequest, Connection, Block |
| Operations | Notification, PushToken, AuditLog, Diagnostic, LokiKnowledge |

## PostgreSQL Design Requirements

- UUID/canonical IDs for APG-owned data.
- Legacy ID columns for Firestore/Firebase references during migration.
- Unique indexes for identity/email/telegram aliases.
- Transactional ledgers for rewards/keys/scans/referrals.
- Audit tables for owner/admin changes.
- `migration_source`, `migration_version`, `legacy_firestore_path`, and checksum fields where needed.
- Idempotency keys for all user-triggered writes that can be retried.
- Domain-level views/read models for Home and public catalog.

## Universal Migration Framework

Every future domain should reuse:

- `DomainMigrationRegistry`
- `MigrationManifest`
- `SnapshotService`
- `DryRunService`
- `VerificationService`
- `CanaryExecutor`
- `CutoverController`
- `RollbackController`
- `DependencyMonitor`
- `ArchitectureGuard`

Required artifacts per domain:

```text
backups/migration/<domain>/
  snapshot/
  dry-run/
  verify-package-vN/
  canary/
  cutover/
  rollback/
```

## Architecture Guard Direction

Allowed Firebase imports:

- Infrastructure adapters only.
- Migration/audit scripts only when explicitly marked read-only or migration-gated.

Forbidden in domain/runtime code:

- direct `firebase/firestore`
- direct `firebase/auth`
- direct `firebase-admin/firestore`
- direct `firebase-admin/auth`
- `collection`, `doc`, `query`, `getDoc`, `getDocs`, `setDoc`, `updateDoc`, `runTransaction`

The guard should become stricter wave by wave. It should not block legacy code before a domain migration starts, but it must block new direct dependencies in migrated domains.
