## Context

The mockup uses camelCase TypeScript interfaces (`brainstorm/gstudio/src/types.ts`) while the
ERD (`CLAUDE_PLAN.md`) is snake_case PostgreSQL. `claude0.md` resolves the conflict: the DB
stays snake_case and a mapping layer serves camelCase to the frontend. There is no backend yet,
so this change is greenfield. The deployed contracts and Gemini/S3 integrations are handled by
later changes; foundation must not block on them.

## Goals / Non-Goals

**Goals:**
- One canonical, migrated, seeded PostgreSQL schema that matches the ERD.
- A backend that boots, authenticates seeded users, and serves member/group/audit reads in the
  camelCase shape the mockup already consumes.
- Introduce the Pengurus actor as a real authenticated role.

**Non-Goals:**
- No wallet generation, no on-chain calls, no Gemini, no S3 (later changes).
- No loan/savings *behavior* — those tables exist but their endpoints/state machines belong to
  the flow changes.
- No hardened security (rate limiting, KMS). Passwords are hashed; that is the only hardening.

## Decisions

- **ORM: Prisma** (per `claude0.md` §8 decision). snake_case columns via `@map`/`@@map`;
  Prisma models are camelCase, giving the mapping layer for free. A thin response
  interceptor/DTO handles any remaining shape differences (e.g. nested `anggotaIds`).
- **Auth: JWT + role flag.** A new `role` column on members (`Anggota`|`Pengurus`) plus a
  `password_hash` column. Pengurus accounts are seeded. `peran` is untouched business data.
- **`anggotaIds[]`** is not a column: the member-groups bridge is queried and the array is
  assembled in the group read DTO.
- **`tx_link` dropped**: responses derive the explorer URL from `tx_hash` + a configured Base
  Sepolia explorer base (`https://sepolia.basescan.org/tx/`).
- **Private key column**: `encrypted_privkey` (nullable) added to members now so
  `add-web3-relayer` needs no schema change; foundation leaves it null.
- **Seed = idempotent script** (`prisma db seed`) mirroring the four personas and their loans/
  savings rows from `CLAUDE_PLAN.md` seed SQL, so later flows have live state to act on.

## Risks / Trade-offs

- Seeding loans/savings rows here (before their flow changes) risks drift if a flow renames a
  field. Mitigation: the Prisma schema is the single source; flow changes extend, not redefine.
- bcrypt vs Argon2: bcrypt chosen for zero native-build friction in Docker; adequate for a demo.
- Prisma migrations vs `db push`: use `migrate dev` so the schema history is reviewable, but the
  demo can fall back to `db push` + seed if migrations get noisy under time pressure.
