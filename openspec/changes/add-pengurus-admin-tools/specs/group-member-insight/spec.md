## ADDED Requirements

### Requirement: Member detail within group management

The system SHALL provide, for a Pengurus, a member detail view containing the member's
profile, wallet address, savings balances, and loans, retrievable by member id.

#### Scenario: Clicking a member reveals their detail

- **WHEN** a Pengurus opens a member from Kelola Kelompok
- **THEN** the response includes the member's profile, wallet, savings balances, and loans

### Requirement: Member tanggung-renteng history

The system SHALL expose a member's tanggung-renteng history — the bailout/talangan events
affecting that member's loans — ordered newest first.

#### Scenario: Renteng history is listed for a member

- **WHEN** a Pengurus views a member who has been bailed out
- **THEN** the detail includes their renteng history entries (loan, event, amount/period, timestamp)

#### Scenario: Member with no renteng history

- **WHEN** a Pengurus views a member never involved in a bailout
- **THEN** the renteng history is an empty list rather than an error
