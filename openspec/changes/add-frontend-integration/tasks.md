## 1. Promote the mockup into /frontend

- [x] 1.1 Move `brainstorm/gstudio` to `/frontend` (Vite + React + TypeScript + Tailwind), preserving `AnggotaView.tsx`, `PengurusView.tsx`, `RiskScreenerTool.tsx`, and `src/types.ts`
- [x] 1.2 Verify the app still builds and runs (`npm install`, `npm run dev`) with the existing Warm Coral Tailwind theme and lucide-react icons intact
- [x] 1.3 Add `VITE_API_BASE_URL` to `.env`/`.env.example` pointing at the NestJS backend

## 2. API client and auth plumbing

- [x] 2.1 Add an HTTP client (`react-router-dom` + fetch wrapper or `axios`); create `src/api/` with one typed function per backend endpoint returning the camelCase types from `types.ts`
- [x] 2.2 Implement login: `POST /auth/login`, store the JWT (in-memory + `localStorage`), attach `Authorization: Bearer` to every request, and redirect to login on 401
- [x] 2.3 Replace `mockData.ts` reads with API-client calls across all screens; remove `mockData.ts` once no screen depends on it

## 3. Routing and surface separation

- [x] 3.1 Add `react-router-dom` with `/` → Anggota shell (mobile-first) and `/laman-pengurus` → Pengurus shell (desktop)
- [x] 3.2 Guard each route on the authenticated role so Anggota cannot open `/laman-pengurus` and Pengurus cannot open the member surface

## 4. Wire the four demo flows

- [x] 4.1 Flow ① (member): after KYC approval, the Anggota profile shows the minted `walletAddress`
- [x] 4.2 Flow ④ (member): savings screen with simulated-QRIS confirm calls the savings endpoint and renders the returned clickable `txLink`
- [x] 4.3 Flow ② (member): loan application shows the AI flag + reasons; when flagged `MERAH`, the member can file a `sanggah`
- [x] 4.4 Flow ① (pengurus): KYC queue approve/reject reveals the minted `walletAddress` on approval
- [x] 4.5 Flow ② (pengurus): loan/appeal review shows the AI recommendation + reasons and resolves appeals/`sanggah`
- [x] 4.6 Flow ③ (pengurus): trigger a renteng bailout and reflect the resulting loan/kas-sosial state
- [x] 4.7 Pengurus audit-log/ledger view lists entries with clickable on-chain tx links; seeded read-only reports view is sufficient

## 5. Branding

- [x] 5.1 Copy `./assets` (`favicon.ico`, `apple-touch-icon.png`, `android-chrome-*.png`, `site.webmanifest`) into `public/` and reference them in `index.html`
- [x] 5.2 Use `logo_banner` in surface headers and `logo_green` as the compact mark; set the document title/manifest name to RantaiRenteng

## 6. Quality gates

- [x] 6.1 `npm run build` and `npm run lint` (`tsc --noEmit`) pass
- [x] 6.2 Per-flow layout sanity check: one screenshot pass per flow confirming no horizontal overflow and no broken flex on the target form factor (mobile for `/`, desktop for `/laman-pengurus`); "done" is met when the key element (wallet address / txLink / AI flag / bailout state) is visible — not an open-ended retry loop
- [x] 6.3 Update `/frontend` README/AGENTS notes with run, env, and route conventions
