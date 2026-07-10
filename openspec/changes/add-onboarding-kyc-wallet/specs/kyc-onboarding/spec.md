## ADDED Requirements

### Requirement: Member KYC submission

The system SHALL accept a KYC submission containing the member profile (nama, nik, noHp, alamat,
pekerjaan, peran) and a pre-seeded `ktpUrl`, and persist a member with `statusKyc: Requested` and
a null `walletAddress`. The system SHALL reject a submission whose NIK already exists.

#### Scenario: New submission is recorded as Requested

- **WHEN** a prospective member submits valid KYC data to `POST /api/kyc/submit`
- **THEN** a member is persisted with `statusKyc: "Requested"` and `walletAddress` null

#### Scenario: Duplicate NIK is rejected

- **WHEN** a KYC submission carries a NIK that already exists
- **THEN** the response is a `4xx` error and no new member is created

### Requirement: Pengurus approval mints a custodial wallet and anchors registration on-chain

The system SHALL let only a Pengurus approve a `Requested` member. On approval the system SHALL
set `statusKyc: Approved`, generate a custodial wallet, persist the checksummed `walletAddress`,
and submit `registerMember(memberHash, koperasiId, wallet)` to the deployed Base Sepolia escrow
using salted hashes, capturing the resulting `txHash`.

#### Scenario: Approval produces a persisted checksummed wallet

- **WHEN** a Pengurus approves Ira (seeded as `Requested`) via `POST /api/kyc/approve/:id`
- **THEN** Ira's `statusKyc` becomes `Approved` and her `walletAddress` is a persisted, valid checksummed Base Sepolia address

#### Scenario: Approval anchors registration on-chain

- **WHEN** the approval completes
- **THEN** a `registerMember` transaction is submitted from the relayer and its `txHash` resolves on the Base Sepolia explorer

#### Scenario: Only Pengurus may approve

- **WHEN** a member with role `Anggota` calls `POST /api/kyc/approve/:id`
- **THEN** the response is `403` and no wallet is minted

#### Scenario: Re-approving does not re-mint

- **WHEN** a member that already has a `walletAddress` is approved again
- **THEN** the existing `walletAddress` is retained and no second wallet is generated

### Requirement: Approval and rejection are audited

The system SHALL append an audit entry for each KYC decision. An approval entry SHALL include the
resulting on-chain `txHash`; a rejection SHALL set `statusKyc: Rejected` and mint no wallet.

#### Scenario: Approval writes an audit entry with the tx hash

- **WHEN** a Pengurus approves a member
- **THEN** an audit entry is appended with `aksi: "KYC_APPROVED"` and a `detail`/`txHash` referencing the on-chain registration

#### Scenario: Rejection sets status and logs without a wallet

- **WHEN** a Pengurus calls `POST /api/kyc/reject/:id`
- **THEN** the member's `statusKyc` becomes `Rejected`, no wallet is generated, and an audit entry is appended

### Requirement: Minted wallet is visible on both surfaces

The system SHALL make the approved member's `walletAddress` readable by both the Anggota surface
(the member's own record) and the Pengurus surface (the member detail view) with no additional
endpoint.

#### Scenario: Address visible to member and Pengurus after approval

- **WHEN** an approved member's record is read via `GET /api/members/me` or `GET /api/members/:id`
- **THEN** the response includes the persisted checksummed `walletAddress`
