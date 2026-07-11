# Deployment

Runs RantaiRenteng behind nginx with automatic HTTPS on two domains:

| Domain | Serves | Container (localhost) |
|---|---|---|
| `renteng-chain-api.talentor.tech` | backend API | `127.0.0.1:3001` |
| `renteng-chain.talentor.tech` | frontend SPA | `127.0.0.1:8080` |

Stack: `docker-compose.prod.yml` (Postgres + backend + built frontend). Host nginx
terminates TLS (certbot) and reverse-proxies to the containers.

## Prerequisites (on the server)

1. **DNS**: A-records for both subdomains → this server's public IP.
2. **`backend/.env`** present (it is git-ignored — copy it up manually). Must contain the
   real `JWT_SECRET`, `RELAYER_PRIVATE_KEY`, `ADMIN_PRIVATE_KEY`, `BASE_RPC_URL`, `S3_*`, etc.
   `DATABASE_URL`, `PORT`, `CORS_ORIGIN` are overridden by compose — no need to edit them.
3. Debian/Ubuntu with `sudo`. Docker is installed by `init.sh` if missing.

Optional compose overrides (env or a root `.env` next to the compose file): `DB_USER`,
`DB_PASSWORD`, `DB_NAME`, `CORS_ORIGIN`, `VITE_API_URL`, `VITE_DEMO_GROUP_ID`.

## First-time init

```bash
sudo bash deploy/init.sh
```

Order (matches "backend first, then frontend"):
1. install nginx + certbot (and Docker if absent)
2. build + start Postgres + backend
3. nginx proxy for the **API** domain → **certbot issues its cert** (API is now HTTPS)
4. build + start the frontend with `VITE_API_URL=https://renteng-chain-api.talentor.tech`
5. nginx proxy for the **frontend** domain → certbot issues its cert

Then (optional) seed KTP images to S3: `docker compose -f docker-compose.prod.yml exec backend npm run seed:ktp`.

## Update / redeploy (after `git push`)

```bash
bash deploy/update.sh
```

Pulls, rebuilds images, recreates containers (backend entrypoint runs `prisma migrate
deploy` + idempotent seed on start), and reloads nginx. Certificates are left untouched
(certbot's systemd timer auto-renews them).

## Notes

- **Gemini (Vertex AI, no API key)**: `init.sh`/`update.sh` mint a token via
  `gcloud auth print-access-token` and inject it as `GOOGLE_ACCESS_TOKEN` into the backend
  (project `PROJECT_ID`, region `REGION`, default `global`/`gemini-2.5-flash`). The token
  lasts ~1h — re-run `update.sh` to refresh, or use a **service account**
  (`GOOGLE_APPLICATION_CREDENTIALS`) for a long-lived server. Degrades gracefully without one.
- **CORS**: backend defaults to `CORS_ORIGIN=*` (allow all). Restrict by setting
  `CORS_ORIGIN=https://renteng-chain.talentor.tech` in `backend/.env` and re-running update.
- **KTP uploads** through nginx are capped at 12 MB (`client_max_body_size`).
- **Logs**: `docker compose -f docker-compose.prod.yml logs -f backend`.
- Containers bind to `127.0.0.1` only; the public surface is nginx (80/443).
