## Context

Loans and screening exist as static fields in the mockup (`skorAi`, `flagAi`, `flagAlasan`,
`isSanggah`, `sanggahAlasan`). The deployed `TanggungRentengEscrow` already exposes
`createLoan`, `recordScreening`, `approveLoan`, `deferLoan`, `fileAppeal`, and `resolveAppeal`
(`KOPERASI_ROLE` for approve/defer/resolve; the relayer holds the roles it needs). The privacy
rule from `add-web3-relayer` requires only salted hashes on-chain — the appeal text must be
hashed to a `reasonHash`, and the screening inputs committed as a `paramsHash`. Gemini is
reached through `@google/genai`; the demo must survive a flaky network.

## Goals / Non-Goals

**Goals:**
- A loan that carries a real, persisted `skorAi`/`flagAi`/`flagAlasan` produced by a live model
  call, mirrored on-chain.
- A working `sanggah` → Pengurus-decision loop where the human sees the AI reasons and the
  appeal side by side, and the decision persists.
- Demo safety: Ani's `MERAH` path is deterministic even offline.

**Non-Goals:**
- No interest/`jasa` math — use the flat seeded `cicilanBulanan`.
- No disbursement/escrow-hold semantics here (loan reaching `Cair`/disburse is owned by later
  flows; this change stops at the Pengurus decision).
- No re-screening loop or model evaluation — one screen per application.

## Decisions

- **Screening runs synchronously on apply.** `POST /api/loans/apply` creates the loan
  (`Diajukan`) → `createLoan` on-chain → Gemini EWS → persist score → `recordScreening`
  on-chain. If any on-chain step is slow, the loan + score still persist and return (the tx hash
  resolves later), so the UI is never blocked.
- **Structured output.** The Gemini call requests strict JSON (`skorAi`,`flagAi`,`flagAlasan`)
  via a response schema; a parse/validation guard rejects malformed output and triggers the
  fallback. `flagAi` maps to the contract `AIFlag` enum (HIJAU=0/KUNING=1/MERAH=2).
- **Seeded fallback keyed by persona.** A small fixture maps Ani → `{ skorAi: 38, flagAi:
  'MERAH', flagAlasan: [...] }` matching the mockup seed. The fallback is used on any Gemini
  error, timeout, or invalid JSON — logged as `fallback_used` so the demo operator knows.
- **Appeal hashing.** `sanggahAlasan` text is stored off-chain on the loan; only
  `reasonHash = salted(sanggahAlasan)` is submitted via `fileAppeal`. `resolveAppeal(loanId,
  accepted=true)` is called when the Pengurus approves after an appeal; reject/hold set the loan
  to `Ditunda`/`Mangkir`/`Disetujui` accordingly.
- **Every decision writes an audit entry** (aktor = Pengurus, aksi = the transition, detail
  referencing the loan + any `txHash`).

## Risks / Trade-offs

- **Gemini latency/availability** is the top risk; mitigated by the seeded fallback and a short
  timeout. Trade-off: a fallback score is not "live", but the operator is told, and only Ani has
  one.
- **Model drift**: pinning `GEMINI_MODEL` via env avoids a stale hardcoded name; the prompt asks
  for JSON-only to reduce parse failures.
- **On-chain enum/argument mismatch** would revert `recordScreening`; the contract client types
  the enum, and a revert surfaces as an error rather than a silent skip.
