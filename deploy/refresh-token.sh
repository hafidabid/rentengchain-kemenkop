#!/usr/bin/env bash
#
# Mint a fresh Vertex AI access token into the file the backend reads live
# (bind-mounted into the container). Safe to run on a ~50-minute cron — it never
# restarts the backend; the container picks up the new token on its next call.
#
#   bash deploy/refresh-token.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOKEN_FILE="${GEMINI_TOKEN_FILE:-$ROOT/deploy/.gemini-token}"

# cron has a minimal PATH; find gcloud explicitly.
GCLOUD="$(command -v gcloud || true)"
[ -z "$GCLOUD" ] && [ -x "$HOME/google-cloud-sdk/bin/gcloud" ] && GCLOUD="$HOME/google-cloud-sdk/bin/gcloud"
if [ -z "$GCLOUD" ]; then
  echo "$(date -u +%FT%TZ) refresh-token: gcloud not found" >&2
  exit 1
fi

if "$GCLOUD" auth print-access-token >"$TOKEN_FILE.tmp" 2>/dev/null && [ -s "$TOKEN_FILE.tmp" ]; then
  mv "$TOKEN_FILE.tmp" "$TOKEN_FILE"
  chmod 600 "$TOKEN_FILE"
  echo "$(date -u +%FT%TZ) refresh-token: wrote $TOKEN_FILE"
else
  rm -f "$TOKEN_FILE.tmp"
  echo "$(date -u +%FT%TZ) refresh-token: gcloud could not mint a token (reauth needed?)" >&2
  exit 1
fi
