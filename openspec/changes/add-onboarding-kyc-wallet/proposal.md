## Why

Flow ① is the opening beat of the demo: a brand-new member walks through onboarding and, on the
spot, receives a real on-chain identity. Ira is seeded as `statusKyc: Requested`; the story is
that she submits KYC, a Pengurus approves her, and the backend immediately mints her a real Base
Sepolia custodial wallet and anchors her registration on-chain. This change wires the shared
foundation and web3 relayer into a single, believable KYC-to-wallet flow, and closes the missing
piece from the mockup — there was no path from `Requested` to a persisted `walletAddress`.

## What Changes

- Add a KYC submission endpoint so a prospective member's profile + a pre-seeded KTP URL is
  recorded with `statusKyc: Requested`.
- Add Pengurus-only approve/reject endpoints. On **approve**, the backend: sets
  `statusKyc: Approved`, generates a custodial wallet (via `custodial-wallet`), persists the
  checksummed `walletAddress`, calls `registerMember(memberHash, koperasiId, wallet)` on the
  deployed escrow (via `onchain-ledger`), and appends an audit entry. On **reject**, it sets
  `statusKyc: Rejected` and appends an audit entry (no wallet minted).
- Surface the resulting `walletAddress` on both surfaces (Anggota profile + Pengurus member
  view) so a judge can see the freshly minted, checksummed address.
- KTP is a **pre-seeded URL** — no S3 upload wiring this phase (decision locked in `claude0.md`).

## Capabilities

### New Capabilities

- `kyc-onboarding`: the member-facing KYC submission plus the Pengurus approval decision that
  triggers custodial wallet minting and on-chain `registerMember`, moving a member from
  `Requested` to `Approved` with a persisted, checksummed testnet wallet address.

### Modified Capabilities

<!-- none; this change consumes custodial-wallet and onchain-ledger (from add-web3-relayer)
     and member-registry/authentication/audit-log (from add-backend-foundation); it does not
     change their requirements -->

## Impact

- New backend module `kyc/` (controller + service) orchestrating member-registry, custodial-
  wallet, onchain-ledger, and audit-log.
- New endpoints: `POST /api/kyc/submit`, `POST /api/kyc/approve/:id` (Pengurus),
  `POST /api/kyc/reject/:id` (Pengurus).
- Depends on `add-backend-foundation` (member schema, JWT/role auth, audit-log) and
  `add-web3-relayer` (wallet generation + `registerMember` on the escrow). Consumes those
  capabilities; does not redefine them.
- Live-demo dependency inherited from the relayer: the relayer account must be funded so
  `registerMember` confirms during the demo.
