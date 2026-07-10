## Why

Flow ④ is the demo's proof that RantaiRenteng is really on-chain: a member pays a simpanan and a
judge can click a link to a real Base Sepolia transaction. Today the mockup only mutates local
state. This change turns a savings payment into a persisted, auditable, on-chain-anchored event
— without a real payment gateway and without the contract ever holding funds. It is the
narrowest end-to-end slice through the whole stack (member → Postgres → escrow → explorer →
audit log), so it doubles as the integration smoke test for the foundation and relayer layers.

## What Changes

- Add a `savings` capability: a member records a simpanan (`Pokok`/`Wajib`/`Sukarela`) via
  `POST /api/savings`, and lists their savings via `GET /api/savings?memberId=`.
- Simulate QRIS confirmation: the request marks the `saving_transaction` `PAID` (no external
  gateway), and that confirmation is what fires the on-chain call.
- On confirmation, call `recordSavings(memberHash, jenis, nominal, metode)` on the deployed
  escrow through the `onchain-ledger` capability, persist the returned `txHash` on the
  `saving_transactions` row, and increment the member's matching `simpanan_*` balance.
- Derive a clickable `txLink` from `txHash` + the configured explorer base at read time; never
  store a `txLink` column (per `claude0.md`).
- Append an `audit-log` entry (`aktor` = member, `aksi` = savings recorded, `detail` = amount +
  jenis + txHash) so the transparent ledger shows the event.

## Capabilities

### New Capabilities

- `savings`: record a member's simpanan with a simulated QRIS confirmation, anchor it on-chain
  via a real Base Sepolia transaction, update the member's savings balance, and expose the
  transaction (with a derived explorer link) for the audit trail.

### Modified Capabilities

<!-- none — audit-log and onchain-ledger are consumed, not modified -->

## Impact

- New backend module `savings/` (controller, service, DTOs) in `/backend`.
- Reads/writes the `saving_transactions` table and the member `simpanan_*` balances defined by
  `add-backend-foundation`.
- Consumes `onchain-ledger` (`recordSavings`, `txHash`) from `add-web3-relayer` and the
  `audit-log` append + camelCase mapping from `add-backend-foundation`.
- Depends on `add-backend-foundation` and `add-web3-relayer`; no new external dependencies.
- Live-demo dependency: a funded relayer and a reachable Base Sepolia RPC (shared with the
  relayer change).
