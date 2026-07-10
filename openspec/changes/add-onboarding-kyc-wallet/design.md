## Context

The foundation change already models members with a `statusKyc` field (`Requested|Approved|
Rejected`), a nullable `walletAddress`, JWT auth with a Pengurus role, and an append-only audit
log. The web3 change already provides `WalletService.generate()` and a typed
`registerMember(memberHash, koperasiId, wallet)` call on the deployed Base Sepolia escrow, plus
the salted-hashing helper. This change is pure orchestration: it sequences those pieces into the
KYC approval beat. Ira is the demo subject, seeded as `Requested` with a pre-seeded KTP URL.

## Goals / Non-Goals

**Goals:**
- A single Pengurus "Approve" action that atomically flips KYC status, mints a wallet, anchors
  registration on-chain, and logs the action.
- The minted checksummed `walletAddress` is immediately readable on both surfaces.

**Non-Goals:**
- No S3 / real KTP upload (pre-seeded URL only).
- No liveness/selfie/OCR verification — approval is a Pengurus judgement call.
- No deep reject workflow (appeals, re-submission loops) — reject just sets status + logs.

## Decisions

- **Approval order**: flip status → generate wallet → persist address → submit `registerMember`
  → append audit. The DB write of the address happens before the on-chain call so a slow/failed
  tx still leaves Ira with a visible wallet; the audit entry records the resulting `txHash`.
- **Idempotency**: if a member already has a `walletAddress`, approval does not re-mint (delegated
  to `custodial-wallet`'s own guard); re-approving is a no-op beyond ensuring `Approved` status.
- **koperasiId** for `registerMember` is the salted group/koperasi hash from the hashing helper,
  consistent with the on-chain privacy rule; `memberHash` is derived from Ira's NIK + coop salt.
- **Visibility**: no new read endpoints are needed — the foundation's member read already
  serves `walletAddress`; both surfaces just re-fetch after approval.

## Risks / Trade-offs

- **Partial failure**: wallet minted but `registerMember` reverts/times out. Mitigation: address
  is already persisted and visible; the audit entry marks the on-chain step pending/failed and
  it can be retried. Acceptable for a happy-path demo.
- **Live testnet latency** on approval could delay the on-chain confirmation on stage; the
  address appears immediately regardless (inherited relayer behavior returns the hash without
  blocking).
- Approving without real identity checks is intentionally shallow for the demo and noted as out
  of scope.
