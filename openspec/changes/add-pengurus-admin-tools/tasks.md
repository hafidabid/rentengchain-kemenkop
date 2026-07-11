## 1. Schema + shared

- [x] 1.1 Prisma: add `members.must_change_password` (bool), `loans.catatan_pengurus` (text?), new `loan_decisions` and `renteng_events` tables; migration + regenerate client
- [x] 1.2 Config + `.env.example`: `GEMINI_MODEL`, `GEMINI_API_KEY`, `REDIS_URL`, `METADATA_REFRESH_MS`, `ASSISTANT_WEB_GROUNDING`; add optional `redis` service to docker-compose
- [x] 1.3 Add deps: `exceljs`, `ioredis` (backend); a chart approach for frontend (self-contained SVG components)

## 2. KYC review (`kyc-review`)

- [x] 2.1 On `approve`, generate a crypto-random temp password, bcrypt-hash into `password_hash` (only when none usable), set `must_change_password`, return one-time `tempPassword`
- [x] 2.2 `POST /api/kyc/:id/reset-password` (Pengurus) → rotate, return new one-time `tempPassword`
- [ ] 2.3 Frontend: Antre KYC shows the applicant's KTP (image/link + "no document" state); after approve/reset, show the one-time credential (copyable) once
- [x] 2.4 Unit tests: approval issues a hash + one-time plaintext (never persisted); login works with it; reset rotates

## 3. Loan review notes + history (`loan-review-notes`)

- [x] 3.1 `approve`/`reject`/appeal-resolution accept optional `note`; append a `loan_decisions` row and set `loans.catatan_pengurus`
- [x] 3.2 `GET /api/loans/:id/decisions` (Pengurus) timeline; include `catatanPengurus` in loan DTO (readable by the owning anggota)
- [ ] 3.3 Frontend: decision-note inputs on reject/hold/resolve; decision-history timeline in review; anggota loan view shows the note
- [x] 3.4 Unit/e2e: reject with note persists + surfaces to the owner; history lists decisions newest-first

## 4. Group member insight (`group-member-insight`)

- [x] 4.1 Renteng bailout writes a `renteng_events` row (plus existing audit)
- [x] 4.2 `GET /api/members/:id/detail` (Pengurus) → member + savings + loans + renteng history (newest first; empty list when none)
- [ ] 4.3 Frontend: Kelola Kelompok member click → detail drawer with profile/wallet/savings/loans + renteng history
- [x] 4.4 Unit tests: detail aggregates correctly; empty renteng history handled

## 5. Koperasi assistant (`koperasi-assistant`)

- [x] 5.1 `CacheService`: `ioredis` when `REDIS_URL` set, else in-memory TTL Map (same interface)
- [x] 5.2 `MetadataSnapshotService`: compute schema description + live aggregates; cache + `@Interval` refresh + lazy first-use build
- [x] 5.3 `AssistantService.chat(history)`: Gemini (`GEMINI_MODEL`) with snapshot-grounded system prompt + guardrails; optional web grounding via `ASSISTANT_WEB_GROUNDING`; graceful "not configured" + snapshot when no key; a few safe parameterized tools (no raw SQL)
- [x] 5.4 `POST /api/assistant/chat` (Pengurus-guarded); `GET /api/assistant/snapshot` for the panel
- [ ] 5.5 Frontend: Pengurus chat panel (history, send, grounded answers, timestamp disclaimer)
- [x] 5.6 Unit tests: snapshot cached/reused within interval; Redis-absent fallback; non-Pengurus 403; no-key path returns snapshot + message (Gemini mocked)

## 6. e-RAT reporting (`koperasi-reporting`)

- [x] 6.1 `ReportsService.eRat()` → chart series + table rows + summary
- [x] 6.2 `GET /api/reports/e-rat` (JSON) and `GET /api/reports/e-rat/export.xlsx` (`exceljs`, streamed with attachment headers; sheets Ringkasan/Simpanan/Pinjaman/Tanggung Renteng)
- [ ] 6.3 Frontend Laporan: SVG chart components + data tables + an Export XLSX button (downloads the file)
- [x] 6.4 Unit tests: aggregates correct; export returns a valid xlsx content type with populated sheets

## 7. EWS explainer (`ews-explainer`)

- [ ] 7.1 `InfoTooltip` component + `EwsExplainer` inline block + shared `EWS_COPY` constant
- [ ] 7.2 Attach the tooltip to EWS mentions (flag badges, risk screener, tagline); add the inline explainer to the risk/screening surfaces

## 8. Quality gates

- [ ] 8.1 Backend `build` + `lint` green; frontend `build` (tsc + vite) green
- [ ] 8.2 New unit tests pass; e2e for notes/detail/reporting where practical (Gemini/Redis mocked or degraded)
- [ ] 8.3 Update `backend/AGENTS.md` / relevant READMEs with the new modules, env, and Redis-optional note
