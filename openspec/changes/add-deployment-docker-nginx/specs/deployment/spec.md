## ADDED Requirements

### Requirement: Containerized build of both apps

The system SHALL provide container images that build the backend (NestJS, applying database
migrations and an idempotent seed on start) and the frontend (static bundle served by nginx
with the API base URL fixed at build time), orchestrated by a production compose file.

#### Scenario: Backend container starts ready to serve

- **WHEN** the backend container starts against a reachable database
- **THEN** it applies pending migrations, seeds idempotently, and listens on its configured port

#### Scenario: Frontend container serves the SPA

- **WHEN** the frontend image is built with `VITE_API_URL` set and run
- **THEN** nginx serves the built assets and routes unknown paths to `index.html`

### Requirement: First-time init provisions HTTPS backend-first

The system SHALL provide an init script that brings up the backend and obtains its TLS
certificate before building the frontend against the now-HTTPS API and obtaining the
frontend certificate, so the frontend is always built pointing at a valid HTTPS API.

#### Scenario: Init yields two HTTPS domains

- **WHEN** the init script runs on a server whose DNS points both subdomains at it
- **THEN** the backend domain and the frontend domain each serve over HTTPS via nginx + certbot

### Requirement: Idempotent update path

The system SHALL provide an update script that pulls the latest code, rebuilds and recreates
the containers, applies migrations, and reloads nginx without re-running certificate issuance.

#### Scenario: Update redeploys the latest code

- **WHEN** the update script runs after new commits are pushed
- **THEN** the containers are rebuilt and restarted on the new code and the site stays served

### Requirement: Cross-origin API access

The system SHALL allow the browser frontend (served from a different origin) to call the API,
with the allowed origin configurable via `CORS_ORIGIN` and defaulting to allow-all.

#### Scenario: Frontend origin may call the API

- **WHEN** the frontend at its domain makes an API request to the backend domain
- **THEN** the response carries CORS headers permitting the request
