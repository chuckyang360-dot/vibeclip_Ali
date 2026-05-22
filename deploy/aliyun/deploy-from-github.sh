#!/usr/bin/env bash
set -Eeuo pipefail

# Runs on the Aliyun ECS host. GitHub Actions connects over SSH and executes this
# script after a push to the configured branch.

APP_DIR="${APP_DIR:-/opt/vibeclip_ali}"
REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-main}"
COMPOSE_DIR="${APP_DIR}/deploy/aliyun"
ENV_FILE="${COMPOSE_DIR}/.env"

log() {
  printf '[deploy-vibeclip-ali] %s\n' "$*"
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "missing required command: $1"
    exit 1
  fi
}

env_value() {
  local key="$1"
  if [ ! -f "$ENV_FILE" ]; then
    return 0
  fi
  awk -F= -v k="$key" '$1 == k { sub(/^[^=]*=/, ""); print }' "$ENV_FILE" | tail -n 1
}

need_cmd git
need_cmd npm
need_cmd docker

if [ ! -d "$APP_DIR/.git" ]; then
  log "APP_DIR is not a git repository: $APP_DIR"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  log "missing deploy env file: $ENV_FILE"
  log "create it from deploy/aliyun/.env.example and fill production secrets on ECS"
  exit 1
fi

log "syncing ${REMOTE}/${BRANCH} in ${APP_DIR}"
cd "$APP_DIR"
git fetch "$REMOTE" "$BRANCH"
git reset --hard "${REMOTE}/${BRANCH}"

frontend_api_base="${VITE_API_BASE_URL:-}"
if [ -z "$frontend_api_base" ]; then
  frontend_api_base="$(env_value API_BASE_URL)"
fi
if [ -z "$frontend_api_base" ]; then
  frontend_api_base="https://api.vibeclip.cn"
fi

log "building frontend with VITE_API_BASE_URL=${frontend_api_base}"
cd "$APP_DIR/frontend"
npm ci
VITE_API_BASE_URL="$frontend_api_base" npm run build

log "rebuilding and restarting docker compose services"
cd "$COMPOSE_DIR"
docker compose up -d --build
docker compose ps

log "deployment finished"
