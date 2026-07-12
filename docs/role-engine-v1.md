# Role Engine V1

Role Engine V1 is the shared APG role contract used by frontend and backend code.

The canonical implementation lives in:

- `server-shared/role-engine.js`
- `src/roleEngine.js` as a frontend re-export

## Contract

Supported roles:

- `user`
- `expert`
- `partner`
- `analyst`
- `moderator`
- `editor`
- `admin`
- `super_admin`
- `owner`

Legacy aliases:

- `administrator` → `admin`

`super_admin` is never converted to `owner` or `admin`. It keeps its own identity and receives access through permissions and capabilities.

Unknown roles are diagnostic only. They are ignored for access decisions; if no valid role remains, the user receives the safe fallback role `user`.

## Access model

The application should not make product decisions from raw role strings directly.

Preferred flow:

```txt
identity → roles[] → primaryRole → permissions[] → capabilities → UI / access
```

Rank is used only for `primaryRole` selection and display priority. It does not automatically inherit permissions.

## Current integrations

| Area | Files | Role Engine usage |
| --- | --- | --- |
| Identity Core | `server/src/lib/identityCore.js` | normalization, user roles, primary role |
| Workspace Core | `src/workspace/WorkspaceCore.js` | navigation filtering by capabilities |
| Workspace Feature Flags | `src/workspace/WorkspaceFeatureFlags.js` | rollout stage + workspace capability |
| Business Hub | `src/businessHub/BusinessHubCore.js` | rollout stage + business capability |
| Cabinet Core | `src/cabinet/CabinetRoleEngine.js` | cabinet role definitions from normalized roles |
| UserApp | `src/UserApp.jsx` | shared role diagnostics, bottom navigation identity |
| ProfilePanel | `src/ProfilePanel.jsx` | privileged profile and diagnostics visibility |
| Admin login | `server/src/routes/admin-login.js` | admin access capability and claims |
| Admin security | `server/src/routes/admin-security.js` | admin list, role management, claims |
| Admin actions | `server/src/routes/admin-actions.js` | legal-data access by canonical role |
| Email auth | `server/src/routes/email-auth.js` | custom token role/roles/admin/owner claims |
| User actions | `server/src/routes/user-actions.js` | owner-only actions by canonical owner role |

## Audit notes

| Finding | Previous risk | V1 change |
| --- | --- | --- |
| Workspace used local role normalization | `super_admin` was mapped to `owner` and could hide role regressions | `getWorkspaceNavigation` now uses Role Engine diagnostics and capabilities |
| Workspace flags had local `ADMIN_ROLES` / `OWNER_ROLES` | same role could have different rollout access in different modules | rollout decisions use `isRoleWithinRolloutStage` and capabilities |
| Business Hub duplicated Workspace role logic | partner/expert/admin access could drift | Business Hub uses the same Role Engine identity model |
| Cabinet role engine converted `super_admin` to `admin` | role identity was lost in UI context | `super_admin` has its own cabinet role definition |
| Admin login/security duplicated role allowlists | admin access and claims could drift from frontend | access checks use `canOpenAdminPanel`; owner claim is only real owner |
| Unknown roles could break navigation | empty UI in User Mode / Workspace | unknown values are reported through diagnostics; fallback is `user` |

## Tests

`npm run test:roles` runs the Role Engine contract test.

`npm run test:core` includes Role Engine, Identity Core, Content Lifecycle, Business Hub and Workspace Core tests.
