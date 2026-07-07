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

# Other static files (images, fonts, etc.) — 1 day cache
echo "Uploading static files..."
aws s3 sync dist/ "s3://$BUCKET/" $S3 \
  --exclude "assets/*" \
  --exclude "index.html" \
  --exclude "sw.js" \
  --exclude "manifest.json" \
  --exclude "version.json" \
  --cache-control "public, max-age=86400" \
  --delete

echo ""
echo "Done: $ENDPOINT/$BUCKET/"
