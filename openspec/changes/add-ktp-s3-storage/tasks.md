## 1. Storage service

- [x] 1.1 Add `@aws-sdk/client-s3` (+ `@types/multer`); create `StorageModule` + `S3Service` reading S3_* env, supporting AWS and MinIO (endpoint + forcePathStyle)
- [x] 1.2 `S3Service`: `enabled`, `ensureBucket()`, `objectExists(key)`, `upload(key,body,contentType)`, `ensureObject(key,factory,contentType)`, `publicUrl(key)`; disabled mode returns clear errors, never crashes boot
- [x] 1.3 Dummy-KTP generator `generateDummyKtp(nama,nik)` → { body, contentType, key } producing a KTP-card image with name/NIK

## 2. Upload endpoint + seed

- [x] 2.1 `POST /api/kyc/upload-ktp` (multipart `file`) → uploads to S3, returns `{ ktpUrl }`; wire `StorageModule` into `KycModule`
- [x] 2.2 `scripts/seed-ktp.ts` (`npm run seed:ktp`): for each seeded member, ensure-upload a dummy KTP and set `members.ktp_url` to the real object URL
- [x] 2.3 Replace fake `s3.amazonaws.com` URLs in `prisma/seed.ts` with a neutral placeholder (real URLs come from `seed:ktp`)

## 3. Infra + config

- [x] 3.1 Add MinIO service to `docker-compose.yml` (+ auto-create bucket) and S3_* entries to `.env.example`/`.env`
- [x] 3.2 Document run steps in `backend/src/storage/README.md`

## 4. Quality gates

- [x] 4.1 Unit tests: `ensureObject` uploads only when missing (HeadObject 404 → PutObject; exists → skip); generator returns a valid non-empty image body + content type; disabled S3 degrades gracefully
- [x] 4.2 `npm run build` and `npm run lint` pass
- [ ] 4.3 Live upload smoke against MinIO/AWS when available (user-run): `seed:ktp` populates the bucket and member URLs resolve
