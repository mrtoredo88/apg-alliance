# RuStore Android release candidate 2.0.0

Status: implementation candidate only. Do not publish or deploy without owner approval.

## Release identity blockers

- `applicationId` is currently `ru.myapg.app`; confirm it exactly matches the published RuStore package.
- `versionCode` is `20000` and `versionName` is `2.0.0`; confirm `20000` is greater than every uploaded RuStore artifact.
- Obtain the RuStore signing-certificate SHA-256 and replace `REPLACE_WITH_RUSTORE_SIGNING_CERT_SHA256` in `public/.well-known/assetlinks.json`.
- Create a RuStore Push project for the exact package and signing certificate, then provide `RUSTORE_PUSH_PROJECT_ID` during Android build.
- Configure backend `RUSTORE_PUSH_PROJECT_ID` and `RUSTORE_PUSH_SERVICE_TOKEN`. Firebase, FCM and `google-services.json` are not used.

## Changelog

- Android 13+ notification permission, token rotation and per-device registration.
- Notification channels, foreground receipt, cold/hot notification navigation, expired-token cleanup, token-redacted diagnostics.
- Native ML Kit QR scanning with runtime camera permission, duplicate suppression and web fallback.
- Verified HTTPS App Links and `myapg://` fallback for partner, profile, event, messages, booking, QR and news routes.
- Versioned TTL offline cache for profile, news and dialog-list payloads; sensitive fields are stripped and user-scoped data is removed on logout.
- Capacitor WebView CORS support for OTP/Telegram/session APIs; PostgreSQL-only OTP and verification-token storage.
- No `REQUEST_INSTALL_PACKAGES`; backup disabled for app-private data.

## Test matrix

Run each row on Android 10, 11, 12, 13, 14 and 15 (physical device for push/camera):

| Scenario | Expected |
|---|---|
| Clean install, notification allowed | One device row; one RuStore token; channels created |
| Clean install, notification denied | App works; settings can retry; no loop |
| Upgrade over RuStore version | Session survives; schema v2 cache migrates by ignoring old records |
| Email OTP online | One code, PostgreSQL Identity V2 session restored after force-stop/reboot |
| Email OTP offline/timeout | Finite error; retry works; no guest/login loop |
| Telegram link + callback, warm/cold | Same canonical user; callback opens app once |
| Logout then account B | Account A cache and device binding removed; no A data shown |
| Push foreground/background/killed | Notification received once; tap opens allowed route |
| Message push | Generic private preview; opens `/messages` after authentication |
| Camera allowed/denied | ML Kit scan succeeds, or actionable permission error; close/back returns normally |
| Duplicate QR within 2.5 s | Only first value is submitted |
| Offline start | Cached profile/news/dialog list shown stale, refreshes after reconnect |
| App Link/custom scheme invalid host/route | Rejected to `/`; no arbitrary navigation |

Automated gates:

```bash
npm run test:android-release
npm run test:identity-v2-guard
npm run test:auth-lifecycle
npm run test:scanner-camera
npm run test:notification-delivery
npm run build
npm run android:sync
cd android && ./gradlew test lint bundleRelease assembleRelease
```

## Signed build

Keep signing secrets outside git. With `APG_UPLOAD_STORE_FILE`, `APG_UPLOAD_STORE_PASSWORD`, `APG_UPLOAD_KEY_ALIAS`, and `APG_UPLOAD_KEY_PASSWORD` wired into a local untracked Gradle properties file:

```bash
npm ci
npm run android:sync
cd android
./gradlew clean bundleRelease assembleRelease
jarsigner -verify -verbose -certs app/build/outputs/bundle/release/app-release.aab
apksigner verify --verbose --print-certs app/build/outputs/apk/release/app-release.apk
```

Artifacts: `android/app/build/outputs/bundle/release/app-release.aab` and `android/app/build/outputs/apk/release/app-release.apk`.

## Publication plan

1. Confirm package id, current RuStore version and signing ownership.
2. Create the matching RuStore Push project; configure Android project ID and backend RuStore service token.
3. Replace and deploy `assetlinks.json`; verify HTTPS 200, `application/json`, no redirect, correct certificate fingerprint.
4. Build signed AAB/APK locally and verify certificate equals the published app certificate.
5. Run the full matrix on a clean device and an upgrade installed from the current RuStore APK.
6. Send an internal RuStore test push to foreground/background/killed app and verify token cleanup/rotation.
7. Upload AAB to RuStore only after explicit owner approval; use staged rollout if available.
8. Monitor authentication failures, RuStore delivery, crashes and App Link verification; retain the prior artifact for rollback.
