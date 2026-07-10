## 1. Container images

- [x] 1.1 `backend/Dockerfile` (Node 20, `prisma generate` + `nest build`) + `.dockerignore` + `docker-entrypoint.sh` (migrate deploy → seed → start)
- [x] 1.2 `frontend/Dockerfile` (Node 20 build with `VITE_API_URL` ARG → nginx static) + `nginx.conf` (SPA fallback) + `.dockerignore`

## 2. Compose + app config

- [x] 2.1 `docker-compose.prod.yml`: db (Postgres, volume), backend (127.0.0.1:3001, env_file backend/.env, DATABASE_URL→db, CORS_ORIGIN), frontend (127.0.0.1:8080, VITE_API_URL build arg)
- [x] 2.2 Env-driven CORS in `backend/src/main.ts` (`CORS_ORIGIN`, default `*`); add to `.env.example`
- [x] 2.3 Normalize S3 endpoint/publicUrl scheme in `s3.service.ts` so scheme-less config can't crash

## 3. Ops scripts

- [x] 3.1 `deploy/init.sh`: install nginx+certbot, `up -d db backend`, write api nginx block, certbot the api domain (backend HTTPS first), then build+`up -d frontend`, write frontend block, certbot the frontend domain
- [x] 3.2 `deploy/update.sh`: `git pull` → `compose build` → `up -d` → migrate → `nginx -t && reload`
- [x] 3.3 `deploy/README.md` documenting DNS/prereqs, domains, email, and both scripts; make scripts executable

## 4. Quality gates

- [x] 4.1 `bash -n` on both scripts; backend `build`/`lint` still green; frontend `build` green
- [ ] 4.2 Live build/deploy on the server (operator-run; Docker daemon needed) — build images, run init.sh, verify both domains serve over HTTPS
