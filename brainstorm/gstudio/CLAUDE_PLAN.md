# RantaiRenteng: Spesifikasi Teknis, ERD, Seed Data & Claude Code Integration Plan

Dokumen ini adalah rancangan komprehensif sistem **RantaiRenteng** (Koperasi Digital Tanggung Renteng Modern) yang mempertemukan filosofi sosiologis gotong royong dengan otomatisasi teknologi modern (NestJS, PostgreSQL, Redis, Gemini AI, S3, dan EVM Smart Contracts).

Sistem ini didesain menggunakan **Warm Coral Aesthetic** (Asana-style UI) dengan paduan warna:
*   **Primary Coral**: `#F06A6A`
*   **Hover/Accent Coral**: `#E5544F`
*   **Warm Off-White Background**: `#FAF9F8`
*   **Charcoal Text**: `#1E1F21`
*   **Muted Text**: `#6D6E6F`
*   **Success Green**: `#62D26F` / Light Green: `#EDF9F0`
*   **Warning Yellow**: `#F1BD6C` / Light Yellow: `#FDF6E2`

---

## 1. Arsitektur & Spesifikasi Bisnis

RantaiRenteng menerapkan model kredit mikro Grameen Bank / Koperasi Setia Bhakti Wanita dengan adaptasi digital Web3 & AI:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          APLIKASI RANTAIRENTENG                        │
├───────────────────────────────────┬────────────────────────────────────┤
│       1. ALUR ANGGOTA (Mobile)    │     2. PANEL PENGURUS (Desktop)    │
├───────────────────────────────────┼────────────────────────────────────┤
│ • Pendaftaran e-KYC & Swafoto     │ • Verifikasi KYC & Rilis Wallet    │
│ • Pembayaran Simpanan via QRIS    │ • Manajemen Kelompok & Plafon      │
│ • Buat/Gabung Kelompok (5-10 org) │ • Review Pinjaman (Rekomendasi AI) │
│ • Pengajuan Pinjaman Terikat Grup │ • Manajemen Tangga Penagihan       │
│ • Sanggahan Rekomendasi Merah AI  │ • Laporan Neraca & e-RAT           │
└───────────────────────────────────┴────────────────────────────────────┘
```

### Integrasi Sistem Kunci
1.  **Custodial EVM Relayer**: Setiap anggota yang disetujui KYC-nya akan otomatis dibuatkan wallet EVM custodial di backend. Anggota tidak perlu tahu tentang private key atau membayar gas fee. Transaksi ledger koperasi (simpanan, pencairan, cicilan) diredistribusikan secara transparan di rantai blockchain privat/testnet (sebagai immutable ledger) menggunakan library `viem`.
2.  **Smart Contract Escrow**: Pencairan dana pinjaman ditahan di kontrak escrow dan dicairkan bertahap. Jika salah satu anggota kelompok menunggak, escrow menahan pencairan sisa anggota lainnya (mekanisme insentif tanggung renteng otomatis).
3.  **Gemini AI Early Warning System (EWS)**: Menganalisis profil anggota (skor keanggotaan, histori ketepatan waktu, tingkat kehadiran kelompok, serta sentimen media sosial/riwayat pekerjaan) untuk menentukan risiko (`HIJAU`, `KUNING`, `MERAH`). Anggota diberi hak sanggah demi keadilan algoritma.

---

## 2. Rancangan ERD (Entity Relationship Diagram)

ERD di bawah menggunakan PostgreSQL relasional. Kita menggunakan UUID untuk semua ID dan relasi yang kuat untuk menjaga integritas data koperasi.

```
       ┌──────────────────┐
       │   audit_logs     │
       ├──────────────────┤
       │ id (PK, UUID)    │
       │ timestamp        │
       │ aktor            │
       │ aksi             │
       │ detail           │
       └──────────────────┘

       ┌──────────────────┐               ┌──────────────────┐
       │     members      │               │      groups      │
       ├──────────────────┤               ├──────────────────┤
       │ id (PK, UUID)   ◄┼───────────────┼ ketua_id (FK)    │
       │ nama             │               │ nama             │
       │ nik (UNIQUE)     │               │ plafon_maks      │
       │ no_hp            │               │ jadwal_pertemuan │
       │ alamat           │               │ kehadiran_rate   │
       │ pekerjaan        │               │ kas_sosial       │
       │ peran            │               │ reputasi         │
       │ status_kyc       │               │ kode_undangan    │
       │ skor_keanggotaan │               └─────────▲────────┘
       │ ktp_url          │                         │
       │ simpanan_pokok   │                         │
       │ simpanan_wajib   │                         │
       │ simpanan_sukarela│                         │
       │ is_dorman        │                         │
       │ is_uzur          │                         │
       │ jumlah_izin_uzur │                         │
       │ wallet_address   │                         │
       └────────▲─────────┘                         │
                │                                   │
                │       ┌─────────────────┐         │
                ├───────┤  member_groups  ├─────────┘
                │       ├─────────────────┤
                │       │ member_id (FK)  │
                │       │ group_id (FK)   │
                │       │ joined_at       │
                │       └─────────────────┘
                │
                ├───────────────────────────────────┐
                │                                   │
       ┌────────┴─────────┐                ┌────────┴─────────┐
       │      loans       │                │saving_transactions│
       ├──────────────────┤                ├──────────────────┤
       │ id (PK, UUID)    │                │ id (PK, UUID)    │
       │ member_id (FK)  ─┼────────────────┼ member_id (FK)   │
       │ group_id (FK)   ─┼──────────┐     │ jenis            │
       │ nominal          │          │     │ nominal          │
       │ tujuan           │          │     │ tanggal          │
       │ tenor            │          │     │ metode           │
       │ status           │          │     │ status           │
       │ status_cicilan   │          │     │ tx_hash          │
       │ sisa_cicilan     │          │     └──────────────────┘
       │ cicilan_bulanan  │          │
       │ jadwal_cicilan   │          │
       │ skor_ai          │          │
       │ flag_ai          │          │
       │ flag_alasan      │          │
       │ is_sanggah       │          │
       │ sanggah_alasan   │          │
       │ escrow_address   │          │
       └──────────────────┘          │
                ▲                    │
                └────────────────────┘
```

### Script DDL PostgreSQL (schema.sql)

```sql
-- Pastikan ekstensi UUID terpasang
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: members
CREATE TABLE members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama VARCHAR(150) NOT NULL,
    nik VARCHAR(16) UNIQUE NOT NULL,
    no_hp VARCHAR(20) NOT NULL,
    alamat TEXT NOT NULL,
    pekerjaan VARCHAR(100) NOT NULL,
    peran VARCHAR(30) NOT NULL CHECK (peran IN ('penabung', 'peminjam', 'keduanya')),
    status_kyc VARCHAR(30) NOT NULL CHECK (status_kyc IN ('Requested', 'Approved', 'Rejected')),
    skor_keanggotaan INT NOT NULL DEFAULT 100 CHECK (skor_keanggotaan BETWEEN 0 AND 100),
    ktp_url VARCHAR(255),
    simpanan_pokok DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    simpanan_wajib DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    simpanan_sukarela DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    is_dorman BOOLEAN NOT NULL DEFAULT FALSE,
    is_uzur BOOLEAN NOT NULL DEFAULT FALSE,
    jumlah_izin_uzur INT NOT NULL DEFAULT 0,
    wallet_address VARCHAR(42),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Table: groups
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama VARCHAR(100) NOT NULL,
    ketua_id UUID REFERENCES members(id) ON DELETE SET NULL,
    plafon_maks DECIMAL(15, 2) NOT NULL DEFAULT 10000000.00,
    jadwal_pertemuan VARCHAR(100) NOT NULL,
    kehadiran_rate DECIMAL(5, 2) NOT NULL DEFAULT 100.00,
    kas_sosial DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    reputasi_komunitas VARCHAR(30) NOT NULL CHECK (reputasi_komunitas IN ('baik', 'cukup', 'kurang')),
    kode_undangan VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Table: member_groups (Many-to-Many Bridge)
CREATE TABLE member_groups (
    member_id UUID REFERENCES members(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (member_id, group_id)
);

-- Table: loans
CREATE TABLE loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID REFERENCES members(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    nominal DECIMAL(15, 2) NOT NULL,
    tujuan TEXT NOT NULL,
    tenor INT NOT NULL, -- Bulan
    status VARCHAR(30) NOT NULL CHECK (status IN ('Diajukan', 'Disetujui', 'Cair', 'Lunas', 'Mangkir', 'Ditunda')),
    status_cicilan VARCHAR(30) NOT NULL CHECK (status_cicilan IN ('PAID', 'UNPAID', 'TUNGGAKAN', 'DITALANGI')),
    sisa_cicilan INT NOT NULL,
    cicilan_bulanan DECIMAL(15, 2) NOT NULL,
    jadwal_cicilan VARCHAR(100) NOT NULL,
    skor_ai INT NOT NULL CHECK (skor_ai BETWEEN 0 AND 100),
    flag_ai VARCHAR(15) NOT NULL CHECK (flag_ai IN ('HIJAU', 'KUNING', 'MERAH')),
    flag_alasan JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_sanggah BOOLEAN NOT NULL DEFAULT FALSE,
    sanggah_alasan TEXT,
    escrow_contract_address VARCHAR(42),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Table: saving_transactions
CREATE TABLE saving_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID REFERENCES members(id) ON DELETE CASCADE,
    jenis VARCHAR(30) NOT NULL CHECK (jenis IN ('Pokok', 'Wajib', 'Sukarela')),
    nominal DECIMAL(15, 2) NOT NULL,
    tanggal TIMESTAMP NOT NULL DEFAULT NOW(),
    metode VARCHAR(50) NOT NULL, -- QRIS, Transfer, dll
    status VARCHAR(30) NOT NULL CHECK (status IN ('PAID', 'PENDING')),
    tx_hash VARCHAR(66),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Table: audit_logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    aktor VARCHAR(150) NOT NULL,
    aksi VARCHAR(100) NOT NULL,
    detail TEXT NOT NULL
);
```

---

## 3. Data Seed SQL (seed.sql)

Gunakan data di bawah untuk melakukan inisialisasi awal database sehingga representasi sistem terisi dengan data yang realistis (sesuai dengan mockup interaktif):

```sql
-- 1. Bersihkan Data Sebelumnya
TRUNCATE TABLE audit_logs, saving_transactions, loans, member_groups, groups, members CASCADE;

-- 2. Seed Members (Anggota & Pengurus Koperasi)
-- Member 1 (Ketua Kelompok Sri Srikandi): Bu Sri
INSERT INTO members (id, nama, nik, no_hp, alamat, pekerjaan, peran, status_kyc, skor_keanggotaan, ktp_url, simpanan_pokok, simpanan_wajib, simpanan_sukarela, is_dorman, is_uzur, jumlah_izin_uzur, wallet_address)
VALUES (
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'Sri Wahyuni',
    '3273012345678901',
    '081234567890',
    'RT 03/RW 04, Desa Mekar Sari, Bandung',
    'Pengusaha Kripik Tempe',
    'keduanya',
    'Approved',
    98,
    'https://s3.amazonaws.com/rantai-renteng-ktp/sri_ktp.jpg',
    100000.00,
    450000.00,
    300000.00,
    FALSE,
    FALSE,
    0,
    '0x1234567890123456789012345678901234567890'
);

-- Member 2 (Anggota Terkena Musibah): Pak Deni
INSERT INTO members (id, nama, nik, no_hp, alamat, pekerjaan, peran, status_kyc, skor_keanggotaan, ktp_url, simpanan_pokok, simpanan_wajib, simpanan_sukarela, is_dorman, is_uzur, jumlah_izin_uzur, wallet_address)
VALUES (
    'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
    'Deni Ramdani',
    '3273019876543210',
    '081398765432',
    'RT 03/RW 04, Desa Mekar Sari, Bandung',
    'Peternak Ayam',
    'keduanya',
    'Approved',
    75,
    'https://s3.amazonaws.com/rantai-renteng-ktp/deni_ktp.jpg',
    100000.00,
    350000.00,
    150000.00,
    FALSE,
    TRUE,
    1,
    '0x2345678901234567890123456789012345678901'
);

-- Member 3 (Anggota Dorman / Gagal Bayar): Bu Ani
INSERT INTO members (id, nama, nik, no_hp, alamat, pekerjaan, peran, status_kyc, skor_keanggotaan, ktp_url, simpanan_pokok, simpanan_wajib, simpanan_sukarela, is_dorman, is_uzur, jumlah_izin_uzur, wallet_address)
VALUES (
    'c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f',
    'Anisa Triana',
    '3273011122334455',
    '081511223344',
    'RT 01/RW 04, Desa Mekar Sari, Bandung',
    'Penjual Warung Kelontong',
    'peminjam',
    'Approved',
    45,
    'https://s3.amazonaws.com/rantai-renteng-ktp/ani_ktp.jpg',
    100000.00,
    200000.00,
    50000.00,
    TRUE,
    FALSE,
    0,
    '0x3456789012345678901234567890123456789012'
);

-- Member 4 (Antrean KYC baru): Bu Ira
INSERT INTO members (id, nama, nik, no_hp, alamat, pekerjaan, peran, status_kyc, skor_keanggotaan, ktp_url, simpanan_pokok, simpanan_wajib, simpanan_sukarela, is_dorman, is_uzur, jumlah_izin_uzur, wallet_address)
VALUES (
    'd4e5f6a7-b89c-0d1e-2f3a-4b5c6d7e8f9a',
    'Ira Maya Sofa',
    '3273014455667788',
    '081944556677',
    'RT 02/RW 04, Desa Mekar Sari, Bandung',
    'Pengrajin Anyaman Bambu',
    'peminjam',
    'Requested',
    100,
    'https://s3.amazonaws.com/rantai-renteng-ktp/ira_ktp.jpg',
    0.00,
    0.00,
    0.00,
    FALSE,
    FALSE,
    0,
    NULL
);

-- 3. Seed Groups (Kelompok Tanggung Renteng)
INSERT INTO groups (id, nama, ketua_id, plafon_maks, jadwal_pertemuan, kehadiran_rate, kas_sosial, reputasi_komunitas, kode_undangan)
VALUES (
    'e5f6a7b8-9c0d-1e2f-3a4b-5c6d7e8f9a0b',
    'Mekar Wangi Srikandi',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', -- Sri Wahyuni
    15000000.00,
    'Setiap Tanggal 5',
    96.50,
    850000.00,
    'baik',
    'SRIKANDI-2026'
);

-- 4. Seed Member Group Bridge
-- Bu Sri masuk Mekar Wangi
INSERT INTO member_groups (member_id, group_id, joined_at)
VALUES ('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'e5f6a7b8-9c0d-1e2f-3a4b-5c6d7e8f9a0b', NOW());

-- Pak Deni masuk Mekar Wangi
INSERT INTO member_groups (member_id, group_id, joined_at)
VALUES ('b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e', 'e5f6a7b8-9c0d-1e2f-3a4b-5c6d7e8f9a0b', NOW());

-- Bu Ani masuk Mekar Wangi
INSERT INTO member_groups (member_id, group_id, joined_at)
VALUES ('c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f', 'e5f6a7b8-9c0d-1e2f-3a4b-5c6d7e8f9a0b', NOW());

-- 5. Seed Loans
-- Pinjaman 1: Bu Sri (Cair, Lancar, Sisa 2 Bulan, Flag AI Hijau)
INSERT INTO loans (id, member_id, group_id, nominal, tujuan, tenor, status, status_cicilan, sisa_cicilan, cicilan_bulanan, jadwal_cicilan, skor_ai, flag_ai, flag_alasan, is_sanggah, sanggah_alasan, escrow_contract_address, created_at)
VALUES (
    'f6a7b89c-0d1e-2f3a-4b5c-6d7e8f9a0b1c',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'e5f6a7b8-9c0d-1e2f-3a4b-5c6d7e8f9a0b',
    5000000.00,
    'Membeli bahan baku kripik tempe ekstra untuk Idul Adha',
    10,
    'Cair',
    'PAID',
    2,
    550000.00,
    'Setiap Tanggal 5',
    95,
    'HIJAU',
    '["Histori pembayaran tepat waktu 100%","Rasio tabungan wajib sehat (>35%)","Kelompok aktif berkehadiran tinggi"]'::jsonb,
    FALSE,
    NULL,
    '0x8888888888888888888888888888888888888888',
    NOW() - INTERVAL '8 months'
);

-- Pinjaman 2: Pak Deni (Cair, Ditalangi Kelompok, Sisa 5 Bulan, Flag AI Kuning)
INSERT INTO loans (id, member_id, group_id, nominal, tujuan, tenor, status, status_cicilan, sisa_cicilan, cicilan_bulanan, jadwal_cicilan, skor_ai, flag_ai, flag_alasan, is_sanggah, sanggah_alasan, escrow_contract_address, created_at)
VALUES (
    'a7b89c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d',
    'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
    'e5f6a7b8-9c0d-1e2f-3a4b-5c6d7e8f9a0b',
    3000000.00,
    'Pengembangan kandang ayam petelur baru',
    6,
    'Cair',
    'DITALANGI',
    5,
    530000.00,
    'Setiap Tanggal 5',
    72,
    'KUNING',
    '["Kehadiran kelompok sempat turun di bulan lalu","Ada ketergantungan harga pakan ternak di pasar local"]'::jsonb,
    FALSE,
    NULL,
    '0x9999999999999999999999999999999999999999',
    NOW() - INTERVAL '1 months'
);

-- Pinjaman 3: Bu Ani (Diajukan, Skor AI Merah - butuh persetujuan & memiliki sanggahan)
INSERT INTO loans (id, member_id, group_id, nominal, tujuan, tenor, status, status_cicilan, sisa_cicilan, cicilan_bulanan, jadwal_cicilan, skor_ai, flag_ai, flag_alasan, is_sanggah, sanggah_alasan, escrow_contract_address, created_at)
VALUES (
    'b89c0d1e-2f3a-4b5c-6d7e-8f9a0b1c2d3e',
    'c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f',
    'e5f6a7b8-9c0d-1e2f-3a4b-5c6d7e8f9a0b',
    4000000.00,
    'Restocking sembako warung dan renovasi atap bocor',
    12,
    'Diajukan',
    'UNPAID',
    12,
    360000.00,
    'Setiap Tanggal 5',
    38,
    'MERAH',
    '["Status tabungan tidak aktif dalam 3 bulan terakhir","Warung sepi kompetitor baru ritel modern","Sering absen pertemuan bulanan kelompok"]'::jsonb,
    TRUE,
    'Saya berjanji akan mengaktifkan kembali tabungan saya. Warung saya sekarang sudah bekerjasama dengan supplier anyar untuk harga grosir yang lebih murah, omzet dijamin naik.',
    NULL,
    NOW()
);

-- 6. Seed Saving Transactions
INSERT INTO saving_transactions (id, member_id, jenis, nominal, tanggal, metode, status, tx_hash)
VALUES (
    'c9d0e1f2-a3b4-5c6d-7e8f-9a0b1c2d3e4f',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', -- Bu Sri
    'Pokok',
    100000.00,
    NOW() - INTERVAL '8 months',
    'QRIS',
    'PAID',
    '0x7777777777777777777777777777777777777777777777777777777777777777'
);

INSERT INTO saving_transactions (id, member_id, jenis, nominal, tanggal, metode, status, tx_hash)
VALUES (
    'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', -- Bu Sri
    'Wajib',
    50000.00,
    NOW() - INTERVAL '1 months',
    'QRIS',
    'PAID',
    '0xaaaaaaaabbbbbbbbccccccccddddddddeeeeeeeeffffffff0000000011111111'
);

-- 7. Seed Audit Logs (Jejak Rekam Transparan)
INSERT INTO audit_logs (id, timestamp, aktor, aksi, detail)
VALUES (
    'e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b',
    NOW() - INTERVAL '2 days',
    'System Escrow Relayer',
    'PENCARIAN_ESCROW_RELEASED',
    'Pencairan dana pinjaman milik Sri Wahyuni sebesar Rp5.000.000 sukses direkam di blok #1928374'
);

INSERT INTO audit_logs (id, timestamp, aktor, aksi, detail)
VALUES (
    'f2a3b4c5-d6e7-8f9a-0b1c-2d3e4f5a6b7c',
    NOW() - INTERVAL '1 days',
    'Pengurus (Bendahara)',
    'TANGGUNG_RENTENG_TRIGGERED',
    'Mengaktifkan talangan kas sosial kelompok Mekar Wangi Srikandi untuk cicilan tertunggak milik Deni Ramdani sebesar Rp530.000'
);
```

---

## 4. Spesifikasi OpenSpec & Web3 Smart Contract

### A. Endpoint Skema Bisnis Kunci (OpenSpec/Swagger Draft)

```yaml
openapi: 3.0.3
info:
  title: RantaiRenteng API
  description: Sistem Ledger dan Penilaian Risiko Kredit Berbasis Tanggung Renteng.
  version: 1.0.0
paths:
  /api/kyc/submit:
    post:
      summary: Pengajuan KYC anggota baru
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                nama: { type: string }
                nik: { type: string }
                noHp: { type: string }
                alamat: { type: string }
                pekerjaan: { type: string }
                peran: { type: string, enum: [penabung, peminjam, keduanya] }
  /api/kyc/approve/{id}:
    post:
      summary: Persetujuan KYC (Hanya Pengurus)
      description: Memicu pembuatan EVM Custodial Wallet otomatis di backend.
  /api/loans/apply:
    post:
      summary: Pengajuan Pinjaman baru
      description: Memicu evaluasi risiko EWS menggunakan Gemini Pro Model API.
  /api/loans/sanggah/{id}:
    post:
      summary: Mengajukan pembelaan/hak sanggah algoritma AI EWS
  /api/loans/approve/{id}:
    post:
      summary: Persetujuan pinjaman & inisialisasi Smart Contract Escrow
```

### B. Interface Smart Contract RantaiRenteng (Solidity Mock / ABI Specs)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract RantaiRentengEscrow {
    address public owner; // Alamat relayer koperasi
    uint256 public totalLoanAmount;
    uint256 public totalStages;
    uint256 public currentStage;
    uint256 public amountPerStage;
    
    mapping(address => bool) public isGroupActive;
    mapping(address => uint256) public memberOutstanding;
    bool public isFrozenByGroupDefault; // Jika kelompok memiliki tunggakan, escrow dibekukan

    event StageDisbursed(uint256 stage, uint256 amount);
    event EscrowFrozen(string reason);
    event EscrowUnfrozen();

    constructor(uint256 _totalLoanAmount, uint256 _totalStages) {
        owner = msg.sender;
        totalLoanAmount = _totalLoanAmount;
        totalStages = _totalStages;
        amountPerStage = _totalLoanAmount / _totalStages;
        currentStage = 0;
        isFrozenByGroupDefault = false;
    }

    // Melakukan pencairan dana tahap berikutnya ke address relayer / anggota
    function disburseNextStage() external {
        require(msg.sender == owner, "Only relayer can disburse");
        require(!isFrozenByGroupDefault, "Escrow frozen due to group unpaid installments");
        require(currentStage < totalStages, "All stages already disbursed");
        
        currentStage++;
        emit StageDisbursed(currentStage, amountPerStage);
    }

    // Bekukan escrow jika ada anggota sekelompok yang macet bayar cicilan
    function setFreezeState(bool _state) external {
        require(msg.sender == owner, "Only relayer can set state");
        isFrozenByGroupDefault = _state;
        if (_state) {
            emit EscrowFrozen("Group default detected");
        } else {
            emit EscrowUnfrozen();
        }
    }
}
```

---

## 5. Rencana Kerja Claude Code (Actionable Implementation Plan)

Langkah-langkah yang harus dieksekusi di Claude Code untuk mengkonversi mockup lokal ini menjadi sistem produksi siap deploy:

### Tahap 1: Inisialisasi Project NestJS & ORM (Database)
1.  **Generate NestJS Backend**: Buat project baru NestJS di folder `/backend`.
2.  **Konfigurasi TypeORM / Prisma**: Hubungkan ke database PostgreSQL menggunakan skema yang ada di ERD.
3.  **Setup Migrasi & Seed**: Gunakan script SQL di atas untuk melakukan seed data otomatis saat inisialisasi.
4.  **Uji Lint & Compile**: Pastikan linting dan type checks backend lulus 100%.

### Tahap 2: Custodial Wallet & Web3 Integration (`viem`)
1.  **Install viem**: Tambahkan package `viem` untuk interaksi ke EVM Node.
2.  **Wallet Custodial Generator**: Buat module di NestJS yang otomatis meng-generate HD Wallet dan menyimpan wallet address serta encrypted private key ke DB saat e-KYC disetujui.
3.  **Relayer Service**: Buat relay service yang menandatangani transaksi blockchain atas nama user menggunakan gas fee dari wallet utama pengurus (Koperasi Master Wallet).

### Tahap 3: Gemini EWS API Module
1.  **Install SDK Gemini**: Tambahkan `@google/genai` untuk server-side.
2.  **Prompt Engineering**: Buat module service yang memparsing histori keuangan anggota, tingkat kehadiran kelompok, serta alasan pengajuan pinjaman ke Gemini 1.5/2.0 Flash untuk mendapatkan skor penilaian risiko objektif dan butir alasan rekomendasinya.

### Tahap 4: Dashboard FE Integration & API Client
1.  **Pindahkan Views ke Pages Berbeda**:
    *   Ubah alur SPA agar mendukung multi-route.
    *   Laman Anggota diletakkan di rute root `/` (responsif untuk mobile).
    *   Panel Pengurus dipisahkan ke rute `/laman-pengurus/...`.
2.  **API Client & Axios Setup**: Konfigurasi client-side untuk melakukan query data real-time ke port 3000 NestJS API backend (menggantikan mockup statis `mockData.ts`).

---

## 6. Master Markdown Prompt untuk Claude Code

Salin instruksi terstruktur di bawah ini, lalu tempelkan ke **Claude Code CLI** di komputer lokal Anda untuk membimbing Claude mendevelop seluruh fungsionalitas di atas secara akurat:

```markdown
# MASTER PROMPT: Bootstrap RantaiRenteng Production System

You are tasked with engineering and bootstrapping the production-grade codebase for "RantaiRenteng", a modern digital microfinance platform featuring social collateral (tanggung renteng), Web3-driven custodial wallets (using `viem`), and AI-powered Risk Screening (using Gemini API).

## 1. Stack & Directory Specifications
1. **Frontend**: React (Vite, TypeScript, Tailwind CSS) from the current mockup.
   - Separate routes: `/laman-pengurus` for the Pengurus (Admins) desktop dashboard, and `/` (or mobile-first route) for Members.
   - Use Lucide React icons, and styling based on the Warm Coral aesthetic: `#F06A6A` (Coral), `#FAF9F8` (Warm Off-white bg), and `#1E1F21` (Charcoal text).
2. **Backend**: NestJS (TypeScript, PostgreSQL, Redis, `@google/genai` for Gemini API, `viem` for blockchain operations, and AWS S3 SDK for KTP upload).
3. **Architecture**: Clean, modular full-stack configuration with solid TypeScript schemas. Use TypeORM or Prisma for PostgreSQL models matching the ERD specs below.

## 2. PostgreSQL Schema Database Definition
Implement the following relational tables and relations:
- `members`: ID (UUID, PK), nama, nik (UNIQUE), no_hp, alamat, pekerjaan, peran, status_kyc (Requested/Approved/Rejected), skor_keanggotaan (0-100), ktp_url, simpanan_pokok, simpanan_wajib, simpanan_sukarela, is_dorman, is_uzur, jumlah_izin_uzur, wallet_address, created_at, updated_at.
- `groups`: ID (UUID, PK), nama, ketua_id (FK -> members.id), plafon_maks, jadwal_pertemuan, kehadiran_rate, kas_sosial, reputasi_komunitas, kode_undangan, created_at, updated_at.
- `member_groups`: member_id (FK), group_id (FK), joined_at. (Composite PK)
- `loans`: ID (UUID, PK), member_id, group_id, nominal, tujuan, tenor, status (Diajukan/Disetujui/Cair/Lunas/Mangkir/Ditunda), status_cicilan (PAID/UNPAID/TUNGGAKAN/DITALANGI), sisa_cicilan, cicilan_bulanan, jadwal_cicilan, skor_ai, flag_ai (HIJAU/KUNING/MERAH), flag_alasan (JSONB), is_sanggah (boolean), sanggah_alasan, escrow_contract_address.
- `saving_transactions`: ID (UUID, PK), member_id, jenis, nominal, tanggal, metode, status, tx_hash.
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
- Read `/src/types.ts` and `/src/components/AnggotaView.tsx` from the existing code to preserve mockup fields exactly.
- Build production-ready controllers, guards, endpoints, and fully hook up the frontend React client. No mocks. All API endpoints must talk to the PostgreSQL backend database with proper error handling.

Begin bootstrapping the project by structuring the folders and database modules first.
```
