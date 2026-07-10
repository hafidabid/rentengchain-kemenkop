## Context

Deni is seeded with a `Cair` loan (`status_cicilan` currently `DITALANGI` in the reference seed,
but for the live demo the loan starts in a payable state so the bailout can be triggered on
stage). The deployed `TanggungRentengEscrow` is a tracking-only ledger: `recordRepayment`,
`applySocialFund`, `activateRenteng`, and `repayTalangan` record accounting anchors and emit
events, they never move funds. `kas_sosial` and the loan status live in Postgres; the chain is
the immutable audit anchor. `applySocialFund`/`activateRenteng` are `KOPERASI_ROLE`;
`recordRepayment`/`repayTalangan` are `RELAYER_ROLE` — the single relayer account holds both.

## Goals / Non-Goals

**Goals:**
- One Pengurus action that atomically (a) marks the missed installment, (b) covers it from the
  social fund, (c) freezes the group escrow, all with real Base Sepolia txs.
- A read model where both surfaces can see the loan `DITALANGI`, the reduced `kasSosial`, and the
  group frozen state.
- An audit entry with a clickable explorer link.

**Non-Goals:**
- No full collection-ladder ("tangga penagihan") automation — only the single bailout step.
- No real fund movement; `kas_sosial` is a Postgres balance, not a token transfer.
- No penalty scoring, no notifications, no deep restructuring math (`restructure` is out of scope
  here).

## Decisions

- **Endpoint**: `POST /api/loans/:id/renteng-bailout` (Pengurus-only), body optionally
  `{ period, gracePeriod }`; defaults derived from the loan's current installment.
- **On-chain order**: `recordRepayment(loanId, period, onTime=false)` → `applySocialFund(loanId,
  period)` → `activateRenteng(loanId, period, gracePeriod)`. Submit sequentially, collect each
  `txHash`. If `applySocialFund` is sufficient alone, `activateRenteng` still runs to reflect the
  freeze state the demo narrates.
- **Postgres side effects in one transaction**: set loan `statusCicilan = DITALANGI`, decrement
  `groups.kas_sosial` by the covered installment (`cicilan_bulanan`), append the audit entry with
  the escrow `txHash`.
- **Freeze state in the read model**: persist a `renteng_frozen` flag (or derive from loan
  `DITALANGI` within the group) so `GET /api/groups/:id` and loan reads report the group as
  frozen; unfreeze is out of scope beyond the shallow `repayTalangan` path.
- **repayTalangan (shallow)**: `POST /api/loans/:id/repay-talangan` records `repayTalangan(loanId,
  amount)` on-chain and audits it; it does not fully reconcile `kas_sosial` replenishment logic.
- **Idempotency**: re-triggering a bailout on an already-`DITALANGI` loan returns the existing
  state rather than double-decrementing `kas_sosial`.

## Risks / Trade-offs

- **Live-tx fragility** is the main risk: three sequential Base Sepolia txs multiply RPC-hiccup
  exposure. Mitigation: short receipt timeouts, return hashes optimistically, and keep the
  Postgres state transition authoritative so the UI updates even if a receipt is slow.
- **Seed-state mismatch**: the reference seed marks Deni already `DITALANGI`; the demo seed must
  reset him to a payable `Cair` loan so the action is live. Noted as a seed adjustment, owned by
  the foundation seed script but validated here.
- Decrementing `kas_sosial` without a replenishment model can drive it negative under repeated
  triggers; the idempotency guard and single-shot demo scope keep this safe.
