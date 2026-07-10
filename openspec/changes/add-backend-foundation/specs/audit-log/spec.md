## ADDED Requirements

### Requirement: Append-only audit trail

The system SHALL provide an audit-log service that appends an immutable entry with `timestamp`,
`aktor`, `aksi`, and `detail`. Every flow that changes state (KYC approval, savings, repayment,
bailout, appeal resolution) SHALL append an audit entry describing the action.

#### Scenario: Appending an audit entry

- **WHEN** any module calls the audit-log append with an aktor, aksi, and detail
- **THEN** a new immutable audit row is persisted with a server timestamp

### Requirement: Readable transparent ledger with derived explorer links

The system SHALL expose the audit trail to both surfaces, newest first. Where an entry relates
to an on-chain transaction, the response SHALL derive a clickable `txLink` from the stored
`txHash` and the configured Base Sepolia explorer base URL; the system SHALL NOT store a
`txLink` column.

#### Scenario: Audit log read returns derived tx link

- **WHEN** a client reads `GET /api/audit-logs` and an entry carries a `txHash`
- **THEN** that entry includes a `txLink` of the form `https://sepolia.basescan.org/tx/<txHash>` derived at read time

#### Scenario: Audit log is ordered newest first

- **WHEN** a client reads the audit log
- **THEN** entries are returned in descending timestamp order
