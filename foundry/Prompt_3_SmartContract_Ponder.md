# Prompt 3 — Smart Contract EVM (tracking-only) + Indexer Ponder

> **Cara pakai:** Jalankan di repo terpisah `rantairenteng-chain/` (Claude Code / Foundry). Tujuan blockchain di sini **hanya untuk tracking & audit immutable** — BUKAN memindahkan uang. Tidak ada stablecoin. Uang nyata tetap lewat QRIS/payment gateway di backend.
>
> **Sumber kebenaran domain:** prototipe frontend `rantairenteng/` (Vite + React 19, sudah diverifikasi jalan di `localhost:3000`). Semua status, alur, dan angka di prompt ini diambil langsung dari kode prototipe (`src/types.ts`, `src/App.tsx`, `src/components/AnggotaView.tsx`, `src/components/PengurusView.tsx`, `src/components/RiskScreenerTool.tsx`). Kontrak & indexer HARUS memakai kosakata status yang sama supaya backend NestJS nanti tinggal memetakan 1:1.

---

## Konteks & Prinsip

RantaiRenteng memakai chain hanya sebagai **buku besar transparan yang tak bisa diubah** untuk mencatat peristiwa koperasi (simpanan, pinjaman, cicilan, status tanggung renteng, keputusan skrining AI). Nilai token **tidak mewakili uang riil** — hanya unit pencatatan/poin/posisi. Semua penyelesaian dana terjadi off-chain (QRIS/kas tunai). Backend (NestJS) mengirim event via `LedgerAnchorService`.

> Catatan penting: prototipe saat ini **client-side only** (state React di memori, tanpa backend). Artinya repo chain ini yang **mendefinisikan kosakata event kanonik** — backend menyusul dan wajib mengikuti ABI/event yang dirancang di sini.

## Domain Model dari Prototipe (WAJIB diikuti)

Hasil studi kode prototipe — inilah state machine & aturan bisnis yang harus direpresentasikan on-chain:

### Anggota (`Member`)
- e-KYC: `statusKyc` = `Requested` → `Approved` | `Rejected`. Saat approve, pengurus mengaktifkan wallet & mencatat **Simpanan Pokok Rp100.000** (sekali seumur keanggotaan).
- `skorKeanggotaan` 0–100, berubah karena event (lihat "Skor" di bawah).
- Flag: `isDorman` (nonaktif), `isUzur` (sakit/musibah), `jumlahIzinUzur` (**maks 2×/tahun** — enforce atau minimal catat di event).
- PII (nama, NIK, noHp, alamat, pekerjaan, foto KTP) **TIDAK PERNAH** ke chain — hanya `memberHash`.

### Kelompok (`Group`)
- Punya `ketua` (1 anggota), daftar anggota, `plafonMaks` (5/10/15 juta), `kasSosial` (saldo kas sosial dalam rupiah), `kodeUndangan` (mis. `MAWAR9` — on-chain simpan **hash**-nya saja), `reputasiKomunitas` (`baik`/`cukup`/`kurang`), jadwal & `kehadiranRate` (kehadiran tetap off-chain, cukup di-anchor agregatnya bila perlu).
- Anggota bisa join via kode undangan atau daftar terbuka — dua-duanya cukup jadi satu event `MemberJoinedGroup`.

### Pinjaman (`Loan`) — state machine
- Status pengajuan: `Diajukan` → `Disetujui`/`Cair` | `Ditunda` | `Mangkir`; berakhir `Lunas` (saat `sisaCicilan` = 0).
- Status cicilan periode berjalan: `PAID` | `UNPAID` | `TUNGGAKAN` | `DITALANGI`.
- `cicilanBulanan` di prototipe = `round(nominal × 1.1 / tenor)` (bunga flat 10% — jangan hitung di kontrak, cukup terima nilainya dari backend; kontrak hanya mencatat).
- Setiap pengajuan membawa hasil skrining AI: `skorAi` 0–100 + `flagAi` (`HIJAU` ≥70 tanpa flag, `KUNING` <70 atau ada open flag, `MERAH` <50 atau ada flag serius terverifikasi) + daftar alasan. Anggota punya **hak sanggah** (`isSanggah` + alasan) yang ditinjau di musyawarah.

### Empat jalur penanganan gagal bayar (INTI tanggung renteng — bedakan dengan tegas!)
1. **Lancar**: bayar via QRIS sebelum jatuh tempo → `RepaymentRecorded(onTime=true)`, skor naik.
2. **Uzur (sakit/musibah)**: pengurus tandai `markHardship` → denda nonaktif, **skor TIDAK dipotong**. Dua opsi lanjutan:
   - **Kas Sosial menalangi** (`applySocialFund`): hanya jika `kasSosial ≥ cicilanBulanan`; saldo kas sosial dikurangi, periode dianggap `PAID`, tanpa penalti.
   - **Restrukturisasi** (`restructure`): cicilan bulanan dipotong (prototipe: ×0.6), tenor diperpanjang (prototipe: +3 bulan), periode berjalan direlief jadi `PAID`. Kontrak terima `newInstallment` & `newRemaining` sebagai parameter, jangan hardcode formula.
3. **Telat tanpa kabar (tenggang habis)**: `activateRenteng` → status cicilan `DITALANGI` (grup patungan menalangi), skor pelanggar **-15**, tercatat **utang talangan** ke grup. Pelunasan talangan oleh anggota = event terpisah `TalanganRepaid` yang memulihkan status.
4. **Mangkir berulang**: flag `MERAH`, **escrow gate**: blokir pengajuan/pencairan baru untuk anggota (dan turunkan reputasi grup), jadwalkan musyawarah mediasi → `SanctionApplied` sesuai AD/ART.

### Simpanan (`Savings`)
- Jenis: `Pokok` (Rp100rb sekali, saat KYC approve), `Wajib` (**Rp50.000/bulan, dipatok AD/ART**), `Sukarela` (bebas). Metode `QRIS`/`Cash` — dicatat sebagai atribut event.

### Skor keanggotaan (delta yang di-anchor sebagai event)
- +2 setor simpanan, +3–4 bayar cicilan tepat waktu, **-15 saat tanggung renteng aktif**, netral saat uzur. Kontrak tidak perlu menyimpan skor sebagai state — cukup emit `ScoreAdjusted(memberHash, delta, reasonCode)`; nilai skor final dihitung indexer/backend.

---

## Ketentuan teknis

- **Chain**: EVM-compatible, chain murah (mis. Base/Polygon/Arbitrum testnet dulu). **Solidity ^0.8.24**, **Foundry** (forge/anvil) + OpenZeppelin.
- **Gas abstraction**: kontrak dipanggil oleh **relayer** backend (custodial) → anggota tak bayar gas. Sediakan role `RELAYER`.
- **Akses**: `AccessControl` OpenZeppelin. Roles: `ADMIN`, `RELAYER`, `KOPERASI` (registrar). Kontrak bersifat **non-upgradeable/immutable** untuk menyederhanakan deployment hackathon; gunakan constructor untuk konfigurasi awal dan tetap sediakan `Pausable` sebagai mekanisme penghentian darurat.
- **Tidak ada** transfer nilai finansial nyata; token = representasi tracking (`soulbound`/non-transferable).
- Satuan nominal: **rupiah utuh sebagai `uint256`** (tanpa desimal), konsisten dengan prototipe.

### Kontrak yang dibuat (cukup ini saja)

1. **`RRParticipationToken` (ERC20, non-transferable/soulbound)** — unit pencatatan "poin simpanan/kontribusi" per anggota (paralel dengan `skorKeanggotaan` + akumulasi simpanan di prototipe). Mint/burn hanya oleh RELAYER saat event simpanan/cicilan/renteng tercatat. `transfer`/`approve` di-disable (override revert). Tujuan: jejak akumulasi kontribusi anggota, bukan uang.

2. **`RRLoanPosition` (ERC1155)** — tiap `id` = satu posisi pinjaman. Metadata/state melacak status pengajuan (`Diajukan`/`Disetujui`/`Cair`/`Ditunda`/`Mangkir`/`Lunas`) dan status cicilan (`PAID`/`UNPAID`/`TUNGGAKAN`/`DITALANGI`) — pakai enum Solidity dengan nama yang sama. Non-transferable.

3. **`TanggungRentengEscrow` (custom contract)** — inti logika joint-liability sebagai **state machine tracking** (bukan kustodi dana riil):
   - Registrasi koperasi & grup (`registerGroup`: memberHashes, ketuaHash, plafon, hash kode undangan), join anggota (`joinGroup`).
   - Pencatatan KYC approve (`registerMember`) + simpanan (`recordSavings(jenis, nominal, metode)`).
   - Pembuatan pinjaman (`createLoan`: nominal, tenor, cicilanBulanan, skorAi, flagAi) → jadwal cicilan per periode; persetujuan/pencairan/penundaan (`approveLoan`/`disburseLoan`/`deferLoan`).
   - Catat pembayaran cicilan (`recordRepayment(loanId, period, onTime)`) via RELAYER → update status, auto-`Lunas` saat periode habis.
   - **Jalur uzur**: `markHardship`/`clearHardship` (validasi/catat kuota 2×/tahun), `applySocialFund` (cek & kurangi saldo kas sosial grup yang di-mirror on-chain), `restructure(newInstallment, newRemaining)`.
   - **Gate tanggung renteng**: jika anggota `UNPAID` melewati tenggang, `activateRenteng` → tandai `DITALANGI` + `RENTENG_ACTIVE` di level grup; catat utang talangan; **blokir pengajuan/pencairan baru** (flag) untuk anggota/grup sampai `repayTalangan` melunasi.
   - Sanksi mangkir (`applySanction`) & hak sanggah (`fileAppeal(loanId, reasonHash)` / `resolveAppeal`).
   - Anchor hasil skrining AI (`recordScreening(loanId, skorAi, flagAi, paramsHash)`) supaya keputusan EWS bisa diaudit (transparansi human-in-the-loop).
   - Semua perubahan memancarkan **event** kaya-data untuk indexer.

### Events (WAJIB, untuk indexer)

Rancang minimal (semua menyertakan `koperasiId`, `groupId` bila relevan, `memberHash`, `timestamp`):

- Keanggotaan & grup: `MemberRegistered(memberHash, koperasiId)` (saat KYC approve), `GroupRegistered(groupId, ketuaHash, plafonMaks, inviteCodeHash)`, `MemberJoinedGroup(groupId, memberHash)`.
- Simpanan: `SavingsRecorded(memberHash, jenis {POKOK|WAJIB|SUKARELA}, nominal, metode {QRIS|CASH})`.
- Pinjaman: `LoanCreated(loanId, memberHash, groupId, nominal, tenor, cicilanBulanan)`, `ScreeningRecorded(loanId, skorAi, flagAi {HIJAU|KUNING|MERAH}, paramsHash)`, `LoanApproved`, `LoanDisbursed`, `LoanDeferred` (Ditunda), `InstallmentScheduled(loanId, period, dueDate, amount)`, `RepaymentRecorded(loanId, memberHash, period, amount, onTime)`, `LoanClosed(loanId)` (Lunas).
- Tanggung renteng & mitigasi: `HardshipMarked(memberHash, uzurCountThisYear)` / `HardshipCleared`, `SocialFundApplied(groupId, loanId, amount, kasSosialSisa)`, `RentengActivated(groupId, loanId, memberHash, talanganAmount)`, `TalanganRepaid(groupId, loanId, memberHash, amount)`, `LoanRestructured(loanId, oldInstallment, newInstallment, oldRemaining, newRemaining)`, `SanctionApplied(memberHash, loanId, sanctionType)`, `AppealFiled(loanId, memberHash, reasonHash)` / `AppealResolved(loanId, accepted)`.
- Skor: `ScoreAdjusted(memberHash, delta, reasonCode {SAVINGS|ONTIME_REPAY|RENTENG_PENALTY|...})`.

### Yang harus kamu hasilkan
1. Struktur Foundry lengkap (`src/`, `test/`, `script/`), OpenZeppelin terpasang.
2. Ketiga kontrak + interface + NatSpec. Non-transferable enforced. Kontrak non-upgradeable + Pausable + AccessControl. Enum status **persis** memakai nama dari prototipe (`Diajukan`…`Lunas`, `PAID`…`DITALANGI`) supaya mapping backend bebas ambigu.
3. **Test Foundry** menyeluruh — satu test per skenario simulasi prototipe (`App.tsx` punya 7 skenario):
   - Positif: bayar tepat waktu → `onTime=true`, skor naik, loan `Lunas` di akhir tenor.
   - Uzur: markHardship → applySocialFund (kas cukup) dan revert/fallback saat kas kurang → restructure; kuota uzur ke-3 dalam setahun ditolak/ditandai.
   - Telat tanpa kabar: tenggang lewat → `RentengActivated`, `DITALANGI`, talangan tercatat, pengajuan baru terblokir, `repayTalangan` memulihkan.
   - Mangkir berulang: sanksi + gate escrow menahan pinjaman baru.
   - e-KYC & grup: register member, buat grup, join via inviteCodeHash.
   - Sanggah: fileAppeal → resolveAppeal.
   - Proteksi role (hanya RELAYER bisa record, hanya ADMIN bisa pause/unpause). Fuzz test untuk perhitungan periode/jadwal & jumlah cicilan.
4. `script/Deploy.s.sol` + `.env.example` (RPC, PRIVATE_KEY relayer, addresses).
5. Catatan keamanan: reentrancy, akses, batas array/loop (daftar anggota grup!), dan **audit checklist** sebelum mainnet.

**PENTING (UU PDP No. 27/2022):** simpan hanya `memberHash` (mis. keccak256 dari NIK+salt per-koperasi) di chain — JANGAN PII asli (nama/NIK/HP/alamat/KTP). Kode undangan & alasan sanggah juga di-hash. Prototipe sudah mensyaratkan **consent** sebelum skrining — `paramsHash` pada `ScreeningRecorded` harus mencakup bukti consent.

---

## Bagian Indexer — **Ponder** (Di luar scope hackathon / stretch goal)

Ponder tidak diimplementasikan dalam build hackathon ini. Event ketiga kontrak tetap dirancang kaya-data agar dapat diindeks kemudian oleh Ponder atau projection service NestJS ke Postgres/GraphQL untuk dashboard dan analitik backend.

### Ketentuan
- `ponder.config.ts`: daftarkan network (testnet dulu), address & ABI ketiga kontrak, `startBlock` = block deploy.
- `ponder.schema.ts`: tabel entitas — `Member` (skor berjalan hasil replay `ScoreAdjusted`, statusUzur, uzurCountYear, isBlocked), `Group` (kasSosialBalance, rentengActive, talanganOutstanding, reputasi), `Loan` (status, statusCicilan, skorAi, flagAi, isSanggah), `Installment`, `Repayment`, `SavingsTx`, `RentengEvent`, `Hardship`, `Sanction`, `Appeal`, `Screening`, plus tabel agregat `GroupStats` & `KoperasiStats`.
- Agregat harus bisa menghidupi **Dashboard EWS pengurus** persis seperti prototipe (`PengurusView.tsx`):
  - `nplRate` = pinjaman `Cair` dengan cicilan `UNPAID` ÷ total pinjaman `Cair` (×100, dibulatkan — rumus persis prototipe),
  - `unpaidCount`, `rentengActiveCount`, `talanganOutstanding`, `onTimeRate` per grup/koperasi,
  - `totalSavings` (pokok+wajib+sukarela), `dormanCount`, jumlah antrean KYC.
- Data untuk **skrining risiko 4 pilar** (`RiskScreenerTool.tsx`) — indexer harus bisa menjawab input Pilar 1 dari riwayat on-chain: rate ketepatan simpanan wajib, rate cicilan tepat waktu, lama keanggotaan (tenure sejak `MemberRegistered`). (Kehadiran pertemuan, kapasitas/DSR, dan referensi sosial tetap off-chain.)
- `src/` handler untuk tiap event → upsert entitas + update agregat.
- Sediakan contoh **query GraphQL** untuk: kesehatan grup (status tiap anggota: Lancar/Uzur/Belum Cicil/Tanggung Renteng — seperti daftar anggota grup di layar HP), riwayat bayar anggota (input skrining Pilar 1), daftar pinjaman menunggak & talangan belum diganti, statistik koperasi untuk dashboard EWS, dan audit trail satu pinjaman dari `LoanCreated` sampai `LoanClosed` (pengganti `AuditLog` prototipe).
- Idempotent & tahan reorg; sertakan `README` cara run (`ponder dev`) + `.env.example` (RPC).

### Definition of Done
- Kontrak: semua test hijau (termasuk 7 skenario prototipe di atas), tidak ada transfer nilai riil, PII tidak di-chain, enum status identik dengan `src/types.ts` prototipe.
- Stretch goal pasca-hackathon: Ponder sinkron dari `startBlock`, entitas & agregat terisi, `nplRate` hasil query sama dengan rumus prototipe untuk data uji yang sama, GraphQL bisa diquery, contoh query terdokumentasi. Item ini tidak memblokir Definition of Done build Foundry hackathon.

Untuk build hackathon, mulai dengan merancang daftar event, lalu implementasi kontrak → test Foundry → deploy testnet. Skema entitas dan implementasi Ponder dikerjakan sebagai stretch goal terpisah.
