# Migration Operator Environment

Status: `PARTIALLY READY`

## Loader

Added: `scripts/lib/migration-env-loader.mjs`

Default source order:

1. `server/.env`
2. `.env.local`
3. `.env`

The loader:

- parses standard `KEY=value` lines;
- keeps existing shell variables unless override is explicitly enabled;
- exposes only redacted metadata;
- is used by Account Core migration/readiness scripts.

## Commands Covered

- `npm run account:preflight`
- `npm run account:import`
- `npm run account:dry-run`
- `npm run account:verify`
- `npm run readiness:account`
- `npm run readiness:production` through nested `account:preflight`
- `npm run audit:migration-env`

## Evidence

`npm run audit:migration-env`:

- PostgreSQL group: `FOUND`
- Firebase Admin group: `FOUND`
- Encryption group: `MISSING`
- Backup path group: `MISSING`
- Monitoring group: `MISSING`
- Loaded keys: 25
- Secrets printed: false

`npm run account:preflight`:

- Firebase Admin read access: `PASS`
- PostgreSQL configured: `YES`
- PostgreSQL connectivity: `BLOCKED`

## Current Blockers

- working tree is not clean;
- PostgreSQL DNS/network resolution fails from the current operator environment.

## Not A Current Blocker

The previous `server/.env FOUND but process.env undefined` issue is resolved for migration scripts.
