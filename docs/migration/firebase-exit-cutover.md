# APG Firebase Exit — controlled cutover

This change removes Firebase SDKs from the application, but must not be deployed
until the current Firestore documents have been exported and imported.

## Required production sequence

1. Freeze content/admin writes for the short migration window.
2. Export every Firestore document, including nested subcollections, to a JSON
   file shaped as `{ "documents": [{ "path": "collection/id", "data": {} }] }`.
   Preserve timestamps as `{ "__apg_timestamp__": "<ISO-8601>" }`.
3. Hash and store the export in two protected locations. Never commit it.
4. Import it into the production PostgreSQL database:
   `APG_DATA_DATABASE_URL=... node scripts/import-apg-documents.mjs export.json`
5. Compare counts and deterministic hashes per collection.
6. Configure `APG_SESSION_SECRET` with a new high-entropy secret and
   `IDENTITY_PROVIDER=native-apg`.
7. Run read-only smoke tests against a candidate backend revision.
8. Run authenticated tests for email, Telegram/VK linking, session refresh,
   admin login, profile, booking, messages, referrals, QR and Web Push.
9. Switch traffic only after all checks pass. Keep the old revision and export
   available for rollback.
10. After the observation window, remove Firebase credentials from the runtime
    and revoke the service account.

## Hard stop conditions

- Missing documents or collection-count drift.
- Any login path still returns a Firebase token.
- Candidate revision cannot read PostgreSQL documents.
- Profile writes, booking, messages, referrals, QR or admin actions fail.
- `APG_SESSION_SECRET` is missing or differs between active instances.

No frontend or backend production deployment is part of this commit.
