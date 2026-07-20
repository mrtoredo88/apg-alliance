#!/bin/bash
set -e

ENV_FILE="$(dirname "$0")/.env"

get_env() {
  grep "^$1=" "$ENV_FILE" | head -1 | cut -d'=' -f2-
}

yc serverless container revision deploy \
  --container-name apg-api \
  --image cr.yandex/crpvv13u8vr3qjftdvvg/apg-api:latest \
  --cores 1 --memory 512MB --execution-timeout 30s \
  --concurrency 16 --min-instances 1 \
  --network-id enpa19j9jpki1f67p6kq \
  --service-account-id ajegfv96md2tqri8gjdp \
  --environment GOOGLE_APPLICATION_CREDENTIALS=/app/firebase-service-account.json \
  --environment YC_ACCESS_KEY="$(get_env YC_ACCESS_KEY)" \
  --environment YC_SECRET_KEY="$(get_env YC_SECRET_KEY)" \
  --environment PUSH_SECRET="$(get_env PUSH_SECRET)" \
  --environment CRON_SECRET="$(get_env CRON_SECRET)" \
  --environment RAFFLE_SECRET="$(get_env RAFFLE_SECRET)" \
  --environment ACTIVITY_SECRET="$(get_env ACTIVITY_SECRET)" \
  --environment TELEGRAM_BOT_TOKEN="$(get_env TELEGRAM_BOT_TOKEN)" \
  --environment VK_SERVICE_TOKEN="$(get_env VK_SERVICE_TOKEN)" \
  --environment VK_USER_TOKEN="$(get_env VK_USER_TOKEN)" \
  --environment VK_GROUP_TOKEN="$(get_env VK_GROUP_TOKEN)" \
  --environment WEB_PUSH_VAPID_PUBLIC_KEY="$(get_env WEB_PUSH_VAPID_PUBLIC_KEY)" \
  --environment WEB_PUSH_VAPID_PRIVATE_KEY="$(get_env WEB_PUSH_VAPID_PRIVATE_KEY)" \
  --environment WEB_PUSH_VAPID_SUBJECT="$(get_env WEB_PUSH_VAPID_SUBJECT)" \
  --environment YANDEX_EMAIL="$(get_env YANDEX_EMAIL)" \
  --environment YANDEX_EMAIL_PASS="$(get_env YANDEX_EMAIL_PASS)" \
  --environment POSTBOX_KEY_ID="$(get_env POSTBOX_KEY_ID)" \
  --environment POSTBOX_SECRET="$(get_env POSTBOX_SECRET)" \
  --environment APG_IDENTITY_DATABASE_URL="$(get_env APG_IDENTITY_DATABASE_URL)" \
  --environment IDENTITY_PROVIDER="$(get_env IDENTITY_PROVIDER)" \
  --environment IDENTITY_STORAGE="$(get_env IDENTITY_STORAGE)" \
  --environment IDENTITY_DUAL_READ="$(get_env IDENTITY_DUAL_READ)" \
  --environment IDENTITY_DUAL_WRITE="${IDENTITY_DUAL_WRITE_OVERRIDE:-false}" \
  --environment IDENTITY_FALLBACK="$(get_env IDENTITY_FALLBACK)" \
  --environment ACCOUNT_STORAGE="${ACCOUNT_STORAGE_OVERRIDE:-${ACCOUNT_STORAGE:-firestore}}" \
  --environment ACCOUNT_DUAL_READ="${ACCOUNT_DUAL_READ_OVERRIDE:-${ACCOUNT_DUAL_READ:-1}}" \
  --environment ACCOUNT_DUAL_WRITE="${ACCOUNT_DUAL_WRITE_OVERRIDE:-${ACCOUNT_DUAL_WRITE:-0}}" \
  --environment ACCOUNT_FALLBACK="${ACCOUNT_FALLBACK_OVERRIDE:-${ACCOUNT_FALLBACK:-1}}" \
  --environment ACCOUNT_CANARY="${ACCOUNT_CANARY_OVERRIDE:-${ACCOUNT_CANARY:-0}}" \
  --environment ACCOUNT_CANARY_ALLOWLIST="${ACCOUNT_CANARY_ALLOWLIST_OVERRIDE:-${ACCOUNT_CANARY_ALLOWLIST:-}}"
