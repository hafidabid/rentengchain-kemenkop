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

# --- Gemini via Vertex AI: mint a fresh access token for the backend container ---
# (No API key. The token lasts ~1h — re-run this script to refresh it, or use a
#  service account via GOOGLE_APPLICATION_CREDENTIALS for a long-lived server.)
export PROJECT_ID="${PROJECT_ID:-kemenkop-hackathon-2026-1a00}"
export REGION="${REGION:-global}"
if command -v gcloud >/dev/null 2>&1; then
  export GOOGLE_ACCESS_TOKEN="$(gcloud auth print-access-token 2>/dev/null || true)"
  if [ -n "${GOOGLE_ACCESS_TOKEN:-}" ]; then
    log "Minted Gemini/Vertex access token (project $PROJECT_ID, region $REGION)"
  else
    log "WARN: gcloud could not mint a token — assistant/EWS will degrade until GOOGLE_ACCESS_TOKEN is set"
  fi
else
  log "WARN: gcloud not found — set GOOGLE_ACCESS_TOKEN (or a service account) for Vertex"
fi

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
