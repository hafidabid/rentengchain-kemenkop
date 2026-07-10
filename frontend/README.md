# RantaiRenteng — Frontend

Real React app for **RantaiRenteng**, the digital *tanggung renteng* (joint-liability)
cooperative. Promoted from the `brainstorm/gstudio/` mockup (Warm Coral design) and
wired to the NestJS backend.

- **Anggota (member)** — mobile-first app at `/`
- **Pengurus (admin)** — desktop dashboard at `/laman-pengurus`
- **Login gate** at `/login` (routes by member `role` after login)

Stack: React 19 · Vite · TypeScript · Tailwind v4 · lucide-react · react-router-dom.
Design tokens: `#F06A6A` / `#E5544F` / `#FAF9F8` / `#1E1F21`.

## Prerequisites

Requires **Node.js >= 20** (Tailwind v4's native `oxide` engine needs it; Node 18
fails the build with a "Cannot find native binding" error).

The backend must be running on **`:3001`** with the demo data seeded. From `backend/`:

```bash
npm install
npm run prisma:migrate   # or prisma migrate deploy
npm run prisma:seed
npm run start:dev
```

## Run the frontend

```bash
cd frontend
cp .env.example .env      # adjust VITE_API_URL if the backend is elsewhere
npm install
npm run dev               # http://localhost:3000
```

Production build (runs `tsc` then `vite build`):

```bash
npm run build
npm run preview
```

## Environment

| Variable             | Default                                  | Purpose                                                                 |
| -------------------- | ---------------------------------------- | ----------------------------------------------------------------------- |
| `VITE_API_URL`       | `http://localhost:3001`                  | Backend base URL. All calls hit `${VITE_API_URL}/api`.                   |
| `VITE_DEMO_GROUP_ID` | seeded `Mekar Wangi Srikandi` group id   | Group used to bootstrap the Anggota group context + loan application.\* |

\* Anggota routes cannot list groups (`GET /groups` is Pengurus-only), so the member
surface reads its one demo group by id via `GET /groups/:id`.

## Demo accounts

All accounts share the password **`RantaiRenteng2026`**; the login identifier is the NIK.

| Role     | Who                       | NIK                |
| -------- | ------------------------- | ------------------ |
| Pengurus | Bendahara Koperasi        | `3273010000000001` |
| Anggota  | Sri (skor 98, HIJAU)      | `3273012345678901` |
| Anggota  | Anisa (skor 45, MERAH)    | `3273011122334455` |

The JWT returned by `POST /auth/login` is stored in `localStorage` and sent as
`Authorization: Bearer <token>` on every request.

## The four demo flows

- **① Identitas & Wallet** — login shows the member profile + on-chain wallet address
  (Anggota `Profil`/`Beranda`); Pengurus approves/rejects e-KYC and sees the newly
  minted wallet (`Antre KYC`).
- **② Pinjaman + AI EWS** — Anggota applies for a loan and sees the AI flag / score /
  reasons, and files a *sanggah* when flagged; Pengurus reviews with the AI
  recommendation and approves/rejects (resolving the sanggah).
- **③ Tanggung Renteng** — Pengurus triggers a renteng bailout on an arrears loan and
  watches `kasSosial` drop while the loan flips to `DITALANGI` (`Tangga Penagihan`).
- **④ Simpanan (QRIS)** — Anggota pays a simpanan via the simulated-QRIS button and
  gets a clickable on-chain `txLink` in the savings history.

The audit-log ledger (Pengurus `Dashboard EWS`) renders newest-first with clickable
transaction links.
