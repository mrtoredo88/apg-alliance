# Serverless Deploy Root Cause

Date: 2026-07-20

## Root Cause

The failed `apg-migration-operator` revision used a `linux/arm64` image.

Yandex Serverless Containers production runtime requires Linux x86_64 / AMD64 images. The working `apg-api` production image is `linux/amd64`.

This is a configuration/build-platform issue in the operator image, not a PostgreSQL, VPC, IAM, migration, or application runtime issue.

## First Real Failure

First real failure:

```text
yc serverless container revision deploy
-> operation bbac9l7ls7gbhu8igrac
-> code=13 Internal error
-> metadata revision bbasmnedbeba6qqh4psp
-> revision not found
```

The container did not start. There were no operator runtime logs and no `/run` invocation.

## Root Cause Tree

| Branch | Status | Evidence |
|---|---|---|
| Platform | FAILED | Operator image platform is `linux/arm64`; Yandex runtime requirement is AMD64/Linux x86_64. |
| Image | FAILED | `docker image inspect` shows `Architecture: arm64`; production `apg-api` image is `amd64`. |
| Configuration | FAILED | Operator image was built on local ARM Docker without forcing `linux/amd64`. |
| IAM | PASS | Image push succeeded; container create succeeded; production service account is already used by `apg-api`. No permission-specific error was returned. |
| Registry | PASS | Operator image exists in Container Registry with digest and tag. |
| VPC | PASS | Failure happened before revision materialization; VPC was not applied to a live revision. Production VPC path remains known-good for `apg-api`. |
| PostgreSQL | PASS | Not reached; no evidence of PostgreSQL failure. |
| Entrypoint | WARNING | Not reached. Entrypoint cannot be validated until a compatible image deploys. |
| Quota | PASS | Serverless/container registry quota usage is below limits. |
| Runtime logs | PASS | No operator logs, consistent with pre-runtime deployment failure. |
| Known Yandex incident | UNKNOWN | Public status page was not machine-readable in CLI/browser due JS-only page; no official incident evidence was available from read-only checks. |

## Classification

Problem type: Configuration.

Fix class: rebuild the operator image for `linux/amd64` and retry only the operator revision deploy.

This can be fixed without changing:

- production `apg-api`
- production traffic
- VPC
- DNS
- Security Groups
- PostgreSQL
- migration pipeline
- Account Core data

## Safety

It is safe to retry deploy only after rebuilding the operator image for `linux/amd64`, because the previous failure occurred before runtime and did not execute remote preflight.

Retry must still obey the existing guardrails:

- no snapshot
- no import
- no verify
- no canary
- no cutover
- no rollback
- no Firestore reads
- no PostgreSQL writes

