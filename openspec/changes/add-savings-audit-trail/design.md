## Context

The `saving_transactions` table, member `simpanan_*` balances, the `audit-log` append, and the
camelCase mapping already exist from `add-backend-foundation`. The `onchain-ledger` capability
from `add-web3-relayer` already knows how to submit `recordSavings` and return a real `txHash`.
This change is the thin flow that wires them together. Real QRIS settlement is explicitly out of
scope (`claude0.md` §5): confirmation is a button, and the interesting artifact is the on-chain
transaction, not the payment rail.

## Goals / Non-Goals

**Goals:**
- One `POST /api/savings` call that produces a real, clickable Base Sepolia transaction.
- Member `simpanan_*` balance updates and an audit entry appears, both immediately visible.
- Serve as the end-to-end integration smoke for foundation + relayer.

**Non-Goals:**
- No real QRIS/payment gateway, no reconciliation between chain and Postgres (`claude0.md` §6).
- No on-chain fund movement — `recordSavings` is a tracking anchor only.
- No withdrawal / negative simpanan flows; happy-path deposits only.

## Decisions

- **Confirmation model**: the `POST /api/savings` request carries `metode: "QRIS"` and is
  treated as the simulated confirmation — it immediately marks the row `PAID` and fires the
  on-chain call. There is no separate pending→confirm round trip for the demo.
- **jenis → SavingsType enum**: map `Pokok|Wajib|Sukarela` (UI/DB) to the on-chain
  `POKOK|WAJIB|SUKARELA` enum in the service before calling `recordSavings`; `metode` maps to
  the on-chain `PaymentMethod` (`QRIS`).
- **Balance update is off-chain**: the member's `simpanan_<jenis>` column is incremented in
  Postgres in the same operation; the chain records the event, Postgres is the queryable
  balance (no chain reads).
- **txHash on the row, txLink derived**: store only `tx_hash`; `GET /api/savings` and the audit
  log derive `txLink` from `tx_hash` + `EXPLORER_BASE_URL` at read time.
- **Ordering under fragility**: mark `PAID` and update balance first, then submit the tx and
  patch `tx_hash` when it returns. A slow receipt still yields a `txHash` (per relayer design),
  so the link appears; if submission hard-fails, the saving stays `PAID` with a null `tx_hash`
  and the failure is surfaced — the demo can retry the anchor without losing the balance.

## Risks / Trade-offs

- **Live testnet fragility** (shared top risk): mitigated by the relayer's optimistic
  hash-return and short receipt timeout; the balance/audit update does not block on confirmation.
- Recording the balance before confirmation means a failed anchor leaves a `PAID` row without a
  `tx_hash`; acceptable for a happy-path demo and visibly retryable, but not reconciled.
- Re-submitting a seeded member's savings could hit an idempotent revert on-chain; the relayer
  swallows known reverts, so the API still returns `PAID` (demo-shallow).
