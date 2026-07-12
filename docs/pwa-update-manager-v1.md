# PWA Update Manager V1

PWA Update Manager is the single APG frontend module responsible for PWA update decisions.

Canonical module:

- `src/pwa/PwaUpdateManager.js`

## Pipeline

```txt
Application Start
↓
PWA Update Manager
↓
Service Worker registration
↓
Version Check
↓
Cache Validation
↓
Cache Migration
↓
Bootstrap
↓
Render
```

`src/main.jsx` starts the manager before React render. Components do not register the Service Worker, clear Cache Storage, or fetch `version.json` directly.

## Responsibilities

| Area | Owner |
| --- | --- |
| Service Worker registration | PWA Update Manager |
| `version.json` fetch and comparison | PWA Update Manager |
| installed / available version state | PWA Update Manager |
| Cache Storage cleanup | PWA Update Manager |
| cache migration per version | PWA Update Manager |
| update diagnostics snapshot | PWA Update Manager |
| recovery cache clear + reload | PWA Update Manager |
| push / navigation fallback | Service Worker |

## Old update map

| File | Previous responsibility | V1 result |
| --- | --- | --- |
| `src/main.jsx` | registered Service Worker and cleared Cache Storage after registration | delegates startup to `startPwaUpdateManager` |
| `src/App.jsx` | fetched `version.json`, compared `apg_build`, cleared caches, reloaded | no longer owns update decisions |
| `src/UserApp.jsx` | listened to SW diagnostics and fetched `version.json` from diagnostics UI | subscribes to PWA Update Manager diagnostics |
| `src/ErrorBoundary.jsx` | unregistered Service Workers, cleared caches, removed `apg_build`, reloaded | delegates recovery to `recoverPwaAndReload` |
| `src/errorLogger.js` | fetched `version.json` independently | reads version through `getPwaVersion` |
| `src/diagnostics.js` | fetched `version.json` independently | reads version through `getPwaVersion` |
| `src/userApi.js` | fetched `version.json` independently for headers | reads version through `getPwaVersion` |
| `public/sw.js` | cleared all caches on install/activate | clears cache only when commanded by manager |

## Safe update

The manager supports critical-action locks:

- `window.__APG_PWA_UPDATE_LOCKED`
- `window.__APG_CRITICAL_ACTION_ACTIVE`
- `setPwaCriticalAction(name, active)`

If an update is available during a critical action, cache migration can complete but reload is deferred until a safe moment.

## Diagnostics fields

- App Version
- Installed Version
- Available Version
- Service Worker Version
- Cache Version
- Cache Age
- Bootstrap Source
- Update Status
- Last Update Time
- Cache Migration Result

## Test

Run:

```bash
npm run test:pwa-update
```

This test verifies same-version cache preservation, new-version cache migration, single Service Worker registration, no repeated cache clearing, diagnostics, and removal of old parallel update flows.
