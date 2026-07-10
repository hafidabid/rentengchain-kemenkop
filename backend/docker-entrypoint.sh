#!/bin/sh
# Backend container entrypoint: apply migrations, seed idempotently, then serve.
set -e

echo "[entrypoint] Applying database migrations..."
./node_modules/.bin/prisma migrate deploy

echo "[entrypoint] Seeding demo data (idempotent)..."
npm run prisma:seed || echo "[entrypoint] seed step reported an issue; continuing."

echo "[entrypoint] Starting backend on port ${PORT:-3001}..."
exec node dist/main.js
