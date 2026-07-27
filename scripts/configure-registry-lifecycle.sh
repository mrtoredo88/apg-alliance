#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REGISTRY_ID="crpvv13u8vr3qjftdvvg"
APPLY=0

if [[ "${1:-}" == "--apply" ]]; then
  APPLY=1
fi

configure_policy() {
  local repository="$1"
  local policy="$2"
  local rules="$3"
  local existing
  local policy_id

  existing="$(yc container repository lifecycle-policy list \
    --repository-name "$REGISTRY_ID/$repository" \
    --format json)"

  policy_id="$(printf '%s' "$existing" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s)[0]?.id||''))")"

  if [[ -z "$policy_id" ]]; then
    yc container repository lifecycle-policy create "$policy" \
      --repository-name "$REGISTRY_ID/$repository" \
      --rules "$rules"

    policy_id="$(yc container repository lifecycle-policy list \
      --repository-name "$REGISTRY_ID/$repository" \
      --format json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s)[0]?.id||''))")"
  fi

  if [[ "$APPLY" == "1" ]]; then
    yc container repository lifecycle-policy update "$policy_id" --active
    echo "Activated lifecycle policy for $repository."
  else
    yc container repository lifecycle-policy dry-run "$policy_id"
    echo "Created an inactive policy and started dry-run for $repository."
  fi
}

configure_policy \
  "apg-api" \
  "apg-api-retention" \
  "$ROOT_DIR/ops/registry-lifecycle/apg-api.json"

configure_policy \
  "apg-migration-operator" \
  "apg-migration-operator-retention" \
  "$ROOT_DIR/ops/registry-lifecycle/apg-migration-operator.json"

if [[ "$APPLY" != "1" ]]; then
  echo "Review dry-run results, then rerun with --apply to activate policies."
fi
