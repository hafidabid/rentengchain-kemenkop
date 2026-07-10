## Why

Three RantaiRenteng contracts are already deployed on Base Sepolia and are a *tracking-only*
ledger: they never custody or move funds, they record privacy-safe audit anchors that produce a
real, clickable testnet trail. Every demo flow except pure UI needs a backend relayer that can
(a) mint a custodial wallet as a member's on-chain identity on KYC approval, and (b) submit
contract transactions on members' behalf with zero user gas. This change builds that shared
web3 layer so the flow changes only have to call typed methods, not deal with viem, salting, or
gas.

## What Changes

- Add a `viem`-based on-chain module configured for Base Sepolia (chain 84532,
  `https://sepolia.base.org`) with a master/relayer account loaded from env, holding gas and
  signing every transaction.
- Add a custodial-wallet service that generates a fresh EVM keypair, stores the address on the
  member and the private key in the env-encryptable `encrypted_privkey` column, and never
  exposes keys.
- Add a typed contract client for the three deployed contracts (`TanggungRentengEscrow`,
  `RRParticipationToken`, `RRLoanPosition`) with helpers for the methods the flows use:
  `registerMember`, `recordSavings`, `createLoan`, `recordScreening`, `approveLoan`,
  `disburseLoan`, `recordRepayment`, `applySocialFund`, `activateRenteng`, `repayTalangan`,
  `fileAppeal`, `resolveAppeal`.
- Enforce the privacy rule: submit only salted hashes (`memberHash`, `groupId`,
  `inviteCodeHash`, `reasonHash`, `paramsHash`) computed with a per-coop secret salt; never send
  raw PII on-chain.
- Persist every submitted `txHash`, wait for a receipt, and return the hash so callers can
  derive an explorer link. Handle a stuck/failed tx without crashing the flow (surface an error;
  demo-shallow).

## Capabilities

### New Capabilities

- `custodial-wallet`: backend-generated one-wallet-per-member EVM identity, address stored on
  the member, private key stored env-encryptable and never served.
- `onchain-ledger`: a viem relayer + typed contract client that submits tracking-ledger
  transactions on Base Sepolia using salted hashes, returns real tx hashes, and never custodies
  funds.

### Modified Capabilities

<!-- none; the encrypted_privkey/wallet_address columns were added by add-backend-foundation -->

## Impact

- New backend module `web3/` (relayer service, wallet service, contract client, ABIs copied
  from `foundry/` build artifacts).
- New dependencies: `viem`.
- New env: `BASE_RPC_URL`, `RELAYER_PRIVATE_KEY`, `RELAYER_ADDRESS`, contract addresses, coop
  hash salt, explorer base URL.
- Depends on `add-backend-foundation` (member schema + config). Blocks the four flow changes.
- Live-demo dependency: the relayer account must stay funded with Base Sepolia gas.
