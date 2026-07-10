## Context

The contracts in `foundry/` are deployed and immutable for the hackathon. Their README is
explicit: they are a tracking-only ledger, funds settle off-chain (QRIS/cash), and the backend
must submit *only salted hashes*, never raw NIK/name/phone/address/KTP/invite/appeal text. Roles
on-chain: `RELAYER_ROLE` (backend) records savings/repayments/disbursements; `KOPERASI_ROLE`
approves/defers/screens/resolves-appeals; `ADMIN_ROLE` pauses. The deployment already granted
`RELAYER_ROLE` to the backend relayer address and `KOPERASI_ROLE`/`ADMIN_ROLE` to admin.

## Goals / Non-Goals

**Goals:**
- One place that owns viem, the relayer account, salting, and tx submission.
- Typed, flow-friendly methods returning a real `txHash` that resolves to an explorer link.
- Custodial wallet minting that later flows trigger on KYC approval.

**Non-Goals:**
- No real fund transfers, no escrow-holds-balance semantics (the contract is tracking-only).
- No hardened key custody (KMS/HSM) — `encrypted_privkey` is env-encryptable, wrapped later.
- No Ponder/indexer; reads come from Postgres projections the flows maintain, not chain reads.

## Decisions

- **memberHash / groupId salting**: `keccak256(salt || nik)` style, salt from
  `COOP_HASH_SALT` env, computed in one helper so every flow hashes identically. The same
  member always maps to the same on-chain hash.
- **ABIs**: copy the compiled ABIs from `foundry/out/*.json` into `backend/src/web3/abis/` and
  type the client with viem's `getContract`. Contract addresses come from env (defaults = the
  deployed Base Sepolia addresses).
- **Which role signs what**: the single relayer account is granted both `RELAYER_ROLE` and (per
  deployment) the koperasi/admin capabilities used in the demo, so one signer covers all flow
  calls. If a method reverts on role, surface it — do not silently swallow.
- **Tx lifecycle**: submit → store `txHash` immediately → `waitForTransactionReceipt` with a
  short timeout → mark success/failure. Callers get the hash even if confirmation is slow, so
  the explorer link appears without blocking the UI.
- **Idempotency for the demo**: registering an already-registered member or re-recording a
  seeded savings should not hard-crash; catch the known revert and continue (demo-shallow).

## Risks / Trade-offs

- **Live testnet fragility** is the top demo risk: RPC hiccups or an unfunded relayer break
  on-chain calls. Mitigation: keep the relayer funded, short receipt timeout, and return the
  hash optimistically; flows that are safety-critical (Ani's screening) have seeded fallbacks in
  their own change.
- Storing private keys (even encrypted) is accepted for this phase per `claude0.md` §4; the
  env-encryptable column keeps a later KMS wrap a no-schema-change upgrade.
- One shared signer is a single point of nonce contention; acceptable for a single-operator
  demo, noted for future work.
