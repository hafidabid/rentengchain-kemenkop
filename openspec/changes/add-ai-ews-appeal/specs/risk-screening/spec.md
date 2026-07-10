## ADDED Requirements

### Requirement: Live Gemini EWS produces a structured risk score

On loan application the system SHALL call the Gemini EWS via `@google/genai` (using a current,
env-configured model id) with the member's savings habits, the group's `kehadiranRate`, and the
loan `tujuan`, and SHALL obtain structured JSON containing `skorAi` (0–100), `flagAi`
(`HIJAU|KUNING|MERAH`), and `flagAlasan` (`string[]`). The system SHALL persist this result on
the loan.

#### Scenario: Screening yields a valid structured result

- **WHEN** a loan application is submitted and the model returns valid JSON
- **THEN** the loan is persisted with a `skorAi` in 0–100, a `flagAi` of `HIJAU`/`KUNING`/`MERAH`, and a non-empty `flagAlasan`

### Requirement: Seeded fallback protects the demo

The system SHALL attempt the real Gemini call first, and on any error, timeout, or invalid JSON
SHALL use a seeded fallback result. Persona Ani SHALL have a deterministic fallback of
`flagAi = MERAH` (skor 38 with seeded reasons). The system SHALL log that a fallback was used.

#### Scenario: Gemini failure falls back to seeded result

- **WHEN** the Gemini call fails or returns malformed output for Ani's application
- **THEN** the loan is persisted with the seeded `MERAH` result and a `fallback_used` log entry is emitted

### Requirement: Screening result is anchored on-chain

The system SHALL record the screening on-chain via `recordScreening(loanId, skorAi, flagAi,
paramsHash)`, mapping `flagAi` to the contract `AIFlag` enum and committing the screening inputs
as a salted `paramsHash`, and SHALL persist the returned `txHash`.

#### Scenario: Screening writes a tracking anchor

- **WHEN** a screening result is persisted
- **THEN** a `recordScreening` transaction is submitted with only `skorAi`, the `flagAi` enum, and a `paramsHash`, and its `txHash` is stored
