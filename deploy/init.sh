#!/usr/bin/env bash
#
# First-time deploy for RantaiRenteng.
#   - installs nginx + certbot (Debian/Ubuntu)
#   - brings up Postgres + backend, provisions the API domain's HTTPS cert FIRST
#   - then builds/starts the frontend (pointed at the now-HTTPS API) and provisions
#     the frontend domain's cert
#
# Run on the server (DNS for both subdomains must already point here):
#   sudo bash deploy/init.sh
#
set -euo pipefail

# ---- Config (override via env) ----------------------------------------------
API_DOMAIN="${API_DOMAIN:-renteng-chain-api.talentor.tech}"
APP_DOMAIN="${APP_DOMAIN:-renteng-chain.talentor.tech}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-rentengchain@gmail.com}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT/docker-compose.prod.yml"
COMPOSE="docker compose -f $COMPOSE_FILE"

SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

# ---- Preflight --------------------------------------------------------------
log "Preflight checks"
[ -f "$ROOT/backend/.env" ] || die "backend/.env is missing. Create it on the server (JWT, RELAYER/ADMIN keys, S3, etc.) before running init."

if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker"
  curl -fsSL https://get.docker.com | $SUDO sh
fi
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 plugin not found. Install 'docker-compose-plugin'."

if command -v apt-get >/dev/null 2>&1; then
  log "Installing nginx + certbot"
  $SUDO apt-get update -y
  $SUDO apt-get install -y nginx certbot python3-certbot-nginx curl
else
  command -v nginx >/dev/null 2>&1 || die "nginx not found and apt-get unavailable — install nginx + certbot manually."
fi
$SUDO systemctl enable --now nginx >/dev/null 2>&1 || true

write_proxy_block() { # $1 domain  $2 upstream_port
  local domain="$1" port="$2"
  $SUDO tee "/etc/nginx/conf.d/${domain}.conf" >/dev/null <<NGINX
server {
    listen 80;
    server_name ${domain};
    client_max_body_size 12M;
    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX
}

issue_cert() { # $1 domain
  log "Requesting HTTPS certificate for $1"
  $SUDO certbot --nginx -d "$1" --non-interactive --agree-tos -m "$CERTBOT_EMAIL" --redirect
}

# ---- 1) Backend first -------------------------------------------------------
# Gemini via Vertex: mint a fresh access token for the backend container (no API key).
export PROJECT_ID="${PROJECT_ID:-kemenkop-hackathon-2026-1a00}"
export REGION="${REGION:-global}"
if command -v gcloud >/dev/null 2>&1; then
  export GOOGLE_ACCESS_TOKEN="$(gcloud auth print-access-token 2>/dev/null || true)"
  [ -n "${GOOGLE_ACCESS_TOKEN:-}" ] && log "Minted Gemini/Vertex access token ($PROJECT_ID)" \
    || log "WARN: gcloud could not mint a token — assistant/EWS will degrade until GOOGLE_ACCESS_TOKEN is set"
else
  log "WARN: gcloud not found — set GOOGLE_ACCESS_TOKEN (or a service account) for Vertex"
fi

log "Building + starting database and backend"
$COMPOSE up -d --build db backend

log "Waiting for backend health"
for i in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:3001/health >/dev/null 2>&1; then echo "backend healthy"; break; fi
  [ "$i" -eq 40 ] && die "backend did not become healthy — check: $COMPOSE logs backend"
  sleep 3
done

log "Configuring nginx for $API_DOMAIN and issuing its cert"
write_proxy_block "$API_DOMAIN" 3001
$SUDO nginx -t && $SUDO systemctl reload nginx
issue_cert "$API_DOMAIN"

# ---- 2) Frontend (built against the now-HTTPS API) --------------------------
log "Building + starting frontend (VITE_API_URL=https://$API_DOMAIN)"
VITE_DEMO_GROUP_ID=e5f6a7b8-9c0d-41e2-8a4b-5c6d7e8f9a0b
VITE_API_URL="https://$API_DOMAIN" $COMPOSE up -d --build frontend

log "Configuring nginx for $APP_DOMAIN and issuing its cert"
write_proxy_block "$APP_DOMAIN" 8080
$SUDO nginx -t && $SUDO systemctl reload nginx
issue_cert "$APP_DOMAIN"

log "Done."
echo "  Backend : https://$API_DOMAIN/health"
echo "  Frontend: https://$APP_DOMAIN"
echo "  Next (optional): seed KTP images -> $COMPOSE exec backend npm run seed:ktp"
