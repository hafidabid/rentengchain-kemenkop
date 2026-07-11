## Why

The Pengurus (admin) surface currently covers the four demo flows but is thin on the
day-to-day tools a koperasi board actually needs: they can't see a member's uploaded KTP,
there's no credential to hand a newly-approved member, rejections/appeals give the member no
explanation, group management is a flat list, there's no way to interrogate the data, and
"e-RAT" is read-only with no export. The app also says **EWS** everywhere without ever
explaining it. This change adds six Pengurus-facing capabilities to close those gaps.

## What Changes

1. **KYC review**: the Antre KYC queue shows each applicant's uploaded KTP document; approving
   a member **auto-generates a temporary password** (hashed at rest), returned once and shown
   in the admin dashboard so the Pengurus can hand credentials to the member.
2. **Loan review notes + history**: loan decisions are recorded as a history timeline; when a
   Pengurus rejects/holds a loan or resolves a `sanggah`, they attach a **note (catatan)** that
   is surfaced to the anggota on their loan.
3. **Group member insight**: in Kelola Kelompok, clicking a member opens their detail
   (profile, wallet, savings, loans) plus their **tanggung-renteng history**.
4. **Koperasi assistant (chatbot)**: a Gemini-backed chat on the Pengurus page that analyzes
   cooperative data. A DB **metadata + aggregate snapshot** is maintained and refreshed
   periodically (cached in Redis when available, in-memory otherwise) and passed as grounded
   context; the assistant can also pull external context via Gemini web grounding. Model is
   swappable via env (any Google Gemini model).
5. **e-RAT reporting**: the Laporan view gains chart visualizations + tabular data and an
   **export to XLSX**.
6. **EWS explainer**: define EWS (Early Warning System) inline and via tooltips wherever it
   appears.

## Capabilities

### New Capabilities

- `kyc-review`: view the applicant's KTP in the queue; auto-issue a one-time temporary
  password on approval and surface it to the Pengurus.
- `loan-review-notes`: a persisted loan-decision history and a Pengurus note on
  reject/hold/appeal-resolution that the anggota can read.
- `group-member-insight`: a member detail + tanggung-renteng history view within group
  management.
- `koperasi-assistant`: a Gemini chatbot grounded on a refreshed DB metadata/aggregate
  snapshot (Redis-optional) with optional web grounding; model configurable.
- `koperasi-reporting`: e-RAT chart + tabular aggregates and an XLSX export.
- `ews-explainer`: a reusable explanation of EWS surfaced inline and via tooltips.

### Modified Capabilities

<!-- The features build on kyc-onboarding, lending, appeals, group-management, and
     risk-screening, but are expressed as new capabilities above to avoid editing
     not-yet-synced main specs. -->

## Impact

- **Backend**: new modules — `assistant/` (Gemini + metadata snapshot service, Redis-optional),
  `reports/` (aggregates + XLSX via `exceljs`); extensions to `kyc/` (temp password),
  `loans/` (decision history + notes), `members/`/`groups/` (member detail + renteng history).
- **Schema**: `members.must_change_password` (or a temp-password flag), a `loan_decisions`
  table (loanId, decision, note, aktor, createdAt), `loans.catatan_pengurus`.
- **New deps**: `exceljs`, `ioredis` (optional), a frontend chart lib (e.g. `recharts`) + an
  XLSX-download flow; `@google/genai` already present.
- **Infra**: optional Redis service in `docker-compose` (graceful in-memory fallback).
- **Config**: `GEMINI_MODEL`, `GEMINI_API_KEY`, `REDIS_URL`, `METADATA_REFRESH_MS`.
- **Frontend**: Pengurus page gains KTP preview, decision-note inputs + history, member-detail
  drawer, an assistant chat panel, report charts/tables + export button, and EWS tooltips.
