## ADDED Requirements

### Requirement: Group record with bridge-resolved membership

The system SHALL persist koperasi groups and a `member_groups` bridge table. When a group is
read, the system SHALL assemble `anggotaIds[]` from the bridge rather than storing it as a
column, and SHALL return camelCase fields including `ketuaId`, `plafonMaks`, `jadwalPertemuan`,
`kehadiranRate`, `kasSosial`, `reputasiKomunitas`, and `kodeUndangan`.

#### Scenario: Group read assembles member ids from the bridge

- **WHEN** a client reads the seeded "Mekar Wangi Srikandi" group via `GET /api/groups/:id`
- **THEN** the response includes `anggotaIds` containing the ids of Sri, Deni, and Ani, resolved from `member_groups`

#### Scenario: Group exposes social fund balance

- **WHEN** a group is read
- **THEN** the response includes `kasSosial` reflecting the persisted social-fund balance

### Requirement: Group listing for Pengurus

The system SHALL let a Pengurus list all groups.

#### Scenario: Pengurus lists groups

- **WHEN** a Pengurus calls `GET /api/groups`
- **THEN** the response includes the seeded group with its `kodeUndangan`
