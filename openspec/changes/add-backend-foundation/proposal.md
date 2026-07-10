## Why

RantaiRenteng today is a static React mockup (`brainstorm/gstudio`) with no backend. Every
demo-critical flow (onboarding, AI screening, renteng bailout, savings audit trail) needs a
persistent, authenticated backend to be believable on stage. This change lays the shared
foundation the four flows build on: a NestJS + PostgreSQL + Prisma service, the canonical data
model from the ERD, seeded demo personas, JWT auth with an Anggota/Pengurus role, and the
snake_case↔camelCase mapping the mockup expects. It also introduces the admin actor
(Pengurus) that the mockup data model is missing.

## What Changes

- Scaffold a NestJS backend (`/backend`) with config, health check, and a global camelCase
  serialization layer over a snake_case PostgreSQL schema.
- Model the ERD in Prisma: `members`, `groups`, `member_groups` bridge, `loans`,
  `saving_transactions`, `audit_logs` (loans/savings tables created here; their behavior is
  specified by later flow changes).
- Seed the four demo personas (Sri, Deni, Ani, Ira) and the "Mekar Wangi Srikandi" group so
  every flow starts from a realistic state.
- Add JWT authentication with a role flag (`Anggota` | `Pengurus`) and route guards. `peran`
  (`penabung|peminjam|keduanya`) stays a business attribute, not an auth role. Passwords are
  hashed (bcrypt/Argon2), never plaintext.
- Expose member-registry read/list, group read, and an append-only audit-log capability that
  the other flows write to.
- Reconciliations from `claude0.md`: drop `tx_link` (derive from `tx_hash`), resolve
  `Group.anggotaIds[]` via the `member_groups` bridge, add an env-encryptable private-key
  column placeholder on members.

## Capabilities

### New Capabilities

- `authentication`: seeded-account login issuing a JWT that carries an `Anggota`/`Pengurus`
  role; guards that gate Pengurus-only endpoints.
- `member-registry`: the canonical member record (profile, savings balances, KYC status field,
  wallet-address field) with camelCase-mapped read/list endpoints.
- `group-management`: koperasi groups, the `member_groups` bridge, `kas_sosial`, and invite
  codes, exposed as read endpoints with membership resolved via the bridge.
- `audit-log`: an append-only transparent audit trail (aktor/aksi/detail/timestamp) that every
  flow writes to and both surfaces can read.

### Modified Capabilities

<!-- none — this is the foundation change -->

## Impact

- New `/backend` NestJS project; `docker-compose` for Postgres (user runs containers).
- New dependencies: `@nestjs/*`, `prisma`/`@prisma/client`, `passport-jwt`, `bcrypt`,
  `class-transformer`.
- Prisma schema + migration + seed script become the DB source of truth; the old raw SQL in
  `CLAUDE_PLAN.md` is a reference only.
- Blocks: `add-web3-relayer`, and every flow change depends transitively on this.
