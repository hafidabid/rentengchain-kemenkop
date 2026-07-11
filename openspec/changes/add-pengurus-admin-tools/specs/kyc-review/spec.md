## ADDED Requirements

### Requirement: KTP document visible in the KYC queue

The system SHALL expose each applicant's uploaded KTP URL to the Pengurus so the queue can
display or link to the document during review.

#### Scenario: Reviewer sees the uploaded KTP

- **WHEN** a Pengurus opens a Requested member in the Antre KYC queue
- **THEN** the member's `ktpUrl` is available and the queue renders a viewable KTP (image or link), or a clear "no document" state when absent

### Requirement: Temporary password issued on approval

The system SHALL generate a random temporary password when a member's KYC is approved, store
only its hash, and return the plaintext exactly once in the approval response so the Pengurus
can hand credentials to the member. The plaintext SHALL NOT be persisted or retrievable later.

#### Scenario: Approval returns a one-time credential

- **WHEN** a Pengurus approves a member who has no usable password
- **THEN** the response includes a one-time `tempPassword`, the member can subsequently log in with it, and the stored record contains only the password hash

#### Scenario: Credential is shown once in the dashboard

- **WHEN** the approval response is received by the admin dashboard
- **THEN** the temporary password is displayed once (copyable) alongside the member's identifier and is not re-fetchable afterward

### Requirement: Credential reset

The system SHALL allow a Pengurus to regenerate a member's temporary password, returning a new
one-time plaintext and replacing the stored hash.

#### Scenario: Reset issues a new one-time password

- **WHEN** a Pengurus resets a member's password
- **THEN** a new one-time `tempPassword` is returned and the previous password no longer works
