# web3 — custodial wallets + on-chain ledger

Shared web3 layer for the demo flows. Talks to the **already-deployed** RantaiRenteng
contracts on **Base Sepolia (chain 84532)** — a *tracking-only* ledger: no funds are
ever custodied or moved, each call just records a privacy-safe audit anchor that
produces a real, clickable testnet tx.

## Services (all exported by `Web3Module`)

| Service | Role |
|---|---|
| `RelayerService` | viem public/wallet clients; the single master account that pays gas and signs every tx. Read-only until a key is set. |
| `WalletService` | one custodial EVM wallet per member (`generate`, `ensureWallet`). Address persisted; key stored env-encryptable, never serialized. |
| `CryptoService` | AES-256-GCM wrap of private keys when `COOP_KEY_ENC_SECRET` is set (else `plain:` marker). |
| `HashingService` | salted, domain-separated `bytes32` hashes. **Only hashes go on-chain — never raw NIK/name/invite/appeal text.** |
| `ContractClientService` | typed escrow client. `buildCall` (offline calldata) + `submit` (relayer write → `{ txHash, status }`). |

## Environment (see `../../.env.example`)

```
BASE_RPC_URL=https://sepolia.base.org
RELAYER_PRIVATE_KEY=          # RELAYER_ROLE holder 0xd4427cFd107AdE41763df1D211E7633572dab852
ADDR_ESCROW=0x199812B240bf8d90dBAfB5C7E2ab79e3fAf728dE
ADDR_PARTICIPATION=0x1EDf5e51cFc99123cE2e98Ee9cdEA18C072dd48C
ADDR_LOANPOS=0x49D82FeDEbB676517D0FB8cA3810a0fD1654B650
COOP_HASH_SALT=               # per-cooperative secret; makes member hashes non-enumerable
COOP_KEY_ENC_SECRET=          # optional; AES-encrypt stored custodial keys
EXPLORER_BASE_URL=https://sepolia.basescan.org
RECEIPT_TIMEOUT_MS=15000
```

## Going live (relayer funding)

On-chain **writes are disabled** until `RELAYER_PRIVATE_KEY` is set. To enable them:

1. Provide the private key for `RELAYER_ROLE` address `0xd442…852`.
2. Fund that address with Base Sepolia ETH (faucet) so it can pay gas.
3. Restart — `RelayerService` logs the relayer address; `submit()` then returns real
   tx hashes that resolve at `EXPLORER_BASE_URL/tx/<hash>`.

Without a key the offline path still works and is unit-tested: wallet generation,
salted hashing, and `buildCall` calldata (asserted to contain no raw PII).

## ABIs

`abis/escrow.abi.ts` is a **hand-authored minimal ABI** covering only the methods the
flows call, transcribed from `foundry/src/TanggungRentengEscrow.sol`. Replace with the
full compiled ABI later via `forge build` (`foundry/out/`) if needed.
