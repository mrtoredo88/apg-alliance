#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/server/.env"

get_env() {
  grep "^$1=" "$ENV_FILE" | head -1 | cut -d'=' -f2-
}

export AWS_ACCESS_KEY_ID="$(get_env YC_ACCESS_KEY)"
export AWS_SECRET_ACCESS_KEY="$(get_env YC_SECRET_KEY)"

BUCKET="myapg-frontend"
ENDPOINT="https://storage.yandexcloud.net"
S3="--endpoint-url $ENDPOINT --region ru-central1"

echo "Building..."
npm run build

# Hashed assets — immutable, 1 year cache
echo "Uploading assets/..."
aws s3 sync dist/assets/ "s3://$BUCKET/assets/" $S3 \
  --cache-control "public, max-age=31536000, immutable"

# Critical no-cache files (change on every deploy)
echo "Uploading no-cache files..."
aws s3 cp dist/index.html "s3://$BUCKET/index.html" $S3 \
  --content-type "text/html; charset=utf-8" \
  --cache-control "no-cache, no-store, must-revalidate"

aws s3 cp dist/sw.js "s3://$BUCKET/sw.js" $S3 \
  --content-type "application/javascript; charset=utf-8" \
  --cache-control "no-cache, no-store, must-revalidate"

aws s3 cp dist/manifest.json "s3://$BUCKET/manifest.json" $S3 \
  --content-type "application/manifest+json" \
  --cache-control "no-cache, no-store, must-revalidate"

aws s3 cp dist/version.json "s3://$BUCKET/version.json" $S3 \
  --content-type "application/json" \
  --cache-control "no-cache, no-store, must-revalidate"

if [ -f dist/network-diagnostics-lite ]; then
  aws s3 cp dist/network-diagnostics-lite "s3://$BUCKET/network-diagnostics-lite" $S3 \
    --content-type "text/html; charset=utf-8" \
    --cache-control "no-cache, no-store, must-revalidate"
fi

if [ -f dist/android ]; then
  aws s3 cp dist/android "s3://$BUCKET/android" $S3 \
    --content-type "text/html; charset=utf-8" \
    --cache-control "public, max-age=300"
fi

# Other static files (images, fonts, etc.) — 1 day cache
echo "Uploading static files..."
aws s3 sync dist/ "s3://$BUCKET/" $S3 \
  --exclude "assets/*" \
  --exclude "downloads/*" \
  --exclude "index.html" \
  --exclude "sw.js" \
  --exclude "manifest.json" \
  --exclude "version.json" \
  --exclude "network-diagnostics-lite" \
  --exclude "android" \
  --cache-control "public, max-age=86400" \
  --delete

echo ""
echo "Done: $ENDPOINT/$BUCKET/"

# VK Mini App hosting — та же сборка, что и web: расхождение версий каналов недопустимо
VK_TOKEN="$(grep '^MINI_APPS_ACCESS_TOKEN=' "$SCRIPT_DIR/.env.deploy.local" 2>/dev/null | cut -d'=' -f2-)"
if [ -n "$VK_TOKEN" ]; then
  echo "Deploying VK Mini App hosting..."
  MINI_APPS_ACCESS_TOKEN="$VK_TOKEN" npx vk-miniapps-deploy || echo "⚠️  VK deploy failed — VK Mini App останется на старой версии!"
else
  echo "⚠️  MINI_APPS_ACCESS_TOKEN не найден в .env.deploy.local — VK Mini App останется на старой версии!"
fi
