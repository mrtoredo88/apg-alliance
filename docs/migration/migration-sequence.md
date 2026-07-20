# Migration Sequence

This is the recommended order for moving APG from Firebase/Firestore dependency to PostgreSQL/APG Foundation. The order is based on criticality, frequency, quota risk, user damage, and coupling.

## Phase 0. Stabilize Current State

Status: mostly complete for Identity.

- Keep Identity monitoring active.
- Keep Firestore fallback available only for rollback/emergency.
- Do not start broad data moves until Account Core plan is approved.

## Phase 1. Account Core

Domains:

- Sessions.
- Users / Profiles.
- Roles / Permissions.
- Owner/cabinet access.
- Telegram support data.

Why first:

- These are the remaining auth-to-Home and auth-to-Workspace dependencies.
- They determine whether existing users, owners, admins, and Telegram users can continue working during Firebase issues.

Exit criteria:

- Email login plus profile/role/workspace access works with Firestore disabled in test.
- Firebase Auth provider may remain, but Firestore is not required for account state.

## Phase 2. Public Home Read Models

Domains:

- Partners.
- Locations.
- Experts.
- Events.
- News.
- Promotions/gifts read side.

Why second:

- Home/catalog are high-frequency and user-visible.
- Read-only/read-mostly data is safer to migrate before transactional domains.

Exit criteria:

- Frontend Home/catalog no longer use direct Firestore reads.
- Public data APIs serve PostgreSQL read models.

## Phase 3. Transactional User Value

Domains:

- Bookings.
- Scans.
- Rewards.
- Keys.
- Referrals.
- Favorites.

Why third:

- These write user value and require strong idempotency.
- Moving them after Account Core prevents orphaned ownership/session issues.

Exit criteria:

- Ledger/checksum verification.
- Idempotent retry behavior.
- Canary proves no lost reward/key/booking/referral.

## Phase 4. Content and Admin Workflows

Domains:

- News comments.
- News engagement.
- Reviews.
- Admin content actions.
- Promotion write side.

Why fourth:

- Important but not login-blocking.
- Admin tooling should follow domain repositories.

Exit criteria:

- Admin writes route through services/repositories.
- Direct Firestore in content admin is blocked by guard.

## Phase 5. Realtime and Social

Domains:

- Messaging/dialogs.
- Social messaging requests.
- Connections/friends.
- Workspace CRM realtime flows.

Why fifth:

- Requires replacement for Firestore listener semantics.
- Should be designed after Account Core and public user profile identities are stable.

Exit criteria:

- Realtime adapter selected and tested.
- Messages/requests/connections preserve ordering, unread, blocking, and participant rules.

## Phase 6. Operations Providers

Domains:

- Notifications.
- Push/FCM.
- Uploaded media metadata.
- Loki admin/editor data.

Why sixth:

- FCM may remain as external provider, but notification truth should move to APG.
- S3 is already Yandex for media bytes; metadata still needs repository ownership.

Exit criteria:

- Push provider is swappable.
- Notification records are PostgreSQL-owned.

## Phase 7. Observability and Legacy Script Cleanup

Domains:

- Diagnostics.
- Error logs.
- Analytics.
- Audit.
- Maintenance/demo scripts.

Why last:

- These are important for operations but should not block user-facing domain migrations.

Exit criteria:

- No runtime Firestore imports.
- Legacy Firestore scripts are explicitly archived or migration-only.

## Estimated Timeline

| Phase | Estimate |
|---|---|
| Account Core | 1.5-2.5 weeks |
| Public Home Read Models | 1.5-2 weeks |
| Transactional User Value | 2-3 weeks |
| Content/Admin | 1.5-2 weeks |
| Realtime/Social | 2-3 weeks |
| Operations Providers | 1-2 weeks |
| Observability/cleanup | 1 week |

Total realistic program: 10-15 weeks, assuming no major data-quality incident and one domain wave at a time.
