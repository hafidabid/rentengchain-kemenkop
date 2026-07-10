## ADDED Requirements

### Requirement: Mobile-first Anggota surface at the root route

The system SHALL serve the Anggota (member) surface at route `/`, rendered mobile-first, and SHALL
require an authenticated member session. The surface SHALL reuse the existing mockup components and
the Warm Coral aesthetic (`#F06A6A` / `#E5544F` / `#FAF9F8` / `#1E1F21`).

#### Scenario: Unauthenticated visitor is sent to login

- **WHEN** a visitor with no valid session opens `/`
- **THEN** the surface presents a login screen and does not reveal member data

#### Scenario: Authenticated member sees their surface at root

- **WHEN** a member logs in successfully
- **THEN** the app routes them to `/` and renders the mobile-first Anggota surface

### Requirement: Member sees their own profile and minted wallet address

The system SHALL display the authenticated member's profile from the backend, including their
custodial `walletAddress` once KYC has been approved (Flow ①).

#### Scenario: Approved member sees a wallet address

- **WHEN** an approved member views their profile
- **THEN** the surface shows their `walletAddress` sourced from the backend

### Requirement: Simulated-QRIS savings with a clickable on-chain link

The system SHALL let a member pay a simpanan via a simulated-QRIS confirmation. On confirmation the
surface SHALL call the backend savings endpoint and render the returned `txLink` as a clickable
Base Sepolia explorer link (Flow ④).

#### Scenario: Confirming a savings payment reveals a clickable txLink

- **WHEN** a member confirms a simulated-QRIS simpanan payment
- **THEN** the surface calls the savings endpoint and renders the returned `txLink` as a clickable link to the on-chain transaction

### Requirement: Loan application shows the AI flag and allows sanggah

The system SHALL let a member apply for a loan and display the returned AI flag
(`HIJAU|KUNING|MERAH`) with its reasons. When the flag is `MERAH`, the surface SHALL let the member
file a `sanggah` (appeal) that is submitted to the backend (Flow ②).

#### Scenario: A MERAH loan can be appealed

- **WHEN** a member submits a loan application that returns `flagAi: "MERAH"` with reasons
- **THEN** the surface displays the flag and reasons and offers a `sanggah` action that submits the appeal to the backend

#### Scenario: A non-MERAH result shows the flag without an appeal prompt

- **WHEN** a loan application returns `flagAi: "HIJAU"` or `"KUNING"`
- **THEN** the surface shows the flag and reasons and does not force a `sanggah` step
