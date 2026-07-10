## 1. Loan application lifecycle (lending)

- [ ] 1.1 Add a `loans/` module with a `LoanService` over the seeded `loans` table (camelCase DTOs)
- [ ] 1.2 `POST /api/loans/apply` (Anggota): validate group membership + plafon, create a loan with `status = Diajukan`, `statusCicilan = UNPAID`, flat seeded `cicilanBulanan`
- [ ] 1.3 On create, call `createLoan(...)` on the escrow via the relayer; persist the returned `txHash`
- [ ] 1.4 Pengurus review reads: `GET /api/loans` (list, filterable by status) and `GET /api/loans/:id` returning the loan with `skorAi`/`flagAi`/`flagAlasan` and any appeal
- [ ] 1.5 Pengurus decision endpoints: `POST /api/loans/approve/:id`, `POST /api/loans/reject/:id`, `POST /api/loans/hold/:id` transitioning `status` among `Disetujui`/`Ditunda`/`Mangkir` and calling `approveLoan`/`deferLoan` on-chain as appropriate; append an audit entry

## 2. Gemini EWS (risk-screening)

- [ ] 2.1 Add `@google/genai`; create a `ScreeningService` reading `GEMINI_API_KEY` + `GEMINI_MODEL` (current model id, not 1.5/2.0 names)
- [ ] 2.2 Build the EWS prompt from member savings habits, group `kehadiranRate`, and the loan `tujuan`; request strict JSON via a response schema
- [ ] 2.3 Parse + validate the model output into `{ skorAi (0-100), flagAi (HIJAU|KUNING|MERAH), flagAlasan: string[] }`; reject malformed output
- [ ] 2.4 On any Gemini error/timeout/invalid JSON, use the seeded fallback (Ani → `MERAH`, skor 38, seeded reasons); log `fallback_used`
- [ ] 2.5 Persist the score on the loan and call `recordScreening(loanId, skorAi, flagAi, paramsHash)` on-chain (map `flagAi` → `AIFlag` enum, `paramsHash` = salted screening inputs); persist `txHash`
- [ ] 2.6 Wire screening to run on `POST /api/loans/apply` after loan creation

## 3. Appeal / sanggah (appeals)

- [ ] 3.1 `POST /api/loans/sanggah/:id` (Anggota, only when `flagAi = MERAH`): store `sanggahAlasan` off-chain, set `isSanggah = true`
- [ ] 3.2 Call `fileAppeal(loanId, reasonHash)` on-chain with `reasonHash = salted(sanggahAlasan)`; NEVER submit raw text; persist `txHash`
- [ ] 3.3 Surface the appeal in the Pengurus loan read alongside `flagAlasan` (AI reasons)
- [ ] 3.4 When a Pengurus resolves an appealed loan, call `resolveAppeal(loanId, accepted)` on-chain (`accepted = true` on approve), persist the final `status`, and append an audit entry

## 4. Quality gates

- [ ] 4.1 `npm run build` and `npm run lint` pass
- [ ] 4.2 Unit test: malformed/failed Gemini response triggers the seeded fallback and yields a valid `MERAH` result for Ani
- [ ] 4.3 Unit test: `fileAppeal` calldata carries only a `reasonHash`, never the raw `sanggahAlasan`
- [ ] 4.4 Integration smoke: apply a loan for Ani → loan persists a `MERAH` score → file a `sanggah` → Pengurus approves → loan `status` persists and `resolveAppeal` returns a real `txHash`
- [ ] 4.5 Update `/backend` module README with the screening env + fallback behavior
