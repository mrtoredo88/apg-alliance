# Security Redacted Review

Status: `REVIEW COMPLETED`

No secret values were printed or copied.

## Scope

Files reviewed because the previous audit flagged them:

- `src/AdminPanel.jsx`
- `scripts/bootstrap-owner.mjs`
- `public/vk-auth.html`
- `server/src/routes/admin-security.js`
- `api/qr-token.js`
- `server/src/routes/qr-token.js`

## Findings

| File | Line | Risk Type | Severity |
|---|---:|---|---|
| `src/AdminPanel.jsx` | 316 | firebase_config_literal | LOW |
| `src/AdminPanel.jsx` | 317 | firebase_config_literal | LOW |
| `src/AdminPanel.jsx` | 3726 | temporary_bypass_or_backdoor | MEDIUM |
| `src/AdminPanel.jsx` | 3737 | temporary_bypass_or_backdoor | MEDIUM |
| `src/AdminPanel.jsx` | 3789 | temporary_bypass_or_backdoor | MEDIUM |
| `src/AdminPanel.jsx` | 3833 | temporary_bypass_or_backdoor | MEDIUM |
| `src/AdminPanel.jsx` | 7084 | hardcoded_secret_literal | HIGH |
| `src/AdminPanel.jsx` | 10600 | hardcoded_secret_literal | HIGH |

## Git History

Refined filename-based history scan found no `.env`, service-account, or snapshot files outside ignored dependency/build/backup paths.

## Git Safety

| Pattern | Status |
|---|---|
| `.env*` | ignored |
| `server/.env` | ignored |
| `server/firebase-service-account.json` | ignored |
| `backups/account-core/snapshot/raw/` | ignored |
| `backups/account-core/snapshot/*.enc` | ignored |
| plain `backups/account-core/snapshot/*.json` outside `raw/` | not ignored |

## Recommendation

Do not change the flagged files as part of this migration environment step. Handle hardcoded-sensitive findings in a separate security cleanup after owner review.
