#!/usr/bin/env bash
#
# Redeploy RantaiRenteng after pushing new code to GitHub.
#   pull -> rebuild images -> recreate containers -> (entrypoint runs migrations) -> reload nginx
#
# Run on the server:
#   bash deploy/update.sh
#
set -euo pipefail

API_DOMAIN="${API_DOMAIN:-renteng-chain-api.talentor.tech}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT/docker-compose.prod.yml"
COMPOSE="docker compose -f $COMPOSE_FILE"
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

cd "$ROOT"

log "Pulling latest code"
git pull --ff-only

log "Rebuilding images"
# Frontend must be rebuilt against the HTTPS API domain (Vite inlines it at build).
VITE_API_URL="https://$API_DOMAIN" $COMPOSE build

log "Recreating containers"
VITE_DEMO_GROUP_ID=e5f6a7b8-9c0d-41e2-8a4b-5c6d7e8f9a0b
VITE_API_URL="https://$API_DOMAIN" $COMPOSE up -d

log "Waiting for backend health"
for i in $(seq 1 40); do
  curl -fsS http://127.0.0.1:3001/health >/dev/null 2>&1 && { echo "backend healthy"; break; }
  [ "$i" -eq 40 ] && { echo "WARN: backend health check timed out; see '$COMPOSE logs backend'"; break; }
  sleep 3
done

log "Reloading nginx"
$SUDO nginx -t && $SUDO systemctl reload nginx || echo "nginx reload skipped"

log "Pruning dangling images"
docker image prune -f >/dev/null 2>&1 || true

log "Update complete."
