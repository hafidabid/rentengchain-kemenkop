## Why

The demo runs only locally. To show it live it must be deployed behind real domains with
HTTPS: `renteng-chain-api.talentor.tech` (backend) and `renteng-chain.talentor.tech`
(frontend). This adds container images for both apps, a production compose (backend +
Postgres + built frontend), and two operator scripts: a first-time init that stands the
stack up behind nginx with automatic certbot SSL, and an update script that pulls and
rebuilds on each release.

## What Changes

- **Dockerize** the backend (NestJS multi-stage → runs `prisma migrate deploy` + idempotent
  seed on start) and the frontend (Node 20 build → static files served by nginx, with
  `VITE_API_URL` baked at build time).
- **`docker-compose.prod.yml`**: `db` (Postgres), `backend` (published on `127.0.0.1:3001`),
  `frontend` (published on `127.0.0.1:8080`).
- **`deploy/init.sh`** (first time): installs nginx + certbot, brings up **backend first**,
  provisions its HTTPS cert, then builds/starts the frontend pointed at the now-HTTPS API and
  provisions the frontend cert.
- **`deploy/update.sh`**: `git pull` → rebuild → recreate containers → migrate → reload nginx.
- **CORS**: read `CORS_ORIGIN` (default `*` — allow all) so the browser frontend on a
  different origin can call the API.
- Harden S3 endpoint parsing (normalize a missing URL scheme) so custom S3/CDN config can't
  crash the container.

## Capabilities

### New Capabilities

- `deployment`: reproducible container build + a two-domain nginx/HTTPS deployment with an
  idempotent first-time init and a pull-and-rebuild update path.

## Impact

- New: `backend/Dockerfile` (+ entrypoint, `.dockerignore`), `frontend/Dockerfile` (+
  `nginx.conf`, `.dockerignore`), `docker-compose.prod.yml`, `deploy/` (scripts + README +
  nginx server-block templates).
- Modified: `backend/src/main.ts` (env-driven CORS), `backend/src/storage/s3.service.ts`
  (scheme normalization), `.env.example` (`CORS_ORIGIN`).
- Server prerequisites: DNS A-records for both subdomains → server IP; Docker installed;
  `backend/.env` present on the server (git-ignored secrets: relayer/admin keys, S3, JWT).
