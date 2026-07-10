## 1. Savings module scaffold

- [ ] 1.1 Create a `savings/` module in `/backend` (controller, service, DTOs) wired into the app module
- [ ] 1.2 Add a `CreateSavingDto` (`memberId`, `jenis` ∈ `Pokok|Wajib|Sukarela`, `nominal` > 0, `metode` = `QRIS`) with validation

## 2. Record savings (simulated QRIS → on-chain)

- [ ] 2.1 `POST /api/savings`: create the `saving_transaction` row, mark it `PAID` (simulated QRIS confirmation)
- [ ] 2.2 Increment the member's matching `simpanan_<jenis>` balance in the same operation
- [ ] 2.3 Map `jenis`→`SavingsType` and `metode`→`PaymentMethod`, compute `memberHash`, and call `recordSavings(...)` via the `onchain-ledger` client
- [ ] 2.4 Persist the returned `tx_hash` on the saving row; on submission failure leave `tx_hash` null and surface the error without rolling back the balance
- [ ] 2.5 Append an audit-log entry (aktor = member nama, aksi = `SIMPANAN_RECORDED`, detail = jenis + nominal + txHash)

## 3. Read savings with derived link

- [ ] 3.1 `GET /api/savings?memberId=` returns the member's savings (camelCase), newest first
- [ ] 3.2 Derive `txLink` from `tx_hash` + `EXPLORER_BASE_URL` at read time; never persist a `txLink` column

## 4. Quality gates

- [ ] 4.1 `npm run build` and `npm run lint` pass
- [ ] 4.2 Unit test: recording a `Wajib` saving increments `simpananWajib` and appends exactly one audit entry
- [ ] 4.3 Integration smoke against Base Sepolia: `POST /api/savings` for a seeded member returns a `txHash` whose `txLink` resolves on the explorer; the audit log shows the entry
- [ ] 4.4 Manual UI-less check: `GET /api/savings` returns the new row with a clickable `txLink` and the updated balance
