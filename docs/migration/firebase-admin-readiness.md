# Firebase Admin Readiness

Status: `BLOCKED`

Firebase Admin access could not be verified from this environment because no Admin credentials are configured.

## Checked

- `FIREBASE_SERVICE_ACCOUNT`: Missing
- `GOOGLE_APPLICATION_CREDENTIALS`: Missing
- Server Firebase Admin wrapper exists: `server/src/lib/firebase.js`
- Required source collections for future snapshot are known: `users`, `canonicalUsers`, `roles`, `emailIndex`, `auth_map`, `tgLinks`, `identityLinks`, partner/expert cabinet bindings.

## Not Proven

- Production service account identity.
- Firestore read access.
- Ability to read required collections.
- Ability to create immutable snapshot.
- Quota visibility.
- Timeout policy.

## Blocker

`FIREBASE_ADMIN_CREDENTIALS_NOT_CONFIGURED`

No Firestore reads or writes were performed by this readiness document.
