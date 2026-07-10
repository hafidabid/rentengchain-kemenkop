-- CreateEnum
CREATE TYPE "Peran" AS ENUM ('penabung', 'peminjam', 'keduanya');

-- CreateEnum
CREATE TYPE "StatusKyc" AS ENUM ('Requested', 'Approved', 'Rejected');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('Anggota', 'Pengurus');

-- CreateEnum
CREATE TYPE "ReputasiKomunitas" AS ENUM ('baik', 'cukup', 'kurang');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('Diajukan', 'Disetujui', 'Cair', 'Lunas', 'Mangkir', 'Ditunda');

-- CreateEnum
CREATE TYPE "StatusCicilan" AS ENUM ('PAID', 'UNPAID', 'TUNGGAKAN', 'DITALANGI');

-- CreateEnum
CREATE TYPE "SavingJenis" AS ENUM ('Pokok', 'Wajib', 'Sukarela');

-- CreateEnum
CREATE TYPE "SavingStatus" AS ENUM ('PAID', 'PENDING');

-- CreateTable
CREATE TABLE "members" (
    "id" UUID NOT NULL,
    "nama" VARCHAR(150) NOT NULL,
    "nik" VARCHAR(16) NOT NULL,
    "no_hp" VARCHAR(20) NOT NULL,
    "alamat" TEXT NOT NULL,
    "pekerjaan" VARCHAR(100) NOT NULL,
    "peran" "Peran" NOT NULL,
    "status_kyc" "StatusKyc" NOT NULL,
    "skor_keanggotaan" INTEGER NOT NULL DEFAULT 100,
    "ktp_url" VARCHAR(255),
    "simpanan_pokok" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "simpanan_wajib" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "simpanan_sukarela" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "is_dorman" BOOLEAN NOT NULL DEFAULT false,
    "is_uzur" BOOLEAN NOT NULL DEFAULT false,
    "jumlah_izin_uzur" INTEGER NOT NULL DEFAULT 0,
    "wallet_address" VARCHAR(42),
    "role" "Role" NOT NULL DEFAULT 'Anggota',
    "password_hash" VARCHAR(255),
    "encrypted_privkey" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" UUID NOT NULL,
    "nama" VARCHAR(100) NOT NULL,
    "ketua_id" UUID,
    "plafon_maks" DECIMAL(15,2) NOT NULL DEFAULT 10000000,
    "jadwal_pertemuan" VARCHAR(100) NOT NULL,
    "kehadiran_rate" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "kas_sosial" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "reputasi_komunitas" "ReputasiKomunitas" NOT NULL,
    "kode_undangan" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_groups" (
    "member_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_groups_pkey" PRIMARY KEY ("member_id","group_id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "nominal" DECIMAL(15,2) NOT NULL,
    "tujuan" TEXT NOT NULL,
    "tenor" INTEGER NOT NULL,
    "status" "LoanStatus" NOT NULL,
    "status_cicilan" "StatusCicilan" NOT NULL,
    "sisa_cicilan" INTEGER NOT NULL,
    "cicilan_bulanan" DECIMAL(15,2) NOT NULL,
    "jadwal_cicilan" VARCHAR(100) NOT NULL,
    "skor_ai" INTEGER NOT NULL,
    "flag_ai" VARCHAR(15) NOT NULL,
    "flag_alasan" JSONB NOT NULL DEFAULT '[]',
    "is_sanggah" BOOLEAN NOT NULL DEFAULT false,
    "sanggah_alasan" TEXT,
    "escrow_contract_address" VARCHAR(42),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saving_transactions" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "jenis" "SavingJenis" NOT NULL,
    "nominal" DECIMAL(15,2) NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metode" VARCHAR(50) NOT NULL,
    "status" "SavingStatus" NOT NULL,
    "tx_hash" VARCHAR(66),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saving_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aktor" VARCHAR(150) NOT NULL,
    "aksi" VARCHAR(100) NOT NULL,
    "detail" TEXT NOT NULL,
    "tx_hash" VARCHAR(66),

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "members_nik_key" ON "members"("nik");

-- CreateIndex
CREATE UNIQUE INDEX "groups_kode_undangan_key" ON "groups"("kode_undangan");

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_ketua_id_fkey" FOREIGN KEY ("ketua_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_groups" ADD CONSTRAINT "member_groups_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_groups" ADD CONSTRAINT "member_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saving_transactions" ADD CONSTRAINT "saving_transactions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
