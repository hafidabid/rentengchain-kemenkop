# RantaiRenteng Chain

Foundry implementation of the RantaiRenteng tracking-only ledger represented by the UI. The contracts never custody or transfer real funds. Rupiah amounts are immutable accounting records, while QRIS/cash settlement remains off-chain.

## Contracts

- `TanggungRentengEscrow`: canonical business state machine for members, groups, savings, loans, hardship, social fund, renteng, sanctions, appeals, screening, and score events.
- `RRParticipationToken`: non-transferable ERC20 accounting units minted when savings or repayments are recorded.
- `RRLoanPosition`: non-transferable ERC1155 receipt containing the canonical loan and current-installment statuses.

All contracts are intentionally non-upgradeable for the hackathon. `AccessControl` and `Pausable` provide operational controls without proxy complexity. The Ponder indexer is outside this build; a future NestJS projection may replay the rich contract events into PostgreSQL and dashboard aggregates.

## Requirements

- Foundry with Solidity 0.8.24
- OpenZeppelin Contracts 5.4.0 (pinned under `lib/`)

On this machine, use the explicit executable path if `forge` is not on `PATH`:

```powershell
& 'C:\Users\willi\.foundry\bin\forge.exe' build
& 'C:\Users\willi\.foundry\bin\forge.exe' test -vv
```

## Deployment

Copy `.env.example` to `.env` and provide testnet values. For atomic role wiring, `PRIVATE_KEY` must correspond to `ADMIN_ADDRESS`.

```powershell
& 'C:\Users\willi\.foundry\bin\forge.exe' script script/Deploy.s.sol:Deploy --rpc-url $env:RPC_URL --broadcast
```

Deployment creates all three contracts and grants each representation contract's `LEDGER_ROLE` to `TanggungRentengEscrow`. The backend address receives `RELAYER_ROLE`; the admin initially receives `ADMIN_ROLE` and `KOPERASI_ROLE`.

## Integration rules

- Create `memberHash` off-chain using a per-cooperative secret salt. Never hash an unsalted NIK because its small search space makes it reversible by enumeration.
- Never submit names, NIKs, phone numbers, addresses, KTP images, invitation codes, or appeal text. Submit salted hashes only.
- Include the screening inputs, model/version information, and consent proof in the document committed by `paramsHash`.
- Treat emitted events as the backend integration contract. Final scores and dashboard aggregates are derived projections, not financial balances.
- Events can be replayed by transaction log order (`blockNumber`, `transactionIndex`, `logIndex`) when the backend projection is implemented.

## Test coverage

The suite covers registration/group invitation, savings, timely repayment and loan closure, hardship/social-fund handling, insufficient-fund restructuring, annual hardship quota, renteng activation and gates, talangan repayment, sanctions, appeals, roles, pause behavior, non-transferability, installment schedules, and fuzzed tenors/repayment counts.

## Scope note

Attendance, KYC queues, dormant status, DSR/capacity, social references, actual payment processing, notifications, and cooperative dashboard storage remain off-chain. The chain records only privacy-safe audit anchors and the state required to enforce loan/renteng gates.
