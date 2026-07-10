## ADDED Requirements

### Requirement: Seeded-account login issues a role-bearing JWT

The system SHALL authenticate a member from a seeded account using an identifier and password,
returning a signed JWT whose claims include the member id (`sub`) and a role of `Anggota` or
`Pengurus`. Passwords SHALL be stored only as a bcrypt/Argon2 hash and verified against that
hash; plaintext passwords SHALL never be stored or logged.

#### Scenario: Valid credentials return a JWT

- **WHEN** a seeded Pengurus submits their correct identifier and password to `POST /api/auth/login`
- **THEN** the response is `200` with a JWT whose decoded claims contain the member's id and `role: "Pengurus"`

#### Scenario: Wrong password is rejected

- **WHEN** a valid identifier is submitted with an incorrect password
- **THEN** the response is `401` and no JWT is issued

### Requirement: Role guard gates Pengurus-only endpoints

The system SHALL protect Pengurus-only endpoints with a guard that reads the JWT role claim and
rejects any authenticated member whose role is not `Pengurus`. The business attribute `peran`
SHALL NOT be used for authorization.

#### Scenario: Anggota is blocked from a Pengurus route

- **WHEN** a member with role `Anggota` calls a `@Roles('Pengurus')` endpoint with a valid JWT
- **THEN** the response is `403`

#### Scenario: Missing or invalid token is rejected

- **WHEN** a request to a protected endpoint carries no JWT or an invalid one
- **THEN** the response is `401`

### Requirement: Authenticated identity lookup

The system SHALL expose the authenticated member's own profile and role.

#### Scenario: me endpoint returns caller identity

- **WHEN** an authenticated member calls `GET /api/auth/me`
- **THEN** the response contains their camelCase profile and their `role`, and never exposes `passwordHash` or `encryptedPrivkey`
