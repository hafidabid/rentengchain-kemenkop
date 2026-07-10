# Security checklist

Before any production deployment:

- Obtain an independent Solidity audit and threat-model the relayer/backend compromise path.
- Replace admin EOAs with an appropriately configured multisig and use separate relayer keys.
- Exercise pause, relayer rotation, cooperative-role rotation, and key-loss procedures on testnet.
- Confirm no raw or predictably hashed PII appears in calldata, events, metadata, scripts, or monitoring logs.
- Validate every `paramsHash` commits to consent evidence, model/version, feature values, and decision parameters.
- Cap backend-submitted tenor at the contract maximum (60); loan creation emits a bounded schedule loop.
- Paginate member lists off-chain. Membership uses mappings and never iterates over an unbounded group array.
- Monitor role grants/revocations, pauses, sanctions, screening changes, renteng activations, and failed relayer calls.
- Reconcile off-chain QRIS/cash receipts with on-chain records and require idempotency keys in the relayer service.
- Wait for a chain-appropriate confirmation depth before treating events as final; rebuild projections after reorgs.
- Test timestamp/grace-boundary behavior on the selected chain. Block timestamps are suitable for day-scale deadlines, not exact wall-clock settlement.
- Review token/position semantics with counsel: they are non-transferable records and must never be marketed as money, deposits, or investment claims.
- Verify bytecode, constructor arguments, compiler version, optimizer settings, and source code on the testnet explorer.
- Run `forge test`, invariant tests, static analysis, and deployment rehearsals again against the exact release commit.

`ReentrancyGuard` protects the repayment path that invokes the token contract. All external mutations are role-gated or restricted to the loan member's registered wallet, and representation-token transfers/approvals always revert.
