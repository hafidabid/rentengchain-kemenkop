## Context

The stack is NestJS + Prisma + Postgres (backend) and React 19 + Vite + Tailwind (frontend),
with Gemini already wired (`@google/genai`) and a graceful-degradation pattern used throughout
(web3, S3). Members authenticate by NIK + password; seeded members share a demo password while
onboarded members currently have none. Loans carry AI screening + an appeal flag; renteng
bailouts write audit entries and flip `statusCicilan` to `DITALANGI`. "EWS" appears in copy
without definition.

## Goals / Non-Goals

**Goals:**
- Give the Pengurus operational tools: see KTPs, issue credentials, explain decisions, inspect
  members, query data conversationally, and export reports.
- Keep every external dependency (Gemini, Redis, web grounding) optional and gracefully
  degrading, consistent with the codebase.

**Non-Goals:**
- No free-form NL→SQL execution by the LLM (safety); grounding is curated aggregates + a few
  safe, parameterized tools.
- No streaming chat, no multi-tenant analytics, no historical warehouse — aggregates are
  computed from current tables.
- No password self-service portal beyond the one-time credential + reset.

## Decisions

### 1. KYC review (`kyc-review`)
- Approval generates a crypto-random temp password (e.g. 10 chars), bcrypt-hashes it into the
  existing `password_hash`, and returns `tempPassword` **once** in the approval response. Only
  generate when the member has no usable password (idempotent re-approve won't rotate silently);
  a separate `POST /api/kyc/:id/reset-password` rotates on demand. Add
  `members.must_change_password` (boolean) to hint the UI. The KTP is already on the member
  (`ktpUrl`) — the frontend renders it in the queue; no backend change beyond exposure.

### 2. Loan review notes + history (`loan-review-notes`)
- New `loan_decisions` table: `id, loan_id, decision (Disetujui|Ditunda|Mangkir|SanggahDiterima|
  SanggahDitolak), note, aktor, created_at`. `loans.catatan_pengurus` holds the latest
  member-facing note. `approve`/`reject`/appeal-resolution accept an optional `note`, append a
  decision row, and set `catatan_pengurus`. `GET /api/loans/:id` returns `catatanPengurus`;
  `GET /api/loans/:id/decisions` returns the timeline. The anggota loan view shows the note.

### 3. Group member insight (`group-member-insight`)
- `GET /api/members/:id/detail` (Pengurus) returns member + savings + loans + renteng history.
- Add a `renteng_events` table written by the bailout flow (`loan_id, member_id, event
  (Ditalangi|TalanganLunas), amount, period, tx_hash, created_at`) so history is queryable
  without parsing audit text; the existing audit entry stays. History returns newest first.

### 4. Koperasi assistant (`koperasi-assistant`)
- `AssistantModule`: `MetadataSnapshotService` computes a JSON snapshot = a static schema/column
  description + live aggregates (members by status/peran, loans by flag/status, savings totals,
  kas_sosial, renteng counts, etc.). Cached under `rr:metadata:snapshot`; refreshed on a
  `METADATA_REFRESH_MS` interval (Nest `@Interval`) and lazily on first use.
- **Redis-optional**: a `CacheService` wraps `ioredis` when `REDIS_URL` is set, else an
  in-memory Map with TTL — same interface, graceful fallback.
- `AssistantService.chat(history)`: builds a system prompt embedding the snapshot + guardrails
  ("answer only from this data; say when unknown"), calls Gemini `GEMINI_MODEL` (default a
  current flash model), optionally enabling the Gemini Google-Search grounding tool when
  `ASSISTANT_WEB_GROUNDING=true`. A few safe parameterized "tools" (e.g. lookup member by name,
  list red-flag loans) may be exposed via function-calling; no arbitrary SQL. If `GEMINI_API_KEY`
  is unset, the endpoint returns a clear "assistant not configured" message plus the raw
  snapshot so the panel is still useful. `POST /api/assistant/chat` is Pengurus-guarded.

### 5. e-RAT reporting (`koperasi-reporting`)
- `ReportsService.eRat()` returns `{ charts: {...series}, tables: {...rows}, summary }`.
- `GET /api/reports/e-rat` (JSON) and `GET /api/reports/e-rat/export.xlsx` — the latter builds a
  workbook with `exceljs` and streams it (`Content-Type` +
  `Content-Disposition: attachment`). Sheets: Ringkasan, Simpanan, Pinjaman, Tanggung Renteng.
- **Frontend charts**: use lightweight self-contained SVG chart components (bar/line/donut) to
  avoid React-19 charting-lib compat risk; if a richer library is preferred later, swap in
  `recharts`. Tables render the same `tables` rows; an Export button hits the xlsx endpoint.

### 6. EWS explainer (`ews-explainer`)
- A reusable `InfoTooltip` component + an `EwsExplainer` inline block and a shared `EWS_COPY`
  constant (EN/ID): "EWS (Early Warning System) — skrining risiko kredit berbasis AI (Gemini):
  skor 0–100 dan flag HIJAU/KUNING/MERAH dari histori bayar, tabungan, kehadiran kelompok."
  Attach the tooltip to every EWS mention (flag badges, risk screener, login tagline).

## Risks / Trade-offs

- **Gemini dependency for the assistant**: mitigated by returning the snapshot + a configure-key
  message when the key is missing; the panel degrades, never crashes.
- **LLM accuracy**: curated-aggregate grounding + an explicit "based on cooperative data as of
  <timestamp>" disclaimer reduces (not eliminates) hallucination; no writes are ever issued.
- **Redis is new infra**: optional and in-memory-fallback, matching the project's dropped-unless-
  needed stance; only the assistant snapshot uses it.
- **Migrations touch shared tables** (`loans`, `members`): additive columns + new tables only,
  no destructive changes; seed stays idempotent.
- **XLSX size**: demo data is small; export is synchronous and bounded.
