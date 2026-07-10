# storage — KTP object storage (S3 / MinIO)

Stores member KTP images in an S3-compatible bucket. Works with AWS S3 or a local
**MinIO** (no AWS account needed). Boots even when unconfigured — uploads then return a
clear 503 and the KTP seed step skips.

## Local run (MinIO)

```bash
docker compose up -d minio         # MinIO API :9000, console :9001 (minioadmin/minioadmin)
npm run seed:ktp                   # generate + upload a dummy KTP per member, set members.ktp_url
```

`seed:ktp` is idempotent: it only uploads an object when it is missing (HeadObject → 404 →
PutObject), then points each member's `ktpUrl` at the real object URL.

## Endpoint

- `POST /api/kyc/upload-ktp` (multipart `file`) → `{ ktpUrl }`. Public (part of onboarding);
  the returned URL is passed to `POST /api/kyc/submit` as `ktpUrl`.

## Config (see `../../.env.example`)

| Var | Local MinIO | Real AWS |
|---|---|---|
| `S3_ENDPOINT` | `http://localhost:9000` | *(blank)* |
| `S3_FORCE_PATH_STYLE` | `true` | `false` |
| `S3_REGION` / `S3_BUCKET` | `us-east-1` / `rantai-renteng-ktp` | your values |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | `minioadmin` / `minioadmin` | your keys |
| `S3_PUBLIC_URL_BASE` | `http://localhost:9000/rantai-renteng-ktp` | *(blank → virtual-host URL)* |

## Dummy KTP

`ktp.ts::generateDummyKtp(nama, nik)` renders an SVG KTP card (name + NIK, coral header)
— a real, viewable image with no native image dependency. Object key is `ktp/<nik>.svg`.
Swap for a PNG generator (e.g. `sharp`) later if a raster is required.
