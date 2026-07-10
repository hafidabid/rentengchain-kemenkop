## ADDED Requirements

### Requirement: Record a simpanan with simulated QRIS confirmation

The system SHALL let a member record a savings deposit of type `Pokok`, `Wajib`, or `Sukarela`
via `POST /api/savings`. QRIS confirmation SHALL be simulated: the request itself confirms the
payment, marking the `saving_transaction` `PAID` with no external payment gateway. The system
SHALL increment the member's matching `simpanan_<jenis>` balance.

#### Scenario: A member records a Wajib saving

- **WHEN** a member submits `POST /api/savings` with `jenis: "Wajib"`, a positive `nominal`, and `metode: "QRIS"`
- **THEN** a `saving_transaction` row is created with status `PAID` and the member's `simpananWajib` balance increases by `nominal`

#### Scenario: Invalid nominal is rejected

- **WHEN** a savings request is submitted with a non-positive `nominal`
- **THEN** the response is `400` and no savings row is created

### Requirement: Savings are anchored on-chain with a real transaction

On confirmation, the system SHALL call `recordSavings(memberHash, jenis, nominal, metode)` on
the deployed escrow via the `onchain-ledger` capability and persist the returned `txHash` on the
saving row. The contract call SHALL record an accounting anchor only and SHALL NOT move funds.

#### Scenario: Savings produces a resolvable tx hash

- **WHEN** a savings deposit is confirmed
- **THEN** the response and the persisted row carry a `txHash` that resolves to a real Base Sepolia transaction

#### Scenario: On-chain submission failure keeps the balance

- **WHEN** the on-chain `recordSavings` submission fails
- **THEN** the saving row remains `PAID` with a null `txHash`, the balance update is retained, and the failure is surfaced to the caller

### Requirement: Savings are readable with a derived explorer link and audited

The system SHALL expose a member's savings via `GET /api/savings?memberId=` in camelCase, newest
first, deriving `txLink` from `txHash` + the configured explorer base at read time without
storing a `txLink` column. Each confirmed saving SHALL append an audit-log entry.

#### Scenario: Savings list exposes a clickable explorer link

- **WHEN** a client reads `GET /api/savings?memberId=` and a saving carries a `txHash`
- **THEN** that saving includes a `txLink` of the form `<EXPLORER_BASE_URL>/<txHash>` derived at read time

#### Scenario: Confirmed saving appears in the audit trail

- **WHEN** a savings deposit is confirmed
- **THEN** an audit-log entry is appended recording the member, the action, and the amount/jenis/txHash detail
