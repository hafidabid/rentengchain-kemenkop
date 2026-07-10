## ADDED Requirements

### Requirement: Member may file a sanggah against a MERAH flag

The system SHALL let an Anggota file an appeal (`sanggah`) on their own loan via
`POST /api/loans/sanggah/:id` when `flagAi = MERAH`. The system SHALL store `sanggahAlasan`
off-chain, set `isSanggah = true`, and anchor the appeal on-chain via `fileAppeal(loanId,
reasonHash)` where `reasonHash` is a salted hash of the appeal text. The raw appeal text SHALL
NEVER be submitted on-chain.

#### Scenario: Member appeals a red-flagged loan

- **WHEN** an Anggota files a `sanggah` on their `MERAH`-flagged loan
- **THEN** `isSanggah` becomes true, `sanggahAlasan` is stored off-chain, and a `fileAppeal` transaction carrying only a `reasonHash` is submitted

#### Scenario: Appeal on a non-red loan is rejected

- **WHEN** a member files a `sanggah` on a loan whose `flagAi` is not `MERAH`
- **THEN** the response is a validation error and no appeal is recorded

### Requirement: Pengurus sees the appeal beside the AI reasons and decides

The system SHALL surface the appeal (`sanggahAlasan`) alongside the AI `flagAlasan` in the
Pengurus loan review. When a Pengurus resolves an appealed loan, the system SHALL call
`resolveAppeal(loanId, accepted)` on-chain (`accepted = true` on approval), persist the final
loan `status`, and append an audit entry.

#### Scenario: Pengurus review shows appeal and AI reasons together

- **WHEN** a Pengurus reads an appealed loan
- **THEN** the response includes both `sanggahAlasan` and the AI `flagAlasan`

#### Scenario: Pengurus resolves an appealed loan

- **WHEN** a Pengurus approves a loan that carries a `sanggah`
- **THEN** `resolveAppeal(loanId, true)` is submitted on-chain, the loan `status` persists as `Disetujui`, and an audit entry is appended
