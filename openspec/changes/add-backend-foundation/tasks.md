## 1. Project scaffold

- [x] 1.1 Create `/backend` NestJS project (TypeScript, ESLint, Jest) with `ConfigModule` reading `.env`
- [x] 1.2 Add `docker-compose.yml` with a PostgreSQL 16 service + `.env.example` (DB URL, JWT secret, explorer base URL, coop hash salt placeholder)
- [x] 1.3 Add a `GET /health` endpoint returning `{ status: 'ok' }`
- [x] 1.4 Configure a global response layer mapping any residual snake_case → camelCase and a `ValidationPipe`

## 2. Data model (Prisma)

- [x] 2.1 Define Prisma schema for `members`, `groups`, `member_groups`, `loans`, `saving_transactions`, `audit_logs` with snake_case `@map`/`@@map` and UUID PKs
- [x] 2.2 Add auth fields to `members`: `role` (`Anggota`|`Pengurus`), `password_hash`, and `encrypted_privkey` (nullable, for later web3 change)
- [x] 2.3 Run `prisma migrate dev` to create the initial migration; verify it applies cleanly
- [x] 2.4 Write an idempotent `prisma db seed` script seeding Sri, Deni, Ani, Ira, the Mekar Wangi Srikandi group, member_groups bridge rows, and their seeded loans/savings/audit rows from `CLAUDE_PLAN.md`
- [x] 2.5 Seed at least one `Pengurus` account with a hashed password

## 3. Authentication capability

- [x] 3.1 Implement `POST /api/auth/login` (email/identifier + password) returning a JWT with `sub`, `role`
- [x] 3.2 Hash seeded passwords with bcrypt; verify on login
- [x] 3.3 Add `JwtAuthGuard` and a `RolesGuard` + `@Roles('Pengurus')` decorator
- [x] 3.4 Add `GET /api/auth/me` returning the authenticated member's camelCase profile + role

## 4. Member-registry capability

- [x] 4.1 `GET /api/members` (Pengurus) and `GET /api/members/:id` returning camelCase members incl. `walletAddress`, KYC status, savings balances
- [x] 4.2 Ensure `encrypted_privkey` and `password_hash` are never serialized in any response
- [x] 4.3 Anggota `GET /api/members/me` scoped to the caller

## 5. Group-management capability

- [x] 5.1 `GET /api/groups/:id` returning camelCase group with `anggotaIds[]` assembled from the `member_groups` bridge and `kasSosial`, `kodeUndangan`
- [x] 5.2 `GET /api/groups` list for Pengurus

## 6. Audit-log capability

- [x] 6.1 Implement an `AuditLogService.append(aktor, aksi, detail)` used by all modules
- [x] 6.2 `GET /api/audit-logs` (paginated, newest first) readable by both surfaces; derive `txLink` from `txHash` where present

## 7. Quality gates

- [x] 7.1 `npm run build` and `npm run lint` pass
- [x] 7.2 Unit test: login issues a valid role-bearing JWT; RolesGuard blocks Anggota from a Pengurus route
- [x] 7.3 Integration smoke: boot against seeded DB, log in as Pengurus, list members, read the group with resolved `anggotaIds`
- [x] 7.4 Update `/backend/AGENTS.md` (or README) with run/seed/test commands so later changes don't re-read all code
