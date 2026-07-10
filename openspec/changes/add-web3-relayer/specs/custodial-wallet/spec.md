## ADDED Requirements

### Requirement: One custodial wallet per member

The system SHALL generate exactly one EVM keypair per member as their on-chain identity, store
the checksummed address in `members.wallet_address`, and store the private key in the
env-encryptable `members.encrypted_privkey` column. Members SHALL never hold keys or pay gas.

#### Scenario: Wallet generation persists a valid address

- **WHEN** the wallet service generates a wallet for a member
- **THEN** `walletAddress` is a valid checksummed 0x-prefixed 40-hex address and `encrypted_privkey` is populated

#### Scenario: A member is not re-minted a second wallet

- **WHEN** wallet generation is invoked for a member that already has a `walletAddress`
- **THEN** the existing address is kept and no new key is generated

### Requirement: Private keys are never exposed

The system SHALL never return `encrypted_privkey` (or any decrypted key) in an API response or
log line.

#### Scenario: Key is absent from responses

- **WHEN** any member is serialized after wallet generation
- **THEN** the payload contains `walletAddress` but no key material
