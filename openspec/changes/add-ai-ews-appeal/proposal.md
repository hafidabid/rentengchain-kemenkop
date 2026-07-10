## Why

Flow ② is the app's differentiator on stage: an AI Early-Warning System (EWS) that scores a
loan applicant's risk, plus a member's right to appeal (`sanggah`) an unfavourable machine
verdict. Today loans and screening exist only as static mockup fields. This change makes them
real: a member applies for a group-bound loan, a live Gemini call produces a persisted risk
score and reasons, the applicant can contest a `MERAH` flag, and a Pengurus sees the appeal
next to the AI reasons and makes the final human decision. Every step also leaves a real Base
Sepolia audit anchor via the relayer.

## What Changes

- Add the loan application lifecycle: `POST /api/loans/apply` creates a group-bound loan
  (`status = Diajukan`) and calls `createLoan(...)` on the deployed escrow. Pengurus review
  reads and decision endpoints move the loan through `Disetujui`/`Ditunda`/`Cair`.
- Run a **real `@google/genai` (Gemini) EWS** call on loan apply that scores the member profile
  (savings habits, group presence rate, credit purpose) and returns structured JSON: `skorAi`
  (0–100), `flagAi` (`HIJAU|KUNING|MERAH`), `flagAlasan` (`string[]`). The result is persisted
  on the loan and written on-chain via `recordScreening(loanId, skorAi, flagAi, paramsHash)`.
- Add a **seeded fallback** for persona Ani (fixed `MERAH` result) so a flaky network cannot
  break the demo: the real call is attempted first, the fallback is used only on failure.
- Add the appeal path: `POST /api/loans/sanggah/:id` records a `sanggah`, calls
  `fileAppeal(loanId, reasonHash)` with a salted hash (never raw appeal text), sets `isSanggah`
  and stores `sanggahAlasan` off-chain.
- Add the Pengurus final decision: approve/reject/hold via `POST /api/loans/approve/:id` (and
  reject/hold), which surfaces the appeal alongside the AI reasons, calls
  `resolveAppeal(loanId, accepted)` on-chain, and persists the loan status.

## Capabilities

### New Capabilities

- `lending`: the loan record and application lifecycle (apply → screen → Pengurus decision),
  mirrored on-chain via `createLoan`/`approveLoan`/`deferLoan`.
- `risk-screening`: a live Gemini EWS that produces `skorAi`/`flagAi`/`flagAlasan`, records the
  score on-chain, and falls back to a seeded result for demo safety.
- `appeals`: the member `sanggah` right and the Pengurus resolution, anchored on-chain with a
  salted `reasonHash`.

### Modified Capabilities

<!-- none; on-chain-ledger and audit-log are owned by earlier changes and only consumed here -->

## Impact

- New backend modules `loans/`, `screening/`, `appeals/`.
- New dependency: `@google/genai` (current model IDs; not the stale 1.5/2.0 Flash/Pro names).
- New env: `GEMINI_API_KEY`, `GEMINI_MODEL`.
- Consumes `add-web3-relayer` methods `createLoan`, `recordScreening`, `approveLoan`,
  `deferLoan`, `fileAppeal`, `resolveAppeal` and its salted `reasonHash`/`paramsHash` helpers,
  plus the `audit-log` append from `add-backend-foundation`.
- Depends on `add-backend-foundation` (member/group/loan schema, auth, audit-log) and
  `add-web3-relayer`.
- Live-demo dependency: Gemini API availability (mitigated by Ani's seeded fallback) and a
  funded relayer for the on-chain screening/appeal writes.
