# Full Firebase / Firestore Dependency Audit

Date: 2026-07-20  
Mode: read-only static audit  
Branch: `audit/full-postgres-migration-plan`  
Source artifact: `backups/migration/audit-summary-redacted.json`

## Executive Summary

The audit found that APG is not yet cloud-independent outside Identity. Identity cutover moved the normal email identity path to PostgreSQL, but the application still has broad Firebase and Firestore dependencies across frontend, backend routes, shared server modules, scripts, PWA diagnostics, push, Workspace, content, rewards, messaging, and Loki tooling.

Static totals:

| Metric | Count |
|---|---:|
| Firebase / Firestore findings | 1894 |
| Files with dependencies | 217 |
| Direct Firestore read findings | 1133 |
| Firestore write findings | 1087 |
| Realtime listener findings | 29 |
| Firebase Auth / token findings | 117 |
| P0 findings | 409 |
| P1 findings | 979 |

Operation totals:

| Operation class | Count |
|---|---:|
| Firestore Admin dependency | 642 |
| Firestore read operation | 470 |
| Firestore write operation | 1055 |
| Firestore transaction | 32 |
| Firestore client dependency | 24 |
| Firestore realtime listener | 29 |
| Firebase Auth client | 57 |
| Firebase Auth admin | 44 |
| Firebase token usage | 41 |
| Firebase Messaging / FCM | 50 |
| Firebase Storage markers | 6 |

The current checkout does not contain an `api/` directory. The active backend surface is Fastify under `server/src/routes`, with shared logic in `server-shared`.

## Top Dependency Hotspots

| File | Findings | Main domains | Risk |
|---|---:|---|---|
| `server/src/routes/user-actions.js` | 476 | user actions, rewards, bookings, messaging, referrals, partners, identity-related support | Highest coupling; route-level domain extraction required |
| `server/src/routes/admin-actions.js` | 158 | admin writes, content, partners, roles, notifications | Admin cutover blocker |
| `src/UserApp.jsx` | 51 | boot, Home, profile, roles, public data | UI startup and Home still directly depend on Firebase/Firestore |
| `server/src/routes/news-comments.js` | 49 | news, users, rewards | Content + reward side effects |
| `server/src/routes/news-engagement.js` | 44 | news, events, rewards | Transactional engagement logic |
| `server/src/routes/admin-security.js` | 43 | roles, permissions, users | P0 authorization path |
| `server/src/lib/identityCore.js` | 42 | legacy identity | Remaining legacy identity support and fallback risk |
| `server/src/routes/email-auth.js` | 37 | identity | Uses Identity v2 but still contains Firebase Auth provider and fallback plumbing |
| `server/src/routes/loki-editor.js` | 37 | Loki, content, dialogs | Admin/editor migration later |
| `server/src/lib/telegramUpdates.js` | 34 | identity, sessions, referrals, users | Telegram auth/support path |

## Domain Dependency Summary

| Domain | Findings | Reads | Writes | Listeners | Auth | Files | Priority |
|---|---:|---:|---:|---:|---:|---:|---|
| Identity | 262 | 151 | 129 | 0 | 26 | 56 | P0 |
| Roles / Permissions | 112 | 60 | 54 | 0 | 19 | 17 | P0 |
| Sessions | 35 | 26 | 23 | 1 | 0 | 9 | P0 |
| Users / Profiles | 143 | 88 | 57 | 9 | 6 | 24 | P1 |
| Notifications / Push | 52 | 24 | 29 | 0 | 0 | 8 | P1 |
| CRM / Workspace | 18 | 9 | 11 | 0 | 0 | 7 | P1 |
| Keys / Rewards | 76 | 59 | 48 | 0 | 0 | 13 | P1 |
| Events | 50 | 25 | 33 | 0 | 0 | 16 | P1 |
| Experts | 32 | 28 | 9 | 0 | 0 | 11 | P1 |
| Partner Locations | 34 | 18 | 13 | 0 | 1 | 19 | P1 |
| Favorites / Saved | 5 | 4 | 5 | 0 | 0 | 2 | P1 |
| Social Messaging / Requests | 4 | 0 | 1 | 3 | 0 | 2 | P1 |
| News / Content | 165 | 110 | 120 | 0 | 2 | 16 | P2 |
| Loki | 100 | 41 | 62 | 14 | 0 | 39 | P2 |
| Partners | 74 | 47 | 39 | 0 | 0 | 17 | P2 |
| Messaging / Dialogs | 63 | 20 | 25 | 2 | 0 | 19 | P2 |
| Referrals | 35 | 32 | 27 | 0 | 0 | 8 | P2 |
| Bookings / Meetings | 24 | 17 | 17 | 0 | 0 | 2 | P2 |
| Uploaded Media | 8 | 1 | 6 | 0 | 0 | 4 | P2 |
| Connections | 4 | 4 | 0 | 0 | 0 | 1 | P2 |
| Reviews | 4 | 3 | 2 | 0 | 0 | 2 | P2 |
| Unclassified | 530 | 334 | 343 | 0 | 55 | 43 | P2 |

The `Unclassified` bucket is intentionally not discarded. It marks code where static path/name heuristics were insufficient, usually broad backend routes and migration/diagnostic scripts. Each future domain migration must resolve its own `Unclassified` findings before cutover.

## P0 Findings

P0 dependencies are concentrated in:

- Identity support and fallback code.
- Roles / permissions.
- Sessions and auth-state support.
- Admin authorization and security checks.
- Firebase Auth provider usage.

Identity is now PostgreSQL-backed for the normal path, but Firebase Auth remains the provider used by client and admin token flows. Therefore, Firestore Identity dependency has been reduced, but Firebase Auth dependency has not been removed.

## Current Outage Posture

Can APG survive a full Firestore outage today?

No. Email identity can use PostgreSQL after cutover, but many normal application flows still read/write Firestore directly: Home data, profile, roles, rewards, Workspace, partner/expert data, events, messaging, notifications, Loki admin data, diagnostics, and scripts.

Can APG survive a Firebase Auth outage today?

No. The client still uses Firebase Auth for custom-token sign-in, anonymous auth compatibility, current user state, ID tokens for backend calls, and related provider behavior. The backend also verifies/creates Firebase tokens and uses Firebase Admin Auth.

Can APG survive Firestore quota exhaustion better than before Identity v2?

Yes for normal email identity resolution, provided PostgreSQL identity is healthy and no fallback is needed. No for the rest of the product.

## Top Risks

1. `src/UserApp.jsx` remains a direct Firebase/Firestore boot and Home dependency. This means UI shell optimizations do not equal data independence.
2. Roles and sessions are tightly coupled to Firebase token and Firestore user documents. This is the next P0 class after Identity.
3. `server/src/routes/user-actions.js` mixes many domains in one route. It should be decomposed behind repositories before any broad cutover.
4. Rewards, scans, keys, referrals, and news engagement use transactions and multi-document side effects. They require stronger verification than read-only content domains.
5. Messaging/social flows rely on realtime listeners and subcollections. PostgreSQL migration must include realtime delivery semantics, not only tables.
6. FCM/push is still Firebase-dependent even if Firestore data moves to PostgreSQL.
7. Existing architecture docs mention legacy `api/*.js`; current migration planning must use actual `server/src/routes`.

## Recommended Next Domain

Recommended next program: Account Core, not a single isolated collection.

Account Core should include:

- Sessions.
- Users / Profiles.
- Roles / Permissions.
- Cabinet/owner access checks.
- Minimal profile sync used after login.

Reason: after Identity, these are the remaining P0/P1 dependencies on the critical auth-to-Home path. Migrating rewards or partners first would leave login, role resolution, owner access, and profile sync still dependent on Firestore/Firebase Auth behavior.

## Owner Decisions Required

1. Confirm whether Firebase Auth stays as provider for the next release window.
2. Approve Account Core as the next migration program.
3. Decide whether public catalog data should move through backend read APIs before or after Account Core.
4. Approve decomposition of `server/src/routes/user-actions.js` into repository-backed domain services.
5. Decide target realtime technology for Messaging/Social: polling, Postgres listen/notify, WebSocket service, or managed realtime provider.
6. Decide whether FCM stays long-term or push becomes provider-abstracted.

## Safety Statement

This audit is read-only. It did not call production services, did not write Firestore, did not change feature flags, did not run import/verify/canary/cutover, and did not deploy.
