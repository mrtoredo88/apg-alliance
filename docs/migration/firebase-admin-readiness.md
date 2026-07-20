# Firebase Admin Readiness

Status: `PASS FOR PREFLIGHT READ`

Firebase Admin credentials are now visible to the migration operator through `scripts/lib/migration-env-loader.mjs`, and `account:preflight` confirmed Firestore read access.

## Checked

- Firebase Admin credential group: Found through migration environment loader.
- Server Firebase Admin wrapper exists: `server/src/lib/firebase.js`
- Required source collections for future snapshot are known: `users`, `canonicalUsers`, `roles`, `emailIndex`, `auth_map`, `tgLinks`, `identityLinks`, partner/expert cabinet bindings.

## Proven

- Firestore read access for preflight.

## Not Proven Until Snapshot Stage

- Ability to read required collections.
- Ability to create immutable snapshot.
- Quota visibility.
- Timeout policy.

## Blocker

None for current preflight. Snapshot-specific checks remain future gated work.

No Firestore reads or writes were performed by this readiness document.
