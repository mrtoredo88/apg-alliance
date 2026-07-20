# Account Core Production Import

Status: IMPORT_PASSED
Snapshot SHA-256: 3e470904ebcdbd54aebd363ec8f65e9367cea28d87fd04d73f0ef2a38e2ce8d7
Loaded records verified: 263
Final resume inserted records: 0
Final resume updated records: 0
Skipped records: 433
Checkpoints: 6

## Resume Check

Status: IMPORT_PASSED
Resume inserted: 0
Resume updated: 0
Resume skipped existing: 263

## Guardrails

- Firestore writes: 0
- Canary: NOT RUN
- Cutover: NOT RUN

## Attempt Notes

- Initial execute attempt stopped on cabinet FK coverage before Canary/Cutover.
- Second execute attempt reached expected table parity, then resume gate caught non-zero telegram link updates.
- Final resume gate passed with 0 inserts and 0 updates.
