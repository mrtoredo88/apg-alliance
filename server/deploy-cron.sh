#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
CONTAINER_ID="bbangqkf2d4pa9855lu0"
SERVICE_ACCOUNT_ID="ajegfv96md2tqri8gjdp"

get_env() {
  grep "^$1=" "$ENV_FILE" | head -1 | cut -d'=' -f2-
}

ensure_timer() {
  local name="$1"
  local cron="$2"
  local path="$3"
  local payload="$4"

  if yc serverless trigger get --name "$name" >/dev/null 2>&1; then
    yc serverless trigger delete --name "$name" --force >/dev/null
  fi

  yc serverless trigger create timer "$name" \
    --cron-expression "$cron" \
    --invoke-container-id "$CONTAINER_ID" \
    --invoke-container-path "$path" \
    --invoke-container-service-account-id "$SERVICE_ACCOUNT_ID" \
    --payload "$payload" \
    --retry-attempts 2 \
    --retry-interval 60s >/dev/null

  echo "timer $name -> $path"
}

ensure_timer "apg-raffle-draw" "0 10 * * ? *" "/api/raffle-draw" "{\"secret\":\"$(get_env RAFFLE_SECRET)\",\"source\":\"yandex-cron\"}"
ensure_timer "apg-activity-index" "0 3 * * ? *" "/api/activity-index" "{\"secret\":\"$(get_env ACTIVITY_SECRET)\",\"source\":\"yandex-cron\"}"
ensure_timer "apg-expert-rotation" "0 0 ? * MON *" "/api/expert-rotation" "{\"source\":\"yandex-cron\"}"

yc serverless trigger list
