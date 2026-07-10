## ADDED Requirements

### Requirement: Canonical member record with camelCase mapping

The system SHALL persist members in a snake_case PostgreSQL table and serve them to clients in
the camelCase shape defined by the mockup (`no_hp`→`noHp`, `status_kyc`→`statusKyc`,
`wallet_address`→`walletAddress`, `simpanan_*`→`simpanan*`, etc.). The record SHALL include
profile fields, `peran` (`penabung|peminjam|keduanya`), `statusKyc`
(`Requested|Approved|Rejected`), `skorKeanggotaan` (0–100), the three savings balances,
`walletAddress`, and dormancy/uzur flags.

#### Scenario: Member read returns camelCase fields

- **WHEN** a client reads a member via `GET /api/members/:id`
- **THEN** the response uses camelCase keys matching the mockup `Member` interface and includes `walletAddress` (which MAY be null before wallet mint)

### Requirement: Sensitive columns are never serialized

The system SHALL never include `passwordHash` or `encryptedPrivkey` in any API response body.

#### Scenario: Member payload excludes secrets

- **WHEN** any member is returned by any endpoint
- **THEN** the response contains no `passwordHash` and no `encryptedPrivkey` field

### Requirement: Member listing and self lookup

The system SHALL let a Pengurus list all members and let an Anggota read only their own record.

#### Scenario: Pengurus lists members

- **WHEN** a Pengurus calls `GET /api/members`
- **THEN** the response is a list of camelCase members including at least the four seeded personas

#### Scenario: Anggota reads own record

- **WHEN** an Anggota calls `GET /api/members/me`
- **THEN** the response is their own member record and does not require Pengurus role
