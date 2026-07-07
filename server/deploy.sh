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
  --service-account-id ajegfv96md2tqri8gjdp \
  --environment GOOGLE_APPLICATION_CREDENTIALS=/app/firebase-service-account.json \
  --environment YC_ACCESS_KEY="$(get_env YC_ACCESS_KEY)" \
  --environment YC_SECRET_KEY="$(get_env YC_SECRET_KEY)" \
  --environment PUSH_SECRET="$(get_env PUSH_SECRET)" \
  --environment RAFFLE_SECRET="$(get_env RAFFLE_SECRET)" \
  --environment ACTIVITY_SECRET="$(get_env ACTIVITY_SECRET)" \
  --environment TELEGRAM_BOT_TOKEN="$(get_env TELEGRAM_BOT_TOKEN)" \
  --environment VK_SERVICE_TOKEN="$(get_env VK_SERVICE_TOKEN)" \
  --environment VK_USER_TOKEN="$(get_env VK_USER_TOKEN)" \
  --environment VK_GROUP_TOKEN="$(get_env VK_GROUP_TOKEN)" \
  --environment YANDEX_EMAIL="$(get_env YANDEX_EMAIL)" \
  --environment YANDEX_EMAIL_PASS="$(get_env YANDEX_EMAIL_PASS)" \
  --environment POSTBOX_KEY_ID="$(get_env POSTBOX_KEY_ID)" \
  --environment POSTBOX_SECRET="$(get_env POSTBOX_SECRET)"
