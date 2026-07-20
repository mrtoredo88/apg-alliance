# Security Findings Resolution

Date: 2026-07-20

Scope: Account Core Security & Infrastructure Completion v1.

No production data was changed. No snapshot, import, verify, canary, cutover, rollback, or deploy was executed.

## Summary

| Severity | Before | After | Status |
|---|---:|---:|---|
| HIGH | 2 | 0 | Resolved |
| MEDIUM | 4 | 0 | False positive exceptions |
| LOW | 2 | 2 | Accepted risk |

## Reviewed Files

| File | Result |
|---|---|
| `src/AdminPanel.jsx` | CONFIRMED findings resolved; false positives classified; accepted LOW risk documented |
| `scripts/bootstrap-owner.mjs` | ACCEPTED_RISK: owner bootstrap is an explicit operator script, not runtime bypass |
| `public/vk-auth.html` | ACCEPTED_RISK: OAuth relay page contains no secret and uses same-origin `postMessage` target |
| `server/src/routes/admin-security.js` | ACCEPTED_RISK: owner protection and temporary password flow are normal admin security logic |
| `api/qr-token.js` | FALSE_POSITIVE: file is absent in this repository state |
| `server/src/routes/qr-token.js` | ACCEPTED_RISK: route exists server-side; no client secret finding from the audit |

## Findings

| Finding | Classification | Resolution |
|---|---|---|
| `src/AdminPanel.jsx` client raffle secret | CONFIRMED | Removed hardcoded body secret from client. Manual admin draw now uses Firebase ID token headers. |
| `src/AdminPanel.jsx` client activity secret | CONFIRMED | Removed hardcoded body secret from client. Manual admin recalculation now uses Firebase ID token headers. |
| `server/src/routes/raffle-draw.js` admin execution path | CONFIRMED | Added existing backend role guard with `prizes:update`. Cron secret path remains available. |
| `server/src/routes/activity-index.js` admin execution path | CONFIRMED | Added existing backend role guard with `partners:update`. Cron secret path remains available. |
| temporary password flow text/function names | FALSE_POSITIVE | Added scanner exception only for explicit temporary password flow language. |
| Firebase client diagnostics literals | ACCEPTED_RISK | Public Firebase client config metadata is not a secret. Values are still treated as diagnostic metadata only. |

## Production Bypass Review

Removed confirmed production bypasses:

- client-side raffle shared secret;
- client-side activity-index shared secret.

No other confirmed production bypass was found in the reviewed files.

## Notes

Legacy shared-secret support remains server-side for cron and backward compatibility. The admin UI no longer sends those secrets from the browser bundle.
