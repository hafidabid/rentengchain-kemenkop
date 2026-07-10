## 1. Bailout endpoint

- [ ] 1.1 Add `POST /api/loans/:id/renteng-bailout` (Pengurus-only via RolesGuard), body `{ period?, gracePeriod? }` with sensible defaults from the loan's current installment
- [ ] 1.2 Guard: reject if the loan is not in a payable `Cair` state or already `DITALANGI` (idempotent no-op returning current state)

## 2. Live on-chain calls

- [ ] 2.1 Call `recordRepayment(loanId, period, onTime=false)` via the relayer; capture `txHash`
- [ ] 2.2 Call `applySocialFund(loanId, period)` via the relayer; capture `txHash`
- [ ] 2.3 Call `activateRenteng(loanId, period, gracePeriod)` via the relayer to reflect the escrow freeze; capture `txHash`
- [ ] 2.4 Collect all hashes; tolerate slow receipts by returning hashes optimistically

## 3. Postgres state transition (single DB transaction)

- [ ] 3.1 Set the loan `statusCicilan = DITALANGI`
- [ ] 3.2 Decrement `groups.kas_sosial` by the covered installment (`cicilanBulanan`); never below zero
- [ ] 3.3 Persist/derive a group `rentengFrozen` state for the read model
- [ ] 3.4 Append an audit-log entry (aktor = Pengurus, aksi = `TANGGUNG_RENTENG_TRIGGERED`, detail names Deni + amount) carrying the escrow `txHash`

## 4. Read model

- [ ] 4.1 `GET /api/groups/:id` reports reduced `kasSosial` and the frozen state after a bailout
- [ ] 4.2 Loan reads report `statusCicilan = DITALANGI` and expose the bailout `txHash`/derived `txLink`

## 5. Shallow talangan settlement

- [ ] 5.1 `POST /api/loans/:id/repay-talangan` records `repayTalangan(loanId, amount)` on-chain and appends an audit entry (happy-path only)

## 6. Seed alignment

- [ ] 6.1 Confirm the demo seed places Deni's loan in a payable `Cair` state (not pre-`DITALANGI`) so the bailout is a live action

## 7. Quality gates

- [ ] 7.1 `npm run build` and `npm run lint` pass
- [ ] 7.2 Unit test: bailout marks the loan `DITALANGI`, decrements `kasSosial` by `cicilanBulanan`, and appends exactly one audit entry
- [ ] 7.3 Unit test: re-triggering on an already-`DITALANGI` loan does not double-decrement `kasSosial`
- [ ] 7.4 Integration smoke against Base Sepolia: trigger Deni's bailout end-to-end and confirm the three `txHash`es resolve on the explorer and the group shows frozen
