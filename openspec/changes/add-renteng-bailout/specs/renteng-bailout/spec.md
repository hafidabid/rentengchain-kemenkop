## ADDED Requirements

### Requirement: Pengurus triggers a group renteng bailout for a missed installment

The system SHALL let a Pengurus trigger a tanggung renteng bailout for a member's loan whose
installment was missed. On trigger the system SHALL record the missed repayment on-chain
(`recordRepayment` with `onTime = false`), cover the installment from the group social fund
(`applySocialFund`), and activate renteng freeze on the deployed escrow (`activateRenteng`) — all
as live Base Sepolia transactions submitted by the relayer. The endpoint SHALL be restricted to
Pengurus.

#### Scenario: Bailout marks the loan DITALANGI and records live transactions

- **WHEN** a Pengurus calls `POST /api/loans/:id/renteng-bailout` for Deni's `Cair` loan
- **THEN** the loan `statusCicilan` becomes `DITALANGI` and the response carries the real Base Sepolia `txHash`(es) for the recorded repayment and social-fund application

#### Scenario: Anggota cannot trigger a bailout

- **WHEN** a member with role `Anggota` calls the renteng-bailout endpoint
- **THEN** the response is `403` and no state changes

### Requirement: Social fund is decremented and the event is audited

The system SHALL decrement the group `kas_sosial` by the covered installment amount
(`cicilanBulanan`) within a single database transaction and append an audit-log entry describing
the talangan, carrying the escrow transaction hash.

#### Scenario: kas_sosial drops by the covered installment

- **WHEN** a bailout covers an installment of amount `cicilanBulanan`
- **THEN** the group `kasSosial` is reduced by exactly `cicilanBulanan` and never falls below zero

#### Scenario: Bailout writes an audit entry with a tx link

- **WHEN** a bailout completes
- **THEN** a new audit entry with aksi `TANGGUNG_RENTENG_TRIGGERED` exists, names the affected member and amount, and exposes a `txLink` derived from the escrow `txHash`

### Requirement: Escrow freeze state is reflected in the read model

The system SHALL reflect the escrow freeze/disburse state so that after a bailout both surfaces
see the group as frozen.

#### Scenario: Group reads as frozen after a bailout

- **WHEN** a client reads `GET /api/groups/:id` after Deni's bailout
- **THEN** the group reports the reduced `kasSosial` and a frozen renteng state

### Requirement: Bailout is idempotent

The system SHALL NOT double-apply a bailout to a loan already in `DITALANGI`.

#### Scenario: Re-triggering does not double-decrement

- **WHEN** the renteng-bailout endpoint is called again for a loan already in `DITALANGI`
- **THEN** the system returns the current state without further decrementing `kasSosial` or submitting duplicate transactions

### Requirement: Shallow talangan settlement

The system SHALL provide a happy-path settlement that records a talangan repayment on-chain.

#### Scenario: Talangan repayment is recorded and audited

- **WHEN** a Pengurus calls `POST /api/loans/:id/repay-talangan` with an amount
- **THEN** the system submits `repayTalangan(loanId, amount)` on-chain and appends an audit entry carrying the resulting `txHash`
