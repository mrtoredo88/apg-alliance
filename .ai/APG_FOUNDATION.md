# APG Foundation

Дата фиксации: 2026-07-16

Foundation tag: `v1.0-foundation`

Production commit: `acf1149dc5f96b7350f7241893e237cf78de82cc`

Production version: `acf1149d`

## Purpose

This document defines the APG foundation principles after the completion of Desktop Experience, Living Profile, Feed Framework, Smart Media, Workspace, PWA, performance, and production stabilization work.

It is not a feature backlog. It is the decision layer for future development.

## Foundation Principles

1. Desktop Experience is considered a finished foundation.

New public desktop work must extend the shared desktop architecture instead of creating isolated desktop screens.

2. Shared Desktop UI Framework is mandatory for new desktop sections.

New desktop surfaces should use shared shells, headers, toolbars, KPI, grids, right rails, cards, empty states, skeletons, action bars, and detail primitives where applicable.

3. Desktop Catalog Framework is the catalog standard.

Partners, Experts, Events, News, Offers, and Rewards must keep a coherent desktop catalog language. Mobile cards must not be stretched into desktop layouts.

4. Desktop Detail Framework is the detail standard.

Desktop detail pages must not be functionally weaker than mobile detail pages. Media, CTA, contacts, reviews, comments, sharing, actions, and related content must remain in parity unless there is an explicit product decision.

5. Living Profile is the public profile standard.

Partner and expert profiles are living digital profiles, not static cards. They must preserve a clear hierarchy:

- Hero
- Core CTA
- Feed
- What matters now
- About
- Offers
- Photos
- Video
- Reviews

6. Feed Framework is the single activity stream model.

New activity streams must use or extend Feed Framework. Do not create parallel feed implementations for profile posts, news, events, media, offers, or future activity types.

7. Smart Media Framework is the single media display model.

Photos, video, galleries, thumbnails, preview states, and viewers should use the existing Smart Media / Profile Media Viewer path. Do not introduce one-off iframe galleries or separate media renderers.

8. Workspace is the daily work surface.

Partner and expert operational flows should integrate into Workspace centers instead of adding disconnected admin-like screens.

9. Loki is the intelligence entry point.

Intelligence should be surfaced through Loki or context-aware assistant blocks. Avoid scattering AI recommendations into unrelated thematic cards.

10. Context Dialogs are contextual by design.

Messaging must remain tied to a partner, expert, event, offer, booking, review, or future object. APG should not become a generic messenger.

11. Production domains must stay synchronized.

Every release must keep:

- `https://myapg.ru/version.json`
- `https://apg-alliance.vercel.app/version.json`

on the same production version.

12. Recovery points must be protected.

The `v1.0-foundation` tag is a stable recovery point. It must not be moved or rewritten.

13. No duplicate architecture.

Future features should integrate into the existing foundation:

- Shared Desktop Framework
- Desktop Catalog Framework
- Desktop Detail Framework
- Feed Framework
- Smart Media Framework
- Workspace centers
- Context Dialogs
- Notification Pipeline
- Intelligence Platform

Parallel implementations are allowed only after an explicit architecture decision.

14. Business logic and UX are separate concerns.

Visual polish must not change Firestore models, API contracts, permissions, moderation, rewards, bookings, notifications, or auth behavior unless the task explicitly requires it.

15. Production stability outranks feature velocity.

If a P0 regression appears in auth, production loading, PWA startup, QR, booking, notifications, dialogs, or public navigation, feature work pauses until the critical path is stable again.

## Release Standard

For production-bound work:

1. Check Git state.
2. Implement only the requested scope.
3. Run required tests.
4. Commit source changes.
5. Push to GitHub.
6. Build after commit so `version.json` reflects the correct hash.
7. Deploy.
8. Verify both production domains.
9. Run production smoke.
10. Report Git, GitHub, Build, Tests, Production, and changed files.

## What Not To Do

- Do not create a second desktop framework.
- Do not create another feed renderer.
- Do not create another media viewer.
- Do not make desktop detail pages weaker than mobile.
- Do not add intelligence UI randomly into unrelated cards.
- Do not fork Workspace flows into separate disconnected screens.
- Do not deploy when tests fail.
- Do not move `v1.0-foundation`.

## Foundation Modules

- Desktop Experience v1
- Shared Desktop UI Framework
- Desktop Catalog Framework
- Desktop Detail Framework
- Living Profile
- Feed Framework
- Smart Media Framework
- Media Viewer
- Workspace v1
- Workspace Intelligence
- PWA
- Booking / Meetings
- Context Dialogs
- Notifications
- Loki
- Intelligence Platform
- Performance Optimization

## Decision Rule

When adding a new feature, first ask:

1. Which existing APG foundation layer should own this?
2. Can this reuse current UI and data contracts?
3. Does this preserve mobile/desktop parity?
4. Does this keep production domains synchronized?
5. Does this keep the recovery path intact?

If the answer is unclear, pause and make an architecture decision before implementation.
