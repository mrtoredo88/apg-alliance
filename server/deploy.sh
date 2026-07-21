#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/server/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

get_env() {
  local key="$1"
  grep "^$key=" "$ENV_FILE" | tail -n 1 | cut -d'=' -f2- || true
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Required command not found: $cmd" >&2
    exit 1
  fi
}

require_cmd git
require_cmd docker
require_cmd yc
require_cmd node

IMAGE_NAME="cr.yandex/crpvv13u8vr3qjftdvvg/apg-api"

GIT_SHA="$(git -C "$ROOT_DIR" rev-parse HEAD)"
GIT_SHA_SHORT="$(git -C "$ROOT_DIR" rev-parse --short=8 HEAD)"
BUILD_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
IMAGE_TAG="$GIT_SHA_SHORT"
IMAGE_URI="$IMAGE_NAME:$IMAGE_TAG"

echo "Deploy commit: $GIT_SHA"
echo "Image: $IMAGE_URI"

docker build -f "$ROOT_DIR/server/Dockerfile" -t "$IMAGE_URI" \
  --build-arg APP_VERSION="$GIT_SHA_SHORT" \
  --build-arg GIT_SHA="$GIT_SHA" \
  --build-arg BUILD_TIME="$BUILD_TIME" \
  "$ROOT_DIR"

docker push "$IMAGE_URI"

DIGEST_WITH_TAG="$(docker inspect --format='{{index .RepoDigests 0}}' "$IMAGE_URI")"
if [[ -z "$DIGEST_WITH_TAG" || "$DIGEST_WITH_TAG" == "<no value>" ]]; then
  echo "Unable to resolve image digest for $IMAGE_URI" >&2
  exit 1
fi

IMAGE_DIGEST="${DIGEST_WITH_TAG##*@}"
if [[ -z "$IMAGE_DIGEST" ]]; then
  echo "Unable to parse image digest from: $DIGEST_WITH_TAG" >&2
  exit 1
fi

echo "Pushed image digest: $IMAGE_DIGEST"

yc serverless container revision deploy \
  --container-name apg-api \
  --image "$IMAGE_URI" \
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
  --environment APP_VERSION="$GIT_SHA_SHORT" \
  --environment GIT_SHA="$GIT_SHA" \
  --environment BUILD_TIME="$BUILD_TIME" \
  --environment IMAGE_DIGEST="$IMAGE_DIGEST" \
  --environment ACCOUNT_STORAGE="${ACCOUNT_STORAGE_OVERRIDE:-${ACCOUNT_STORAGE:-firestore}}" \
  --environment ACCOUNT_DUAL_READ="${ACCOUNT_DUAL_READ_OVERRIDE:-${ACCOUNT_DUAL_READ:-1}}" \
  --environment ACCOUNT_DUAL_WRITE="${ACCOUNT_DUAL_WRITE_OVERRIDE:-${ACCOUNT_DUAL_WRITE:-0}}" \
  --environment ACCOUNT_FALLBACK="${ACCOUNT_FALLBACK_OVERRIDE:-${ACCOUNT_FALLBACK:-1}}" \
  --environment ACCOUNT_CANARY="${ACCOUNT_CANARY_OVERRIDE:-${ACCOUNT_CANARY:-0}}" \
  --environment ACCOUNT_CANARY_ALLOWLIST="${ACCOUNT_CANARY_ALLOWLIST_OVERRIDE:-${ACCOUNT_CANARY_ALLOWLIST:-}}"

API_BASE="${APG_BACKEND_API_BASE:-${APG_API_BASE_URL:-https://bbangqkf2d4pa9855lu0.containers.yandexcloud.net}}"

node "$ROOT_DIR/scripts/verify-backend-runtime.mjs" --api-base "$API_BASE" --container-name apg-api --expected-git "$GIT_SHA"
