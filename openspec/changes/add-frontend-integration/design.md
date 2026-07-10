## Context

The mockup at `brainstorm/gstudio` is a working Vite + React + TypeScript + Tailwind SPA with three
substantial components (`AnggotaView.tsx`, `PengurusView.tsx`, `RiskScreenerTool.tsx`) and a
camelCase type model (`src/types.ts`) that the backend deliberately mirrors. State comes from a
static `mockData.ts`. There is no router, no auth, and no network layer. The backend changes expose
a JWT-authenticated REST API in exactly the camelCase shape these components already render, so the
gap is: routing, an API client, auth-token plumbing, branding, and per-flow verification.

## Goals / Non-Goals

**Goals:**
- Run the real mockup components against the live backend with zero shape translation.
- Two clean surfaces on their own routes with the right form factors (mobile-first `/`, desktop
  `/laman-pengurus`).
- All four demo flows clickable end-to-end, including the clickable on-chain `txLink`.
- Shipped branding applied so the demo looks finished.

**Non-Goals:**
- No redesign of the existing components or the Warm Coral system.
- No client-side business logic that belongs on the backend (scoring, on-chain calls, bailout math).
- No exhaustive responsive matrix or automated visual regression — a per-flow sanity check only.
- No offline/error-state polish beyond what keeps the happy path believable.

## Decisions

- **Promote, don't fork:** move `brainstorm/gstudio` to `/frontend` and keep the component tree;
  changes are additive (router, client, auth context) so diffs stay reviewable.
- **API client over mockData:** a thin typed client module (fetch wrapper) exposes one function per
  backend endpoint and returns the camelCase types from `types.ts` unchanged. `mockData.ts` is
  removed once every screen reads from the client; a short-lived seam may keep both during wiring.
- **Auth plumbing:** login stores the JWT (in-memory + `localStorage` for reload survival); the
  client attaches `Authorization: Bearer` to every request; a 401 bounces to login.
- **Routing + role separation:** `react-router-dom` with `/` → Anggota shell and `/laman-pengurus`
  → Pengurus shell; each route guards on the authenticated role so an Anggota cannot open the
  Pengurus dashboard and vice versa.
- **Simulated QRIS:** the savings screen shows a QR/confirm affordance; confirming calls the
  backend savings endpoint (which fires the on-chain tx) and then renders the returned `txLink`.
  No real payment gateway.
- **Branding:** wire `./assets` into `public/` and `index.html`/`site.webmanifest`; use
  `logo_banner` in headers and `logo_green` where a compact mark fits.
- **Per-flow "done":** each of the four flows has an explicit visual acceptance (screen renders,
  no overflow, no broken flex, the key element — wallet address / txLink / AI flag / bailout state
  — is visible). Verification is one screenshot pass per flow, not an iterate-until-perfect loop.

## Risks / Trade-offs

- **Backend readiness:** this change is last and assumes all backend endpoints exist; if a flow's
  API slips, that flow's screen is wired but demoed against seeded state. Acceptable for a demo.
- **JWT in `localStorage`** is not hardened against XSS; accepted for a hackathon per the project's
  speed-over-hardening posture.
- **CORS / base URL drift** between local and demo hosts is the most likely live failure; a single
  `VITE_API_BASE_URL` env and a permissive dev CORS policy keep it contained.
- **Reusing mockup components** means inheriting any layout assumptions baked for mock data; the
  per-flow sanity check exists specifically to catch overflow/flex breakage from real-length data.
