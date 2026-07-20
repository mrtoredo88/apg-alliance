# Working Tree Cleanup

Date: 2026-07-20

Scope: Account Core preflight `working_tree_clean` blocker.

## Classification

| Class | Examples | Action |
|---|---|---|
| OS files | `.DS_Store` | Removed from Git index and ignored |
| Generated screenshots | `tmp-*.png`, `apg-final-*.png`, `production-*.png` | Ignored |
| Local smoke scripts | root `apg-*.mjs`, root `prod-*.mjs` | Ignored |
| Local agent docs | `AGENTS.md`, `AGENTS2.md`, `CLAUDE.md` | Ignored |
| Local AI helper docs | selected untracked `.ai/*`, `.ai/memory/`, `.ai/templates/` | Ignored |
| Local identity backups | `backups/identity/` | Ignored |
| PWA acceptance artifact | `docs/PWA-ACCEPTANCE-*.md` | Ignored |

## What Changed

`.gitignore` now excludes generated and local-only artifacts that should not participate in production migration gates.

Tracked `.DS_Store` was removed from the Git index with `git rm --cached`. The local file was not deleted from disk.

## What Was Not Done

- No production data was changed.
- No generated screenshots were deleted.
- No local user files were deleted.
- No snapshot/import/verify/canary/cutover/rollback/deploy was run.

## Expected Gate Behavior

After the cleanup commit, `git status --short` should only show new intentional work during the current task. On a clean checkout of the commit, `working_tree_clean` should pass.
