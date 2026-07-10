## ADDED Requirements

### Requirement: Group-bound loan application

The system SHALL let an Anggota apply for a loan bound to a group they belong to via
`POST /api/loans/apply`. The created loan SHALL start with `status = Diajukan`,
`statusCicilan = UNPAID`, a flat seeded `cicilanBulanan`, and be persisted with camelCase
fields. On creation the system SHALL record the loan on-chain via `createLoan(...)` through the
relayer and persist the returned `txHash`.

#### Scenario: Member applies for a loan in their group

- **WHEN** an Anggota who belongs to a group submits a valid loan application
- **THEN** a loan is persisted with `status = Diajukan` and a `createLoan` transaction hash is stored

#### Scenario: Application outside the member's group is rejected

- **WHEN** a member applies against a group they do not belong to
- **THEN** the response is a validation error and no loan is created

### Requirement: Loan carries persisted AI risk fields

The system SHALL persist `skorAi` (0–100), `flagAi` (`HIJAU|KUNING|MERAH`), and `flagAlasan`
(`string[]`) on every screened loan, and SHALL expose them on loan reads.

#### Scenario: Loan read includes risk fields

- **WHEN** a Pengurus reads a screened loan via `GET /api/loans/:id`
- **THEN** the response includes `skorAi`, `flagAi`, and a non-empty `flagAlasan` array

### Requirement: Pengurus loan decision transitions

The system SHALL let a Pengurus approve, reject, or hold a loan, transitioning `status` among
`Disetujui`, `Ditunda`, and `Mangkir`, calling `approveLoan`/`deferLoan` on-chain as
appropriate, and appending an audit entry. Anggota SHALL NOT be able to make these decisions.

#### Scenario: Pengurus approves a loan

- **WHEN** a Pengurus calls `POST /api/loans/approve/:id`
- **THEN** the loan `status` becomes `Disetujui`, an `approveLoan` transaction is submitted, and an audit entry is appended

#### Scenario: Anggota cannot decide a loan

- **WHEN** an Anggota calls a loan decision endpoint
- **THEN** the response is `403`
