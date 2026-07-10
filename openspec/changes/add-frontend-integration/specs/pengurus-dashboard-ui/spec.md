## ADDED Requirements

### Requirement: Desktop Pengurus dashboard at /laman-pengurus

The system SHALL serve the Pengurus (admin) surface at route `/laman-pengurus`, rendered for
desktop, and SHALL require an authenticated Pengurus-role session. An Anggota session SHALL NOT be
able to open this surface.

#### Scenario: Pengurus reaches the dashboard

- **WHEN** a user with the Pengurus role logs in
- **THEN** the app grants access to `/laman-pengurus` and renders the desktop dashboard

#### Scenario: Non-Pengurus is denied the dashboard

- **WHEN** an authenticated Anggota navigates to `/laman-pengurus`
- **THEN** the surface denies access and does not render Pengurus controls

### Requirement: KYC review reveals the minted wallet address

The system SHALL present the KYC queue and let a Pengurus approve or reject a member. On approval
the surface SHALL display the member's newly minted custodial `walletAddress` returned by the
backend (Flow ①).

#### Scenario: Approving KYC shows the minted wallet

- **WHEN** a Pengurus approves a pending member's KYC
- **THEN** the surface reflects the approval and displays the member's minted `walletAddress`

### Requirement: Loan and appeal review with AI recommendation

The system SHALL let a Pengurus review loans with the AI recommendation (score, flag, reasons) and
resolve appeals/`sanggah` filed by members (Flow ②).

#### Scenario: Reviewing a flagged loan with an appeal

- **WHEN** a Pengurus opens a loan that carries an AI flag and a member `sanggah`
- **THEN** the surface shows the AI score, flag, and reasons alongside the appeal and offers actions to resolve it

### Requirement: Renteng bailout trigger

The system SHALL let a Pengurus trigger a tanggung-renteng bailout for a defaulting loan and SHALL
reflect the resulting loan and `kasSosial` state returned by the backend (Flow ③).

#### Scenario: Triggering a bailout updates the surface state

- **WHEN** a Pengurus triggers a renteng bailout on an eligible loan
- **THEN** the surface reflects the updated loan status and the changed `kasSosial` balance

### Requirement: Transparent audit-log ledger with clickable tx links

The system SHALL present the audit-log/ledger, and each entry associated with an on-chain
transaction SHALL render a clickable `txLink` to the Base Sepolia explorer. A seeded, read-only
reports view is sufficient.

#### Scenario: Audit entries link to on-chain transactions

- **WHEN** a Pengurus opens the audit-log/ledger view
- **THEN** entries with a transaction render a clickable `txLink` to the on-chain record
