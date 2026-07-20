# Account Core Integration Map

Date: 2026-07-20  
Base audit: `6c67708b`  
Base Account Core scaffold: `31f342f2`

## Goal

Move critical Account Core consumers from direct Firestore access toward:

```text
UI -> API -> AccountCoreService -> Repository -> PostgreSQL
```

This document tracks the remaining Account Core dependencies and the migration order.

## Integrated In This Stage

| Consumer | Previous path | New canary path | Rollback |
|---|---|---|---|
| `UserApp` account bootstrap | local restored user + direct Firestore `users` document later in boot | `fetchAccountBootstrap()` -> `POST /api/account/bootstrap` -> `AccountCoreService.bootstrapAccount()` | remove local `apg_account_canary` / keep `ACCOUNT_CANARY=0` |
| Backend account bootstrap | absent | `/api/account/bootstrap` verifies Firebase token and returns sanitized profile, roles, permissions, cabinets, session state | endpoint unused unless frontend canary is enabled |
| APG Health account metrics | scaffold-only snapshot | `serverFoundation.account.snapshot()` exposed in `/api/system-status` | metrics are read-only |

## Remaining Legacy Calls

| File / area | Operation | Data | New Account Core method | Switch order | Rollback path |
|---|---|---|---|---|---|
| `src/UserApp.jsx` profile document block | read | profile, roles, ownership plus rewards/referrals/favorites | `/api/account/bootstrap` for account fields; later split rewards/referrals into own APIs | canary first; then default server bootstrap | `apg_account_canary=0` |
| `src/UserApp.jsx` owner partner/expert fallback reads | read | partner/expert cabinet entity hints | `AccountCoreService.listCabinets()` for ownership; catalog data remains public domain | after Account Core import parity | legacy catalog reads |
| `server/src/routes/user-actions.js` `profile:sync` | write | profile plus referral/reward side effects | split Account profile write from rewards/referrals; Account profile through `upsertProfile()` | after importer and verify | Firestore transaction remains until split |
| `server/src/routes/user-actions.js` `profile:update` | write | profile settings, notification flags, interest fields | account profile update for profile/settings; push/interest stay their domains | canary allowlist | Firestore write fallback |
| `server/src/lib/adminSecurity.js` | read | admin user/role lookup | Account role/profile lookup after Account import | after owner/admin canary | Firebase claims + Firestore fallback |
| `ProfilePanel.jsx` social subcollections | listener/read/write | social requests/connections/blocks | not Account Core; Social domain migration later | do not change in this phase | existing Firestore |
| Workspace bootstrap | read | profile roles/cabinets | `bootstrapWorkspace()` through `/api/account/bootstrap` | canary first | existing client state/Firestore |
| Telegram support identity data | read | Telegram link to user | `TelegramSupportRepository.get()` | after import | Identity/Firestore fallback |

## Legacy Call Reduction

This stage introduces a canary integration path but keeps legacy rollback intact.

| Metric | Count |
|---|---:|
| Direct Account Core frontend Firestore reads removed from default code | 0 |
| Direct Account Core frontend Firestore reads bypassed in canary bootstrap | 1 critical startup bootstrap path |
| Backend Account Core bypasses removed | 0 |
| Fallback paths retained | yes |

## Gates

Canary remains blocked until:

- production PostgreSQL DSN is configured;
- Account schema is applied;
- Account import dry-run passes;
- Account verify passes;
- rollback is ready;
- canary allowlist is explicit.
