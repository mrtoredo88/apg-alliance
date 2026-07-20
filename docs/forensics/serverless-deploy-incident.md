# APG Serverless Deploy Incident

Date: 2026-07-20

## Scope

Read-only forensic investigation for one failed Yandex Serverless Containers operation:

- Container: `apg-migration-operator`
- Operation: `bbac9l7ls7gbhu8igrac`
- Operation type: Deploy revision
- Result: `code=13`, `Internal error`

No deploy retry, delete, update, traffic switch, PostgreSQL write, Firestore read/write, snapshot, import, verify, canary, cutover, or rollback was performed during this investigation.

## Operation

Read-only command:

```bash
yc operation get bbac9l7ls7gbhu8igrac --format json
```

Result:

| Field | Value |
|---|---|
| Operation ID | `bbac9l7ls7gbhu8igrac` |
| Description | `Deploy revision` |
| Created | `2026-07-20T10:16:56.615Z` |
| Modified | `2026-07-20T10:16:58.924Z` |
| Done | `true` |
| Metadata revision ID | `bbasmnedbeba6qqh4psp` |
| Error code | `13` |
| Error message | `Internal error` |

The metadata revision ID was not materialized:

```bash
yc serverless container revision get bbasmnedbeba6qqh4psp --format json
```

Result:

```text
Container revision not found: bbasmnedbeba6qqh4psp
```

## Resource State

`apg-migration-operator` container exists:

| Field | Value |
|---|---|
| Container ID | `bbatdc5luq828rcn1tav` |
| Name | `apg-migration-operator` |
| Status | `ACTIVE` |
| Created | `2026-07-20T10:16:53.168Z` |

It has no active revisions:

```json
[]
```

Therefore the operator never reached runtime startup and `/run` was not invoked.

## Container Registry

The operator image exists:

| Field | Value |
|---|---|
| Image | `cr.yandex/crpvv13u8vr3qjftdvvg/apg-migration-operator:ab88f027` |
| Digest | `sha256:1d13806e6e37b9ad6396fe9b9970cfe5049709f97a265a4dcafcddf0bdfa915b` |
| Created | `2026-07-20T10:16:48.399Z` |
| Compressed size | `147832276` |

Image platform:

| Image | OS | Architecture |
|---|---|---|
| `apg-migration-operator:ab88f027` | `linux` | `arm64` |
| `apg-api:latest` current production image | `linux` | `amd64` |

The current production `apg-api` revision uses:

- Revision: `bbajlv94m6112jbjsipv`
- Image digest: `sha256:c397bddb0d4c8e9df16f28cc1f157808ee98de8115c666a5dfcff239ef4863cc`
- Runtime: HTTP
- Memory: 512 MB
- CPU: 1 core
- Timeout: 30s
- VPC: `enpa19j9jpki1f67p6kq`
- Service account: `ajegfv96md2tqri8gjdp`

## Logs

Read-only Cloud Logging query for `apg-migration-operator` during the incident window returned no runtime logs.

This is consistent with the revision failing before container startup.

## Quotas

Cloud-level Serverless Containers quota snapshot:

| Quota | Limit | Usage |
|---|---:|---:|
| `serverless.containers.count` | 10 | 2 |
| `serverless.containers.size` | 21474836480 | 75758655 |
| `serverless.containersCpu.count` | 10 | 1 |
| `serverless.containersInstances.count` | 10 | 1 |
| `serverless.containersMemory.size` | 21474836480 | 536870912 |
| `serverless.containersRequest.count` | 10 | 0 |
| `serverless.containersWorkersProvisioned.count` | 2 | 1 |

Container Registry quota snapshot:

| Quota | Limit | Usage |
|---|---:|---:|
| `container-registry.parallelScans.count` | 10 | 0 |
| `container-registry.registries.count` | 10 | 1 |

No quota exhaustion evidence was found.

## Official Runtime Requirement

Yandex Cloud Serverless Containers runtime is AMD64 and requires executables compiled for Linux x86_64:

- Runtime architecture: AMD64
- Supported images: executables compiled under Linux x86_64

Source: <https://yandex.cloud/en/docs/serverless-containers/concepts/runtime>

