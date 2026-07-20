# Firebase Auth Decision

## Current State

Identity storage has moved to PostgreSQL for the normal path, while Firebase remains the Identity Provider.

Current shape:

```text
APG Identity
  |
  +-- PostgreSQL Identity Storage
  |
  +-- FirebaseIdentityProvider
```

This reduced Firestore quota exposure for email identity resolution, but it did not remove dependency on Firebase Auth.

## Option A. Keep Firebase Auth as Provider

Description:

- Keep Firebase Auth for custom token, client auth state, and token verification.
- Continue moving business data out of Firestore.

Pros:

- Lowest immediate risk.
- Existing users and clients continue working.
- Compatible with current PWA/VK flows.

Cons:

- Firebase Auth outage remains P0.
- Client still imports Firebase Auth.
- Full Google independence is not achieved.

Recommendation:

- Use as short-term transition state only.

## Option B. APG Session Layer with Firebase Compatibility

Description:

- Introduce APG-owned access/refresh sessions in PostgreSQL.
- Firebase Auth remains optional compatibility provider during migration.
- Backend verifies APG sessions first, Firebase tokens second while compatibility is enabled.

Pros:

- Removes Firebase Auth from the critical long-term path.
- Allows gradual client migration.
- Keeps rollback compatibility.
- Aligns with APG Foundation and Identity Layer.

Cons:

- Requires careful security review.
- Requires session revocation, device tracking, token rotation, and CSRF/transport decisions.
- Requires frontend auth adapter work.

Recommendation:

- Target architecture for the next Identity/Auth evolution after Account Core.

## Option C. Full Firebase Auth Removal Now

Description:

- Replace Firebase Auth immediately with APG/Yandex/OIDC/Keycloak/Auth0/native provider.

Pros:

- Fastest path to full Google independence.

Cons:

- Highest production risk.
- Touches every auth/session/client/backend path.
- Hard to combine safely with remaining Firestore domain migrations.

Recommendation:

- Do not do this now.

## Decision

Recommended path:

1. Continue with Option A as the current production posture.
2. Migrate Account Core out of Firestore.
3. Implement Option B as APG Session Layer.
4. Retire Firebase Auth only after APG sessions, Account Core, and critical domains are stable.

## Required Owner Decision

Approve Firebase Auth as a temporary provider, not a permanent source of identity truth.
