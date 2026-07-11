## ADDED Requirements

### Requirement: Persisted loan decision history

The system SHALL record each loan decision (approve, reject/hold, appeal resolution) as an
immutable history entry with the decision, the acting Pengurus, an optional note, and a
timestamp, and SHALL expose the history for a loan to the Pengurus.

#### Scenario: Decisions accumulate a timeline

- **WHEN** a Pengurus takes a decision on a loan and the loan history is read
- **THEN** the history lists each prior decision with its actor, note, and timestamp, newest first

### Requirement: Pengurus note surfaced to the anggota

The system SHALL let a Pengurus attach a note when rejecting/holding a loan or resolving a
`sanggah`, persist it on the loan, and make it readable by the loan's owner (anggota).

#### Scenario: Rejection note reaches the member

- **WHEN** a Pengurus rejects or holds a loan with a note
- **THEN** the note is stored on the loan and returned when the owning anggota reads that loan

#### Scenario: Appeal resolution note reaches the member

- **WHEN** a Pengurus resolves a `sanggah` with a note
- **THEN** the note is recorded in the decision history and visible to the anggota on that loan
