## ADDED Requirements

### Requirement: Relayer submits tracking-ledger transactions with zero user gas

The system SHALL submit all contract transactions from a single master/relayer account on Base
Sepolia (chain 84532), paying gas from that account, so members never sign or pay. The system
SHALL NOT transfer or custody funds on-chain; contract calls record accounting anchors only.

#### Scenario: A flow method produces a real testnet tx hash

- **WHEN** a flow calls an on-chain-ledger method (e.g. `recordSavings`)
- **THEN** the relayer submits the transaction and returns a real `txHash` that resolves on the Base Sepolia explorer

#### Scenario: Slow confirmation still returns a hash

- **WHEN** a submitted transaction has not yet confirmed within the receipt timeout
- **THEN** the method still returns the `txHash` so the caller can derive an explorer link, and records the pending status

### Requirement: Only salted hashes are submitted on-chain

The system SHALL compute salted hashes (`memberHash`, `groupId`, `inviteCodeHash`,
`reasonHash`, `paramsHash`) from a per-coop secret salt and submit only those. Raw NIK, name,
phone, address, KTP image, invite code, and appeal text SHALL NEVER appear in calldata.

#### Scenario: Same member maps to a stable hash

- **WHEN** the hashing helper is called twice with the same member NIK and salt
- **THEN** it returns the identical `memberHash`

#### Scenario: No raw PII in calldata

- **WHEN** any contract method is built for submission
- **THEN** its arguments contain only hashes, enums, addresses, and numeric amounts — no raw PII strings

### Requirement: Typed contract client for the deployed contracts

The system SHALL expose typed methods bound to the deployed `TanggungRentengEscrow`,
`RRParticipationToken`, and `RRLoanPosition` addresses (configurable via env, defaulting to the
Base Sepolia deployment).

#### Scenario: Client targets the configured addresses

- **WHEN** the contract client is initialized
- **THEN** its escrow method calls target the address from `ADDR_ESCROW` (default `0x199812B240bf8d90dBAfB5C7E2ab79e3fAf728dE`)
