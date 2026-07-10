## Why

Tanggung renteng — shared social collateral — is the heart of RantaiRenteng's story. When a
member misses an installment, the group must visibly absorb it: the social fund (`kas_sosial`)
covers the arrears and the escrow freezes further disbursement until the group is whole again.
The demo needs this to happen *live*: the seeded persona Deni has a running (`Cair`) loan, and on
stage a Pengurus triggers the bailout so a judge sees Deni's loan flip to `DITALANGI`, the group
social fund drop, an audit entry appear, and a real Base Sepolia transaction confirm the freeze.
Without this change the renteng mechanism is just seeded text with no live action behind it.

## What Changes

- Add a Pengurus-triggered renteng bailout: `POST /api/loans/:id/renteng-bailout`.
- On trigger, record the missed installment on-chain via `recordRepayment(loanId, period,
  onTime=false)`, then apply the social fund via `applySocialFund(loanId, period)` and/or
  activate renteng via `activateRenteng(loanId, period, gracePeriod)` on the deployed escrow —
  all LIVE Base Sepolia transactions.
- Transition Deni's loan `statusCicilan` to `DITALANGI` and decrement the group `kasSosial` by
  the covered installment amount in Postgres.
- Append an audit-log entry describing the talangan (aktor = Pengurus, aksi =
  `TANGGUNG_RENTENG_TRIGGERED`) carrying the on-chain `txHash`.
- Reflect the escrow freeze/disburse state in the loan/group read model so both surfaces show the
  group as frozen after a bailout.
- Add a shallow `repayTalangan(loanId, amount)` settlement path so the talangan can be marked
  repaid later (happy-path only, not a full ladder).

## Capabilities

### New Capabilities

- `renteng-bailout`: the group-social-collateral action that covers a member's missed
  installment from `kas_sosial`, marks the loan `DITALANGI`, records the missed repayment and
  fund application live on the escrow, freezes further disbursement, and audits the event; plus a
  shallow talangan-repayment settlement.

### Modified Capabilities

<!-- none — this change consumes lending, onchain-ledger, and audit-log; it does not modify their requirements -->

## Impact

- New backend logic in the loans/renteng module: bailout endpoint, escrow-state read model,
  `kas_sosial` decrement transaction.
- Depends on `add-backend-foundation` (group + loan schema, `kas_sosial`, audit-log service),
  `add-web3-relayer` (`recordRepayment`, `applySocialFund`, `activateRenteng`, `repayTalangan`
  live-tx methods + explorer-link derivation), and `add-ai-ews-appeal` (the `lending` capability
  and loan records must exist to be bailed out).
- Live-demo dependency: the relayer account must stay funded; the seeded Deni loan must be in
  `Cair` state before the demo.
