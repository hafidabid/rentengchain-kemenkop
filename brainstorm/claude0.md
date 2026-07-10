You are tasked with engineering and create the mvp-production-grade codebase for "RantaiRenteng", a modern digital microfinance platform featuring social collateral (tanggung renteng), Web3-driven custodial wallets (using `viem`), and AI-powered Risk Screening (using Gemini API).

## 1. Stack & Directory Specifications

1. **Frontend**: React (Vite, TypeScript, Tailwind CSS) from the current mockup.
   - Separate routes: `/laman-pengurus` for the Pengurus (Admins) desktop dashboard, and `/` (or mobile-first route) for Members.
   - Use Lucide React icons, and styling based on the Warm Coral aesthetic: `#F06A6A` (Coral), `#FAF9F8` (Warm Off-white bg), and `#1E1F21` (Charcoal text).
2. **Backend**: NestJS (TypeScript, PostgreSQL, Redis, `@google/genai` for Gemini API, `viem` for blockchain operations, and AWS S3 SDK for KTP upload).
3. **Architecture**: Clean, modular full-stack configuration with solid TypeScript schemas. Use TypeORM or Prisma for PostgreSQL models matching the ERD specs below.

## 2. PostgreSQL Schema Database Definition

Implement the following relational tables and relations:

- `members`: ID (UUID, PK), nama, nik (UNIQUE), no_hp, alamat, pekerjaan, peran, status_kyc (Requested/Approved/Rejected), skor_keanggotaan (0-100), ktp_url, simpanan_pokok, simpanan_wajib, simpanan_sukarela, is_dorman, is_uzur, jumlah_izin_uzur, wallet_address, created_at, updated_at, password, evm_address, evm_private_key.
- `groups`: ID (UUID, PK), nama, ketua_id (FK -> members.id), plafon_maks, jadwal_pertemuan, kehadiran_rate, kas_sosial, reputasi_komunitas, kode_undangan, created_at, updated_at.
- `member_groups`: member_id (FK), group_id (FK), joined_at. (Composite PK)
- `loans`: ID (UUID, PK), member_id, group_id, nominal, tujuan, tenor, status (Diajukan/Disetujui/Cair/Lunas/Mangkir/Ditunda), status_cicilan (PAID/UNPAID/TUNGGAKAN/DITALANGI), sisa_cicilan, cicilan_bulanan, jadwal_cicilan, skor_ai, flag_ai (HIJAU/KUNING/MERAH), flag_alasan (JSONB), is_sanggah (boolean), sanggah_alasan, escrow_contract_address.
- `saving_transactions`: ID (UUID, PK), member_id, jenis, nominal, tanggal, metode, status, tx_hash, tx_link.
- `audit_logs`: ID (UUID, PK), timestamp, aktor, aksi, detail.

Please generate all entities, services, controllers, and database migrations based on these tables. Seed the database with Sri Wahyuni (Active/Lancar), Deni Ramdani (Uzur/Ditalangi), and Anisa Triana (Red Flag/Mangkir/AI Sanggahan) using raw PostgreSQL seeds.

## 3. Web3 & Gemini Modules Specification

1. **Web3 Custodial Module**:
   - Write a NestJS Service using `viem` to generate private keys securely when a member's KYC is `Approved`. Store the address in the `members.wallet_address` field.
   - Integrate a transaction relayer using a Master Wallet private key so members can perform on-chain operations with zero gas fees.
2. **Gemini AI EWS Module**:
   - Configure a service to feed the member profile data, their group's presence rate, savings habits, and credit purpose into the Gemini API.
   - Instruct the Gemini API to output a structured JSON containing: `skor_ai` (0-100), `flag_ai` ('HIJAU' | 'KUNING' | 'MERAH'), and `flag_alasan` (array of strings explaining the score).

## 4. Execution Guidelines

- read `brainstorm/RantaiRenteng_Spesifikasi_Flow.pdf` and read `brainstorm/RantaiRenteng_Flow_Aplikasi.html`
- read `brainstorm/gstudio/*`
- read `brainstorm/RantaiRenteng_Skrining_Risiko_Demo.html` and `brainstorm/rr_risk_engine.py`
- Read `brainstorm/gstudio/src/types.ts` and `brainstorm/gstudio/src/components/AnggotaView.tsx` from the existing code to preserve mockup fields exactly.
- Build production-ready controllers, guards, endpoints, and fully hook up the frontend React client. No mocks. All API endpoints must talk to the PostgreSQL backend database with proper error handling.
- for smart contract integration will be do in next phase, just left docs to be read / considered for next iteration

## 5. guardrail and working

- use beads and openspec properly and efficiently
- please after implement feature, build unit test, build, lint, and test it
- do integration test properly make sure integration run well
- for UI please do screen test too, ensure that the padding, flex, etc is proper, no overflow compoenent
- if step 2/3/4 fail please repeat it until ok
- for docker implementation for now just implement, i'll test by myself since in this device the resource is limited
- always update agents.md and for agents.md please create docs that located in every folder components and you can make a file that contain huge logics into one .md, this purpose is to make the repo documented well and agents when wanna do changes or build no need read the whole code
- commit it small, so human can easily review
- dont need to create new branch, expect the user tell you to create new branch

Begin bootstrapping the project by structuring the folders and database modules first.
