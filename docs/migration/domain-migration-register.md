# Domain Migration Register

Date: 2026-07-20  
Scope: all Firebase / Firestore dependent domains detected in current checkout.

| # | Domain | Current Firebase dependency | Target PostgreSQL / APG Foundation owner | Priority | Suggested wave |
|---:|---|---|---|---|---|
| 1 | Identity | Firebase Auth provider remains; legacy Firestore fallback/support code exists | `IdentityRepository`, provider adapter | P0 | Done / monitor |
| 2 | Sessions | Firestore session/auth support plus Firebase token state | `SessionRepository`, APG session service | P0 | Wave 1 |
| 3 | Users / Profiles | Client and server read/write `users`; realtime profile/social subcollections | `UserRepository`, profile service | P1 | Wave 1 |
| 4 | Roles / Permissions | Firestore roles/users and Firebase claims/admin auth | `RoleRepository`, access policy service | P0 | Wave 1 |
| 5 | Owner / Cabinet Access | Firestore ownership lookups across partner/expert/admin flows | access repository + ownership table | P0/P1 | Wave 1 |
| 6 | Partners | Firestore `partners` read/write from Home, catalog, admin, routes | partner repository/read model | P2 | Wave 2 |
| 7 | Locations | Partner location/address fields and queries | location repository | P1 | Wave 2 |
| 8 | Experts | `experts`, expert profiles, rotation/reviews | expert repository | P1 | Wave 2 |
| 9 | Events | `events`, registrations/schedule | event repository | P1 | Wave 2/3 |
| 10 | Bookings / Meetings | booking/meeting records and owner/user references | booking repository, transaction service | P2 | Wave 3 |
| 11 | Rewards / Keys | prize, key, raffle, scan, reward transactions | reward ledger + key repository | P1 | Wave 3 |
| 12 | Referrals | referral sessions/events/rewards, links from user actions | referral repository | P2 | Wave 3 |
| 13 | Scans / QR | scan writes, visit tokens, reward triggers | scan repository + idempotency table | P1 | Wave 3 |
| 14 | News / Content | `news`, comments, engagement, content studio | content repository | P2 | Wave 4 |
| 15 | Promotions / Gifts | prizes/promotions/gifts display and claims | promotion/reward repository | P1 | Wave 3/4 |
| 16 | Reviews | partner/expert/news review/comment records | review repository | P2 | Wave 4 |
| 17 | Favorites / Saved | user favorites/saved writes | favorites repository | P1 | Wave 3 |
| 18 | Messaging / Dialogs | dialogs, messages, context dialogs, listener semantics | messaging repository + realtime service | P2 | Wave 5 |
| 19 | Social Messaging / Requests | request subcollections/listeners/blocking | social messaging repository | P1 | Wave 5 |
| 20 | Connections / Friends | contacts, connections, shared graph | social graph repository | P2 | Wave 5 |
| 21 | Notifications | Firestore notification records | notification repository | P1 | Wave 6 |
| 22 | Push / FCM | FCM tokens and Firebase Messaging send calls | provider adapter + token repository | P1 | Wave 6 |
| 23 | Workspace / CRM | Workspace CRM shared modules and admin operations | workspace repository | P1 | Wave 5/6 |
| 24 | Loki Knowledge / Editor | admin/editor data, knowledge collections/listeners | Loki repository | P2 | Wave 6 |
| 25 | Diagnostics / Error Logs | Firestore diagnostics/error logs/stats | observability repository | P1 | Wave 7 |
| 26 | Analytics / Audit | stats, admin activity, activity index | analytics repository | P1 | Wave 7 |
| 27 | Uploaded Media Metadata | upload-photo stores metadata or references; S3 is already Yandex | media metadata repository | P2 | Wave 6 |
| 28 | Public Data APIs | Some public-data routes still read Firestore | public read model APIs | P1 | Wave 2 |
| 29 | Admin Content Actions | `admin-actions` writes many collections | admin domain services | P1 | Wave 4/6 |
| 30 | Telegram Support Data | tg auth sessions/links, telegram updates | identity/session/referral repositories | P0/P1 | Wave 1 |
| 31 | Maintenance Scripts | seed/demo/diagnostic scripts use Firebase Admin | script adapters per domain | P2 | After each wave |
| 32 | Service Worker / PWA Diagnostics | version/cache not Firestore-heavy, but diagnostics can log to Firebase | observability adapter | P2 | Wave 7 |

## Recommended Migration Waves

1. Account Core: Sessions, Users/Profile, Roles/Permissions, owner/cabinet access, Telegram support data.
2. Public Home Read Models: partners, experts, locations, events, news, public content APIs.
3. Transactional User Value: bookings, scans, rewards, keys, referrals, favorites.
4. Content/Admin: news comments, engagement, promotions, reviews, admin content actions.
5. Realtime/Social: messaging, social requests, friends/connections, Workspace CRM realtime flows.
6. Operations: notifications/push, Loki admin/editor, uploaded media metadata.
7. Observability: diagnostics, analytics, audit, legacy scripts.

## Register Rule

Each domain must pass the same sequence before production cutover:

snapshot -> dry-run -> verification -> canary -> controlled cutover -> rollback-ready monitoring -> fallback retirement.
