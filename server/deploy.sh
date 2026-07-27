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
CACHE_URI="$IMAGE_NAME:buildcache"

echo "Deploy commit: $GIT_SHA"
echo "Image: $IMAGE_URI"

if [[ "${APG_SKIP_IMAGE_BUILD:-0}" != "1" ]]; then
  METADATA_FILE="$(mktemp)"
  PUBLISH_METADATA_FILE="$(mktemp)"
  OCI_ARCHIVE="$(mktemp)"
  trap 'rm -f "$METADATA_FILE" "$PUBLISH_METADATA_FILE" "$OCI_ARCHIVE"' EXIT

  docker buildx build --platform linux/amd64 -f "$ROOT_DIR/server/Dockerfile" -t "$IMAGE_URI" \
    --cache-from "type=registry,ref=$CACHE_URI" \
    --provenance=false \
    --metadata-file "$METADATA_FILE" \
    --output "type=oci,dest=$OCI_ARCHIVE" \
    "$ROOT_DIR"

  IMAGE_DIGEST="$(node -e "const fs=require('fs');const m=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(m['containerimage.digest']||'')" "$METADATA_FILE")"

  COMPARISON="$(yc serverless container revision list --container-name apg-api --format json \
    | node "$ROOT_DIR/scripts/backend-image-decision.mjs" "$IMAGE_DIGEST")"
  IMAGE_STATUS="$(node -e "process.stdout.write(JSON.parse(process.argv[1]).status)" "$COMPARISON")"
  PRODUCTION_DIGEST="$(node -e "process.stdout.write(JSON.parse(process.argv[1]).productionDigest)" "$COMPARISON")"

  echo "Candidate image digest: $IMAGE_DIGEST"
  echo "Production image digest: $PRODUCTION_DIGEST"

  if [[ "$IMAGE_STATUS" == "SKIPPED_IDENTICAL_IMAGE" ]]; then
    echo "Backend status: SKIPPED_IDENTICAL_IMAGE"
    exit 42
  fi

  docker buildx build --platform linux/amd64 -f "$ROOT_DIR/server/Dockerfile" -t "$IMAGE_URI" \
    --cache-from "type=registry,ref=$CACHE_URI" \
    --cache-to "type=registry,ref=$CACHE_URI,mode=max" \
    --provenance=false \
    --metadata-file "$PUBLISH_METADATA_FILE" \
    --push \
    "$ROOT_DIR"

  PUBLISHED_DIGEST="$(node -e "const fs=require('fs');const m=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(m['containerimage.digest']||'')" "$PUBLISH_METADATA_FILE")"
  if [[ "$PUBLISHED_DIGEST" != "$IMAGE_DIGEST" ]]; then
    echo "Published digest differs from the verified candidate digest." >&2
    exit 1
  fi
else
  echo "Using already pushed image: $IMAGE_URI"
  IMAGE_DIGEST="$(docker buildx imagetools inspect "$IMAGE_URI" --format '{{json .Manifest.Digest}}' | tr -d '"')"
fi

if [[ -z "$IMAGE_DIGEST" ]]; then
  echo "Unable to resolve image digest for $IMAGE_URI" >&2
  exit 1
fi

echo "Published image digest: $IMAGE_DIGEST"

yc serverless container revision deploy \
  --container-name apg-api \
  --image "$IMAGE_URI" \
  --cores 1 --core-fraction 20 --memory 512MB --execution-timeout 30s \
  --concurrency 16 --min-instances 1 --zone-instances-limit 1 \
  --network-id enpa19j9jpki1f67p6kq \
  --service-account-id ajegfv96md2tqri8gjdp \
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
  --environment IDENTITY_PROVIDER=native-apg \
  --environment IDENTITY_STORAGE=postgres \
  --environment APP_VERSION="$GIT_SHA_SHORT" \
  --environment GIT_SHA="$GIT_SHA" \
  --environment BUILD_TIME="$BUILD_TIME" \
  --environment IMAGE_DIGEST="$IMAGE_DIGEST" \
  --environment ACCOUNT_STORAGE="${ACCOUNT_STORAGE_OVERRIDE:-${ACCOUNT_STORAGE:-postgres}}" \
  --environment ACCOUNT_DUAL_READ="${ACCOUNT_DUAL_READ_OVERRIDE:-${ACCOUNT_DUAL_READ:-0}}" \
  --environment ACCOUNT_DUAL_WRITE="${ACCOUNT_DUAL_WRITE_OVERRIDE:-${ACCOUNT_DUAL_WRITE:-0}}" \
  --environment ACCOUNT_FALLBACK="${ACCOUNT_FALLBACK_OVERRIDE:-${ACCOUNT_FALLBACK:-0}}" \
  --environment ACCOUNT_CANARY="${ACCOUNT_CANARY_OVERRIDE:-${ACCOUNT_CANARY:-0}}" \
  --environment ACCOUNT_CANARY_ALLOWLIST="${ACCOUNT_CANARY_ALLOWLIST_OVERRIDE:-${ACCOUNT_CANARY_ALLOWLIST:-}}" \
  --format json \
  | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const r=JSON.parse(s);process.stdout.write(JSON.stringify({id:r.id,status:r.status,imageDigest:r.image?.image_digest||''},null,2)+'\\n')})"

API_BASE="${APG_BACKEND_API_BASE:-${APG_API_BASE_URL:-https://bbangqkf2d4pa9855lu0.containers.yandexcloud.net}}"

node "$ROOT_DIR/scripts/verify-backend-runtime.mjs" --api-base "$API_BASE" --container-name apg-api --expected-git "$GIT_SHA"
