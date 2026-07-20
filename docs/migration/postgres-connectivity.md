# PostgreSQL Connectivity

Date: 2026-07-20

Scope: Account Core production preflight connectivity diagnostics.

No production writes were executed. Diagnostics are limited to DSN presence, DSN parse, DNS, TCP, TLS, and optional read-only `SELECT 1` when earlier stages pass.

## Current Result

| Check | Status |
|---|---|
| DSN configured | PASS |
| DSN parse | PASS |
| DNS lookup | BLOCKED |
| TCP connect | SKIPPED after DNS failure |
| TLS handshake | SKIPPED after DNS failure |
| Read-only auth | SKIPPED after DNS failure |

Root cause: local runtime cannot resolve the PostgreSQL hostname.

The observed error class is `ENOTFOUND`. This happens before TCP, TLS, SSL mode, authentication, schema, or read-only query can be tested.

## Infrastructure Matrix

| Area | Status | Evidence |
|---|---|---|
| Hostname present in DSN | PASS | DSN parses without printing value |
| DNS | BLOCKED | `dns_lookup` returns `ENOTFOUND` |
| VPN/private network | BLOCKED | DNS failure is consistent with private or unavailable DNS from this machine |
| Firewall/security groups | BLOCKED | Cannot be evaluated until DNS resolves |
| Container network | BLOCKED | Local diagnostics do not prove container reachability |
| Local routing | BLOCKED | Cannot be evaluated until hostname resolves |
| Yandex Cloud network | BLOCKED | Needs cloud/network-side confirmation |
| Bastion requirement | BLOCKED | DNS failure may indicate private endpoint requiring bastion/VPN |
| SSL | BLOCKED | TLS skipped after DNS failure |
| Port | BLOCKED | TCP skipped after DNS failure |

## Can This Be Fixed In Code?

No, not based on current evidence.

The code now loads the DSN and parses it. The failure is DNS resolution for the configured host from the migration operator environment.

## Next Safe Step

Resolve DNS/network access for the migration operator environment, then run:

```bash
npm run postgres:diagnostics
npm run account:preflight
```

Do not run snapshot/import/verify/canary/cutover until preflight passes.
