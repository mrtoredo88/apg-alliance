# Migration Operator Runtime

Date: 2026-07-20

## Decision

Recommended runtime: one-off migration container/job attached to the same Yandex VPC network as production `apg-api`.

This reuses the existing production network path instead of opening PostgreSQL to the public internet.

## Options

| Option | Security | Complexity | Opens PostgreSQL outward | Production change required | Recommendation |
|---|---|---:|---|---|---|
| A. Run inside current backend container | Medium | High | No | Not possible without adding migration scripts to runtime image or exec support | Not recommended |
| B. One-off migration container in same VPC | High | Medium | No | No production data change; may require separate operator runtime creation | Recommended |
| C. Temporary Kubernetes/Docker job | High | Medium/High | No | Requires existing cluster/job runtime | Conditional |
| D. Bastion | Medium | Medium | No | Requires bastion access management | Backup option |
| E. VPN | Medium | Medium | No | Requires operator VPN/DNS setup | Backup option |

## Why Not Current Backend Container?

The production backend image is built from `server/Dockerfile`. It copies `server/src`, `server-shared`, and server dependencies. It does not contain root migration scripts such as `scripts/account-production-preflight.mjs`.

Therefore the current production API container can prove the network path, but it is not itself a complete migration operator runtime.

## Required Runtime Properties

- Same Yandex VPC network: `enpa19j9jpki1f67p6kq`.
- Same Account Core production environment source.
- Same Firebase Admin credential path or environment payload.
- Repository root available, including `scripts/`, `server/src/`, `server-shared/`, `package.json`, and lockfiles.
- No public PostgreSQL exposure.
- No feature flag change.
- No deploy of application production revision.

## Remote Runner

Prepared command:

```bash
APG_REMOTE_PREFLIGHT_EXECUTION=1 npm run account:remote-preflight -- --execute
```

The command executes only:

1. `postgres:diagnostics`
2. `account:preflight`, only if diagnostics pass

It does not run snapshot/import/verify/canary/cutover/rollback/deploy.
