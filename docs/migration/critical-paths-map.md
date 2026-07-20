# Critical Paths Map

This map traces current Firestore/Firebase dependency chains that matter most to user-visible reliability.

## 1. App Boot / Home

Current path:

`index` -> `src/firebase.js` -> Firebase app/Auth/Firestore init -> `src/UserApp.jsx` -> anonymous/custom auth state -> user/profile/role lookups -> Home public collections -> Home render.

Key dependencies:

- Firebase Auth client.
- Firestore client.
- `users`, role/profile data.
- public data collections: partners, experts, events, news, prizes/promotions, notifications/tasks in some paths.

Failure behavior:

- Firestore outage: cached Home can soften repeat launch, but fresh data/profile/role flows degrade or fail.
- Firebase Auth outage: session and token-backed API calls fail.

Target path:

`index` -> APG bootstrap -> APG session restore -> Account Core API -> PostgreSQL read models -> Home shell/cache -> background refresh.

## 2. Email Login

Current post-Identity-cutover path:

Email UI -> `/api/email-auth` -> APG Identity v2 -> PostgreSQL identity storage -> FirebaseIdentityProvider custom token -> client `signInWithCustomToken` -> profile/session sync.

Residual dependency:

- Firebase Auth remains provider.
- Firestore fallback exists but should be inactive for normal path.
- Profile/role sync after login still touches non-Identity Firestore areas.

Target path:

Email UI -> APG Identity -> PostgreSQL user/session/role -> APG session token -> client session -> profile from PostgreSQL.

## 3. Telegram Login

Current path:

Telegram flow -> backend route -> Firebase/Admin token support -> tg link/session data -> user/profile/referral updates.

Dependencies:

- Firebase Auth provider and token creation.
- Firestore support data outside fully migrated identity areas.
- Telegram update processing in `server/src/lib/telegramUpdates.js`.

Target path:

Telegram flow -> APG Identity provider adapter -> PostgreSQL links/sessions/referral records -> APG session.

## 4. Owner / Admin / Workspace Access

Current path:

Login token -> backend Firebase token verification/admin claims -> Firestore `users`/roles/ownership checks -> Workspace/admin routes -> Firestore domain reads/writes.

Dependencies:

- Firebase Admin Auth.
- Firestore `users`, role/owner metadata.
- Firestore partner/expert/workspace content.

Target path:

APG session -> PostgreSQL role/ownership repository -> Workspace services -> PostgreSQL domain repositories.

## 5. Partner / Expert Catalog

Current path:

Home/catalog components -> direct Firestore reads and server public routes -> partners/experts/locations/reviews/events.

Dependencies:

- Firestore client for some frontend flows.
- Firestore Admin in public backend routes.

Target path:

Public read APIs backed by PostgreSQL read models, with frontend no direct Firestore reads.

## 6. Booking / Scan / Reward

Current path:

User action -> backend `user-actions` or shared reward service -> Firestore transaction -> users/scans/stats/rewards/notifications.

Dependencies:

- Firestore transactions.
- Multi-document consistency.
- Reward idempotency behavior encoded in route/shared modules.

Target path:

PostgreSQL transaction with idempotency keys, ledger-style reward records, and explicit side-effect queue for notifications.

## 7. Messaging / Social

Current path:

Messages/profile/social components -> Firestore subcollections/listeners -> dialogs/requests/blocks/connections.

Dependencies:

- Firestore realtime listeners.
- Firestore subcollection layout.

Target path:

Messaging repository plus realtime adapter. PostgreSQL stores truth; delivery can be polling, WebSocket, or listen/notify depending operational choice.

## 8. Push / Notifications

Current path:

Firestore notification records + FCM token storage -> Firebase Messaging send.

Dependencies:

- Firestore users/tokens/notifications.
- Firebase Cloud Messaging provider.

Target path:

Notification repository in PostgreSQL + provider adapter. FCM may remain as one provider while data ownership moves to APG.

## 9. Loki / Admin Knowledge

Current path:

Loki user UI uses local/core modules; admin/editor knowledge surfaces still read/write Firestore in places.

Dependencies:

- Firestore Loki/editor collections/listeners.

Target path:

Loki repository/read model and admin content services, after Account Core and public content are stable.
