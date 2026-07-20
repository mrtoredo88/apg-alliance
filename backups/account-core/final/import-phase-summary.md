# Account Core Import Phase Summary

Status: IMPORT COMPLETE
Verify: VERIFY PASSED
Next gate: READY FOR CANARY

## Source

- Immutable snapshot SHA-256: 3e470904ebcdbd54aebd363ec8f65e9367cea28d87fd04d73f0ef2a38e2ce8d7
- Snapshot account count: 127
- Dry run status: DRY_RUN_PASSED
- Expected inserts: 263
- Expected updates: 0
- Expected skips: 170

## Import Result

- Loaded records verified in PostgreSQL: 263
- Profiles: 126
- Roles: 126
- Cabinets: 4
- Telegram links: 7
- Sessions: 0
- Legacy merges: 1
- Firestore writes: 0
- Canary: NOT RUN
- Cutover: NOT RUN

## Resume Gate

- Final resume inserted: 0
- Final resume updated: 0
- Final resume skipped existing: 263
- Idempotency: PASS

## Verify Result

- Count parity: PASS
- Duplicate canonical accounts: 0
- Orphan records: 0
- Constraint violations: 0
- Legacy aliases: 1
- Canonical owner preserved: true
- Roles preserved: true
- Cabinets preserved: true

## Attempt Notes

- First execute attempt stopped on cabinet FK coverage before Canary/Cutover.
- The root cause was importer-side lower-casing of identity IDs for cabinet owner references while PostgreSQL FK requires exact IDs.
- Second execute attempt completed expected table parity, then resume gate caught non-zero telegram link updates.
- The root cause was importer-side resume id selection for telegram links.
- Final resume and verify passed after preserving exact identity IDs and using telegramId as the telegram link idempotency key.

## Production Scope

- apg-api revision unchanged: bbajlv94m6112jbjsipv
- Migration operator revision used for final resume/verify: bba329u8ehmf79as947r
- Feature flags changed: NO
- Runtime identity switched: NO
- Import: COMPLETED
- Verify: COMPLETED
- Canary: NOT RUN
- Cutover: NOT RUN
