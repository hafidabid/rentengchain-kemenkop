## Why

RantaiRenteng today ships as a static React mockup (`brainstorm/gstudio`) driven entirely by
`mockData.ts`. It looks the part but proves nothing: no login, no persistence, no on-chain trail.
For the hackathon demo to be convincing, the two surfaces judges actually click — the mobile-first
Anggota app and the desktop Pengurus dashboard — must run against the real NestJS backend and show
live state from Postgres and Base Sepolia. The mockup's camelCase TypeScript types already match
the backend's camelCase API shape, so this is a wiring-and-routing job, not a rebuild. This change
promotes the mockup into a real `/frontend` app that carries a JWT, replaces `mockData.ts` with an
API client, splits the surfaces onto their own routes, and dresses the app in the shipped branding.

## What Changes

- Promote `brainstorm/gstudio` into a first-class `/frontend` app (React + Vite + TypeScript +
  Tailwind, lucide-react icons, Warm Coral aesthetic `#F06A6A` / `#E5544F` / `#FAF9F8` /
  `#1E1F21`), reusing the existing `AnggotaView.tsx`, `PengurusView.tsx`, and
  `RiskScreenerTool.tsx` components rather than rebuilding them.
- Replace static `mockData.ts` with a real HTTP API client that talks to the NestJS backend and
  attaches the JWT from login to every request.
- Introduce `react-router-dom` multi-routing: the Anggota surface at `/` (mobile-first) and the
  Pengurus surface at `/laman-pengurus` (desktop), each behind its own login/role.
- Wire the four demo flows end-to-end through the UI: onboarding + wallet reveal (①), AI flag +
  `sanggah` (②), renteng bailout (③), and savings + clickable on-chain `txLink` (④).
- Apply the shipped branding from `./assets`: `favicon.ico`, `apple-touch-icon.png`,
  `android-chrome-*.png`, `site.webmanifest`, and the `logo_banner` / `logo_green` marks.
- Add a lightweight, per-flow layout sanity check (no overflow / no broken flex) with a manual or
  single-shot screenshot pass — with a defined "done" per flow, not an open-ended retry loop.

## Capabilities

### New Capabilities

- `member-app-ui`: the mobile-first Anggota surface at `/` — login, own profile + wallet address,
  simulated-QRIS savings with a clickable on-chain `txLink`, and loan application with AI flag and
  `sanggah` filing.
- `pengurus-dashboard-ui`: the desktop Pengurus surface at `/laman-pengurus` — login, KYC
  approve/reject with minted wallet reveal, loan/appeal review with AI recommendation, renteng
  bailout trigger, and the transparent audit-log/ledger with clickable tx links.

### Modified Capabilities

<!-- none — this change introduces the two UI capabilities and consumes existing backend APIs -->

## Impact

- New `/frontend` app (promoted from `brainstorm/gstudio`); `mockData.ts` retired in favor of an
  API client module.
- New dependencies: `react-router-dom` and an HTTP client (fetch wrapper or `axios`).
- Depends on ALL backend changes for its APIs: `add-backend-foundation` (auth, members, groups,
  audit log), `add-web3-relayer` (wallet + on-chain tx hashes), `add-onboarding-kyc-wallet` (①),
  `add-savings-audit-trail` (④), `add-ai-ews-appeal` (②), and `add-renteng-bailout` (③). This is
  the last change to land.
- Branding assets consumed from `./assets`; `index.html` head and `site.webmanifest` updated.
- Env: a single `VITE_API_BASE_URL` pointing at the NestJS backend.
