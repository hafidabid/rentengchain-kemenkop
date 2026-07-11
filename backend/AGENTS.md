# Backend — Agent Notes

NestJS + Prisma (PostgreSQL) service for RantaiRenteng. Implements the
`add-backend-foundation` OpenSpec change: authentication, member-registry,
group-management, audit-log. Later changes add web3, savings, AI/EWS, renteng.

## Run

```bash
# 1. Postgres (you run the container; see docker-compose.yml, exposes :5433)
docker compose up -d

# 2. Install + generate client
npm install
npm run prisma:generate

# 3. Migrate + seed the demo personas
npm run prisma:migrate       # dev: creates/apply migrations
# or, against an existing DB:  npx prisma migrate deploy
npm run prisma:seed          # Sri, Deni, Ani, Ira + Pengurus + group/loans/savings/audits

# 4. Start (defaults to :3001, global prefix /api, /health is unprefixed)
npm run start:dev
```

`DATABASE_URL` (see `.env.example`) drives everything. `.env` is git-ignored.

## Test / build / lint (quality gates)

```bash
npm run build        # nest build (tsc)
npm run lint         # eslint
npm test             # unit tests (mock Prisma, no DB needed)
npm run test:e2e     # integration; needs a migrated+seeded DB via DATABASE_URL
```

## Conventions (reuse these — do not reinvent)

- **DB is snake_case, API is camelCase.** Prisma models are camelCase with
  `@map`/`@@map`; that gives the mockup's camelCase shape for free.
- **Serialization lives in `src/common/serializers.ts`**: `toMemberDto`,
  `toGroupDto(group, anggotaIds)`, `toAuditLogDto(log, explorerBaseUrl)`. These
  strip secrets (`passwordHash`, `encryptedPrivkey` — never serialize them),
  convert Decimal→number, and derive `txLink` from `txHash`. Always map through them.
- **Auth**: JWT payload `{ sub, role }`. Guards/decorators in `src/auth/`:
  `JwtAuthGuard`, `RolesGuard`, `@Roles(Role.Pengurus)`, `@CurrentUser()`
  (→ `{ userId, role }`). `role` (Anggota|Pengurus) is the auth role; `peran`
  (penabung|peminjam|keduanya) is business data, never used for authz.
- **Audit trail**: inject `AuditLogService` (exported by `AuditModule`) and call
  `append(aktor, aksi, detail, txHash?)` from any state-changing flow.
- **Seed ids are fixed** (see `prisma/seed.ts`) so later flows can reference them.

## Module map

| Path | Capability | Key routes |
|---|---|---|
| `src/auth` | authentication | `POST /api/auth/login`, `GET /api/auth/me` |
| `src/members` | member-registry | `GET /api/members`, `/members/me`, `/members/:id` |
| `src/groups` | group-management | `GET /api/groups`, `/groups/:id` |
| `src/audit` | audit-log | `GET /api/audit-logs` |
| `src/kyc` | Flow ① onboarding + KTP upload + temp-password | `POST /api/kyc/{submit,approve/:id,reject/:id,upload-ktp,:id/reset-password}` |
| `src/loans` | Flow ② lending + AI EWS + appeals + decision notes | `POST /api/loans/{apply,sanggah/:id,approve/:id,reject/:id}`, `GET /api/loans[/:id[/decisions]]` |
| `src/savings` | Flow ④ savings | `POST /api/savings`, `GET /api/savings` |
| `src/renteng` | Flow ③ bailout + renteng_events | `POST /api/renteng/:loanId/{bailout,repay-talangan}` |
| `src/members` | member-registry + detail | `GET /api/members[/:id[/detail]]`, `/members/me` |
| `src/assistant` | Gemini koperasi chatbot (Pengurus) | `POST /api/assistant/chat`, `GET /api/assistant/snapshot` |
| `src/reports` | e-RAT aggregates + XLSX (Pengurus) | `GET /api/reports/e-rat[/export.xlsx]` |
| `src/storage` | S3/MinIO KTP object storage | — |
| `src/web3` | viem relayer + custodial wallets | — |
| `src/cache` | Redis-optional cache (assistant snapshot) | — |
| `src/prisma` | Prisma client (global) | — |
| `src/common` | serializers/DTOs | — |

**Optional infra**: `GEMINI_API_KEY` (assistant/EWS — degrades to fallback when unset),
`REDIS_URL` (assistant snapshot cache — in-memory fallback), `S3_*` (KTP — 503 when unset).
All are graceful; the app boots without them.
