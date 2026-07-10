## 1. viem relayer setup

- [ ] 1.1 Add `viem`; create a `Web3Module` with a public client + wallet client for Base Sepolia (chain 84532, `BASE_RPC_URL`)
- [ ] 1.2 Load the relayer account from `RELAYER_PRIVATE_KEY`; expose the relayer address; add a startup log of relayer address + gas balance
- [ ] 1.3 Add env config + `.env.example` entries: `BASE_RPC_URL`, `RELAYER_PRIVATE_KEY`, `RELAYER_ADDRESS`, `ADDR_ESCROW`, `ADDR_PARTICIPATION`, `ADDR_LOANPOS`, `COOP_HASH_SALT`, `EXPLORER_BASE_URL`

## 2. Contract client

- [ ] 2.1 Copy compiled ABIs from `foundry/out/` into `backend/src/web3/abis/` for the three contracts
- [ ] 2.2 Build a typed `ContractClient` (viem `getContract`) exposing the flow methods: `registerMember`, `recordSavings`, `createLoan`, `recordScreening`, `approveLoan`, `disburseLoan`, `recordRepayment`, `applySocialFund`, `activateRenteng`, `repayTalangan`, `fileAppeal`, `resolveAppeal`
- [ ] 2.3 Add a `submitTx` helper: send → persist `txHash` → `waitForTransactionReceipt` (short timeout) → return `{ txHash, status }`; catch known reverts (already-registered, etc.) without crashing

## 3. Privacy / salting

- [ ] 3.1 Add a `hashing` helper computing salted `memberHash`, `groupId`, `inviteCodeHash`, `reasonHash`, `paramsHash` from `COOP_HASH_SALT`; deterministic per input
- [ ] 3.2 Unit test: the same member NIK yields the same `memberHash`; no raw PII appears in any built calldata

## 4. Custodial wallet capability

- [ ] 4.1 `WalletService.generate()` creates a fresh EVM keypair (viem `generatePrivateKey`/`privateKeyToAccount`)
- [ ] 4.2 Persist the checksummed address to `members.wallet_address` and the (env-encryptable) key to `members.encrypted_privkey`; never return the key
- [ ] 4.3 Unit test: generated address is a valid checksummed 0x-address and the key column is populated but never serialized

## 5. Quality gates

- [ ] 5.1 `npm run build` and `npm run lint` pass
- [ ] 5.2 Integration smoke against Base Sepolia: relayer submits one no-op/idempotent tx (e.g. registerMember for a throwaway hash) and gets a real `txHash` resolving on the explorer
- [ ] 5.3 Document relayer funding + env setup in `backend/src/web3/README.md`
