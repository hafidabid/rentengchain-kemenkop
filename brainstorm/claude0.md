# RantaiRenteng — Demo Requirements

**Date:** 2026-07-10
**Status:** Requirements (post-brainstorm). Feeds `/ce-plan`.
**Target:** Hackathon demo — a convincing end-to-end happy-path demo. Speed over hardening.

This document replaces the earlier build-prompt version of `claude0.md`. It answers
**WHAT** to build and **what "done" means for the demo**, not the low-level HOW.
The fuller technical draft (ERD, DDL, seed SQL, contract ABI) still lives in
`brainstorm/gstudio/CLAUDE_PLAN.md` and is the implementation reference — but where
the two disagree, **this document wins**.

---

## 1. Product in one line

A digital _tanggung renteng_ (social-collateral) microfinance app for a koperasi,
where every approved member gets a custodial on-chain identity, savings and
disbursements leave a real testnet audit trail, and an AI Early-Warning System
scores loan risk — with a member's right to appeal (`sanggah`).

Two surfaces:

- **Anggota (Member)** — mobile-first, route `/`.
- **Pengurus (Admin)** — desktop dashboard, route `/laman-pengurus`.

---

## 2. Actors

- **Anggota** — koperasi member. Submits KYC, saves, applies for loans, appeals AI flags.
- **Pengurus** — koperasi admin/board. Approves KYC, reviews loans + appeals, triggers
  bailouts, views reports.
- **Master/Relayer account** — a single backend-held testnet account that holds funds
  and executes every on-chain transaction on members' behalf (zero user gas).

> **Gap being closed:** the current mockup data model has **no admin actor** — `peran`
> is business-only (`penabung|peminjam|keduanya`). We add Pengurus as a real,
> authenticated role (see §5).

---

## 3. Demo-critical flows (all built deep, happy-path only)

All four are must-win on stage. "Built deep" = the one live action works end-to-end
against Postgres + testnet; surrounding state is seeded; edge cases stay shallow.

### Flow ① Onboarding + wallet mint

New member (**Ira**, seeded as `Requested`) submits KYC → Pengurus approves →
backend auto-generates a **real testnet wallet** (viem) and shows the address.

- **Success:** a KYC `Approved` action results in a persisted wallet address visible
  on both surfaces. Wallet is real (checksummed, on the chosen testnet).

### Flow ② AI risk flag + appeal (`sanggah`)

Loan application runs the Gemini EWS → **Ani** gets `MERAH` with reasons →
she files a `sanggah` → Pengurus sees the appeal alongside the AI reasons and
makes a final decision (approve / reject / hold).

- **Success:** a loan carries a real `skor_ai` + `flag_ai` + `flag_alasan`; the appeal
  is recorded and surfaces in the Pengurus review; Pengurus's decision persists.
- **Live-AI safety:** real `@google/genai` call, but **Ani has a seeded fallback
  result** so a flaky network can't break the demo.

### Flow ③ Tanggung renteng bailout

**Deni** misses a payment → group `kas_sosial` covers it (`DITALANGI`) and/or the
escrow contract freezes the group on-chain.

- **Success:** the missed payment transitions Deni's loan to `DITALANGI`, decrements
  `kas_sosial`, writes an audit log, and (if wired) reflects the freeze/disburse state
  from the `foundry/` escrow contract.

### Flow ④ Savings + on-chain audit trail

Member pays a simpanan (QRIS-style, **simulated** confirmation) → a **real testnet
transaction** is recorded → a clickable `tx_link` appears in the audit-log/ledger view.

- **Success:** a savings action produces a real on-chain tx whose explorer link a judge
  can click; balances update; the audit log shows the entry.

---

## 4. Web3 model (resolved)

- **Real testnet** (e.g. Base Sepolia — confirm chain in planning).
- **One custodial wallet per member** = their on-chain identity. Generated on KYC approval.
- **Master/relayer account** holds balance and signs/sends all transactions; members
  never hold gas or keys.
- **Escrow contract is in scope** — the existing `foundry/` project is used, not deferred.
  (The old "smart contract = next phase" line is deleted.)
- **Private keys are stored** for forensic investigation. Accepted for this phase.
  Mitigation cost is ~zero: keep the key in an **env-configurable / encryptable column**
  so it can be wrapped later without a schema change. No further security work this phase.

---

## 5. Decisions carried into planning

- **Auth/roles:** seeded accounts + JWT + a role flag (`Anggota` vs `Pengurus`). `peran`
  stays a business attribute, not an auth role.
- **Gemini:** current `@google/genai` model IDs (not the stale "1.5 / 2.0 Flash / Pro"
  names in the old draft). Structured JSON output: `skor_ai` (0-100),
  `flag_ai` (`HIJAU|KUNING|MERAH`), `flag_alasan` (string[]). Seeded fallback for Ani.
- **QRIS:** simulated confirmation (button → mark `PAID` → fire on-chain tx). No real
  payment gateway.
- **Schema is reconciled to one canonical source:**
  - DB stays **snake_case**; a mapping layer serves the mockup's camelCase
    (`no_hp` ↔ `noHp`, etc.).
  - `Group.anggotaIds[]` (mockup) resolves via the **`member_groups` bridge** — not a
    column.
  - **Drop `tx_link`** — derive it from `tx_hash` + the explorer base URL.
  - Private-key column present but env-encryptable (see §4).
  - `password` column is **hashed** (Argon2/bcrypt), never plaintext — cheap and avoids
    an embarrassing look.
- **Redis:** dropped unless a flow needs it. Nothing currently does.
- **Stack (unchanged):** React (Vite, TS, Tailwind) frontend from the `gstudio` mockup;
  NestJS + PostgreSQL + `viem` + `@google/genai` + S3 (KTP upload) backend; TypeORM or
  Prisma. Warm Coral aesthetic: `#F06A6A` / `#FAF9F8` / `#1E1F21`.
- **Seed personas (the demo narrative):** Sri (healthy/`Lancar`, `HIJAU`),
  Deni (bailed-out/`Ditalangi`, `KUNING`), Ani (red-flag/`MERAH` + `sanggah`),
  Ira (KYC `Requested`, for Flow ①).

---

## 6. Explicitly out of scope this phase

- Indonesia PDP-law compliance, PII encryption-at-rest, KYC data retention policy.
- Social-media-sentiment as a scoring input (no data source; ethically fraught).
- Payment reconciliation / double-bookkeeping between chain and Postgres.
- Interest/margin (`jasa`) math — use the flat seeded `cicilan_bulanan`.
- Deep e-RAT / neraca reporting — seeded/read-only view is enough.
- Full collection-ladder ("tangga penagihan") automation beyond Flow ③.
- Hardened key custody (KMS/HSM), rate limiting, exhaustive edge-case handling.

---

## 7. Working guardrails (from original spec, kept)

- Use **beads** and **openspec** for tracking; commit small so humans can review.
- After each feature: build, lint, unit test; run integration tests for the flow.
- UI: sanity-check layout (no overflow / broken flex) — manual or a lightweight
  screenshot check, **not** an open-ended "repeat until ok" loop. Define done per flow.
- Docker: implement configs; the user runs/tests containers themselves (limited local
  resources).
- Keep `AGENTS.md` and per-folder component docs updated so agents don't re-read all code.
- No new git branch unless asked.

---

## 8. Open questions for planning

1. **Which testnet** (Base Sepolia vs alternative) and is testnet gas/faucet funding for
   the master account reliable for a live demo?
2. **Escrow depth in Flow ③:** show the on-chain freeze/disburse live, or keep escrow
   state as a seeded/read model and do the bailout in Postgres? (Effort vs live fragility.)
3. **ORM choice:** TypeORM vs Prisma — pick one in planning.
4. **KTP upload** in the live demo: real S3 upload for Ira, or pre-seeded URL?

## 9. smart contract deployment

base sepolia
RPC_URL=https://sepolia.base.org
BASE_RPC_URL=https://sepolia.base.org
PRIVATE_KEY=secreet
ADMIN_ADDRESS=0xb038CFb48D4e58727229EE25aAd42E5e37E971Fc
RELAYER_ADDRESS=0xd4427cFd107AdE41763df1D211E7633572dab852
RELAYER_PRIVATE_KEY=secrets
LOAN_METADATA_URI=ipfs://rantairenteng/{id}.json
Network: Base Sepolia (chain id 84532)
RRParticipationToken 0x1EDf5e51cFc99123cE2e98Ee9cdEA18C072dd48C
RRLoanPosition 0x49D82FeDEbB676517D0FB8cA3810a0fD1654B650
TanggungRentengEscrow 0x199812B240bf8d90dBAfB5C7E2ab79e3fAf728dE

## 10. app icon and logo and favicon

please visit `./assets` for favicon, icon, and logo

## References

- `brainstorm/gstudio/CLAUDE_PLAN.md` — full ERD, DDL, seed SQL, OpenSpec draft, contract ABI.
- `brainstorm/gstudio/src/types.ts`, `src/components/AnggotaView.tsx`,
  `PengurusView.tsx`, `RiskScreenerTool.tsx` — mockup fields to preserve.
- `brainstorm/RantaiRenteng_Spesifikasi_Flow.pdf`,
  `brainstorm/RantaiRenteng_Flow_Aplikasi.html` — flow spec.
- `brainstorm/RantaiRenteng_Skrining_Risiko_Demo.html`, `brainstorm/rr_risk_engine.py` —
  risk-engine reference.
- `foundry/` — escrow smart contract (in scope this phase).

---

**Next step:** run `/ce-plan` against this document to produce the implementation plan.
