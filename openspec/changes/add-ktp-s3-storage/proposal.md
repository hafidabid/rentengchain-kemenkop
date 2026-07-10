## Why

Flow ① seeds members with fake `https://s3.amazonaws.com/...` KTP URLs that resolve to
nothing — there is no S3 service, no upload path, and no S3 config. A judge clicking a
member's KTP gets a broken link. This adds a real object-storage flow (AWS S3 or a local
MinIO) that generates a dummy KTP image, uploads it if absent, and serves a working URL —
replacing the placeholders. It keeps the demo honest without requiring real ID scans.

## What Changes

- Add an `S3Service` (`@aws-sdk/client-s3`) that targets AWS **or** any S3-compatible
  endpoint (MinIO/LocalStack) via env: bucket ensure, `objectExists` (HeadObject),
  `upload` (PutObject), and `ensureObject` (upload only if missing). Gracefully disabled
  when unconfigured (endpoint returns a clear 503; seed step logs + skips).
- Add a dummy-KTP image generator producing a per-member KTP card image with name/NIK.
- Add `POST /api/kyc/upload-ktp` (multipart) returning the stored object URL; `submit`
  keeps accepting a `ktpUrl`.
- Add a `seed:ktp` script that, for each seeded persona, ensure-uploads a dummy KTP and
  updates `members.ktp_url` to the real object URL.
- Add a MinIO service to `docker-compose.yml` and S3 env to `.env.example`.

## Capabilities

### New Capabilities

- `ktp-storage`: object storage for member KTP images — dummy-image generation, idempotent
  ensure-upload, an upload endpoint, and public URL derivation, backed by AWS S3 or MinIO.

### Modified Capabilities

<!-- kyc-onboarding gains a real KTP URL source; no requirement change to its existing scenarios -->

## Impact

- New backend module `storage/` (S3Service + dummy-KTP generator); `KycModule` gains the
  upload route.
- New dependency: `@aws-sdk/client-s3` (+ `@types/multer`).
- New env: `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`,
  `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`, `S3_PUBLIC_URL_BASE`.
- `docker-compose.yml` gains a MinIO service; the user runs it (as with Postgres).
- Live upload needs a running S3/MinIO or AWS creds; without them the flow degrades cleanly.
