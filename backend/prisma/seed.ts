/**
 * Idempotent demo seed. Mirrors the four narrative personas from
 * brainstorm/gstudio/CLAUDE_PLAN.md plus a Pengurus account for auth.
 *
 * Run: npm run prisma:seed   (or: prisma db seed)
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Fixed UUIDs so later flow changes can reference stable ids.
const IDS = {
  sri: 'a1b2c3d4-e5f6-47a8-9c0d-1e2f3a4b5c6d',
  deni: 'b2c3d4e5-f6a7-48b9-8d1e-2f3a4b5c6d7e',
  ani: 'c3d4e5f6-a7b8-49c0-9e2f-3a4b5c6d7e8f',
  ira: 'd4e5f6a7-b89c-40d1-8f3a-4b5c6d7e8f9a',
  pengurus: 'e0000000-0000-4000-8000-000000000001',
  group: 'e5f6a7b8-9c0d-41e2-8a4b-5c6d7e8f9a0b',
  loanSri: 'f6a7b89c-0d1e-42f3-8b5c-6d7e8f9a0b1c',
  loanDeni: 'a7b89c0d-1e2f-43a4-9c6d-7e8f9a0b1c2d',
  loanAni: 'b89c0d1e-2f3a-44b5-8d7e-8f9a0b1c2d3e',
  savSri1: 'c9d0e1f2-a3b4-45c6-9e8f-9a0b1c2d3e4f',
  savSri2: 'd0e1f2a3-b4c5-46d7-8f9a-0b1c2d3e4f5a',
  auditReleased: 'e1f2a3b4-c5d6-47e8-9a0b-1c2d3e4f5a6b',
  auditRenteng: 'f2a3b4c5-d6e7-48f9-8b1c-2d3e4f5a6b7c',
};

// All demo accounts share this password; login identifier is the member's NIK.
const DEMO_PASSWORD = 'RantaiRenteng2026';

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // --- Members (upsert = idempotent) ---
  await prisma.member.upsert({
    where: { id: IDS.sri },
    update: {},
    create: {
      id: IDS.sri,
      nama: 'Sri Wahyuni',
      nik: '3273012345678901',
      noHp: '081234567890',
      alamat: 'RT 03/RW 04, Desa Mekar Sari, Bandung',
      pekerjaan: 'Pengusaha Kripik Tempe',
      peran: 'keduanya',
      statusKyc: 'Approved',
      skorKeanggotaan: 98,
      ktpUrl: null,
      simpananPokok: 100000,
      simpananWajib: 450000,
      simpananSukarela: 300000,
      walletAddress: '0x1234567890123456789012345678901234567890',
      role: 'Anggota',
      passwordHash,
    },
  });

  await prisma.member.upsert({
    where: { id: IDS.deni },
    update: {},
    create: {
      id: IDS.deni,
      nama: 'Deni Ramdani',
      nik: '3273019876543210',
      noHp: '081398765432',
      alamat: 'RT 03/RW 04, Desa Mekar Sari, Bandung',
      pekerjaan: 'Peternak Ayam',
      peran: 'keduanya',
      statusKyc: 'Approved',
      skorKeanggotaan: 75,
      ktpUrl: null,
      simpananPokok: 100000,
      simpananWajib: 350000,
      simpananSukarela: 150000,
      isUzur: true,
      jumlahIzinUzur: 1,
      walletAddress: '0x2345678901234567890123456789012345678901',
      role: 'Anggota',
      passwordHash,
    },
  });

  await prisma.member.upsert({
    where: { id: IDS.ani },
    update: {},
    create: {
      id: IDS.ani,
      nama: 'Anisa Triana',
      nik: '3273011122334455',
      noHp: '081511223344',
      alamat: 'RT 01/RW 04, Desa Mekar Sari, Bandung',
      pekerjaan: 'Penjual Warung Kelontong',
      peran: 'peminjam',
      statusKyc: 'Approved',
      skorKeanggotaan: 45,
      ktpUrl: null,
      simpananPokok: 100000,
      simpananWajib: 200000,
      simpananSukarela: 50000,
      isDorman: true,
      walletAddress: '0x3456789012345678901234567890123456789012',
      role: 'Anggota',
      passwordHash,
    },
  });

  await prisma.member.upsert({
    where: { id: IDS.ira },
    update: {},
    create: {
      id: IDS.ira,
      nama: 'Ira Maya Sofa',
      nik: '3273014455667788',
      noHp: '081944556677',
      alamat: 'RT 02/RW 04, Desa Mekar Sari, Bandung',
      pekerjaan: 'Pengrajin Anyaman Bambu',
      peran: 'peminjam',
      statusKyc: 'Requested',
      skorKeanggotaan: 100,
      ktpUrl: null,
      role: 'Anggota',
      passwordHash,
    },
  });

  // --- Pengurus (admin) account: the actor missing from the mockup ---
  await prisma.member.upsert({
    where: { id: IDS.pengurus },
    update: {},
    create: {
      id: IDS.pengurus,
      nama: 'Bendahara Koperasi',
      nik: '3273010000000001',
      noHp: '081200000001',
      alamat: 'Kantor Koperasi Mekar Sari, Bandung',
      pekerjaan: 'Pengurus Koperasi',
      peran: 'penabung',
      statusKyc: 'Approved',
      skorKeanggotaan: 100,
      role: 'Pengurus',
      passwordHash,
    },
  });

  // --- Group ---
  await prisma.group.upsert({
    where: { id: IDS.group },
    update: {},
    create: {
      id: IDS.group,
      nama: 'Mekar Wangi Srikandi',
      ketuaId: IDS.sri,
      plafonMaks: 15000000,
      jadwalPertemuan: 'Setiap Tanggal 5',
      kehadiranRate: 96.5,
      kasSosial: 850000,
      reputasiKomunitas: 'baik',
      kodeUndangan: 'SRIKANDI-2026',
    },
  });

  // --- Member-group bridge ---
  for (const memberId of [IDS.sri, IDS.deni, IDS.ani]) {
    await prisma.memberGroup.upsert({
      where: { memberId_groupId: { memberId, groupId: IDS.group } },
      update: {},
      create: { memberId, groupId: IDS.group },
    });
  }

  // --- Loans ---
  await prisma.loan.upsert({
    where: { id: IDS.loanSri },
    update: {},
    create: {
      id: IDS.loanSri,
      memberId: IDS.sri,
      groupId: IDS.group,
      nominal: 5000000,
      tujuan: 'Membeli bahan baku kripik tempe ekstra untuk Idul Adha',
      tenor: 10,
      status: 'Cair',
      statusCicilan: 'PAID',
      sisaCicilan: 2,
      cicilanBulanan: 550000,
      jadwalCicilan: 'Setiap Tanggal 5',
      skorAi: 95,
      flagAi: 'HIJAU',
      flagAlasan: [
        'Histori pembayaran tepat waktu 100%',
        'Rasio tabungan wajib sehat (>35%)',
        'Kelompok aktif berkehadiran tinggi',
      ],
      escrowContractAddress: '0x8888888888888888888888888888888888888888',
    },
  });

  await prisma.loan.upsert({
    where: { id: IDS.loanDeni },
    update: {},
    create: {
      id: IDS.loanDeni,
      memberId: IDS.deni,
      groupId: IDS.group,
      nominal: 3000000,
      tujuan: 'Pengembangan kandang ayam petelur baru',
      tenor: 6,
      status: 'Cair',
      statusCicilan: 'DITALANGI',
      sisaCicilan: 5,
      cicilanBulanan: 530000,
      jadwalCicilan: 'Setiap Tanggal 5',
      skorAi: 72,
      flagAi: 'KUNING',
      flagAlasan: [
        'Kehadiran kelompok sempat turun di bulan lalu',
        'Ada ketergantungan harga pakan ternak di pasar lokal',
      ],
      escrowContractAddress: '0x9999999999999999999999999999999999999999',
    },
  });

  await prisma.loan.upsert({
    where: { id: IDS.loanAni },
    update: {},
    create: {
      id: IDS.loanAni,
      memberId: IDS.ani,
      groupId: IDS.group,
      nominal: 4000000,
      tujuan: 'Restocking sembako warung dan renovasi atap bocor',
      tenor: 12,
      status: 'Diajukan',
      statusCicilan: 'UNPAID',
      sisaCicilan: 12,
      cicilanBulanan: 360000,
      jadwalCicilan: 'Setiap Tanggal 5',
      skorAi: 38,
      flagAi: 'MERAH',
      flagAlasan: [
        'Status tabungan tidak aktif dalam 3 bulan terakhir',
        'Warung sepi kompetitor baru ritel modern',
        'Sering absen pertemuan bulanan kelompok',
      ],
      isSanggah: true,
      sanggahAlasan:
        'Saya berjanji akan mengaktifkan kembali tabungan saya. Warung saya sekarang sudah bekerjasama dengan supplier anyar untuk harga grosir yang lebih murah, omzet dijamin naik.',
    },
  });

  // --- Saving transactions ---
  await prisma.savingTransaction.upsert({
    where: { id: IDS.savSri1 },
    update: {},
    create: {
      id: IDS.savSri1,
      memberId: IDS.sri,
      jenis: 'Pokok',
      nominal: 100000,
      metode: 'QRIS',
      status: 'PAID',
      txHash:
        '0x7777777777777777777777777777777777777777777777777777777777777777',
    },
  });

  await prisma.savingTransaction.upsert({
    where: { id: IDS.savSri2 },
    update: {},
    create: {
      id: IDS.savSri2,
      memberId: IDS.sri,
      jenis: 'Wajib',
      nominal: 50000,
      metode: 'QRIS',
      status: 'PAID',
      txHash:
        '0xaaaaaaaabbbbbbbbccccccccddddddddeeeeeeeeffffffff0000000011111111',
    },
  });

  // --- Audit logs ---
  await prisma.auditLog.upsert({
    where: { id: IDS.auditReleased },
    update: {},
    create: {
      id: IDS.auditReleased,
      aktor: 'System Escrow Relayer',
      aksi: 'PENCAIRAN_ESCROW_RELEASED',
      detail:
        'Pencairan dana pinjaman milik Sri Wahyuni sebesar Rp5.000.000 sukses direkam di blok #1928374',
    },
  });

  await prisma.auditLog.upsert({
    where: { id: IDS.auditRenteng },
    update: {},
    create: {
      id: IDS.auditRenteng,
      aktor: 'Pengurus (Bendahara)',
      aksi: 'TANGGUNG_RENTENG_TRIGGERED',
      detail:
        'Mengaktifkan talangan kas sosial kelompok Mekar Wangi Srikandi untuk cicilan tertunggak milik Deni Ramdani sebesar Rp530.000',
    },
  });

  // eslint-disable-next-line no-console
  console.log(
    'Seed complete: 5 members (4 personas + 1 Pengurus), 1 group, 3 loans, 2 savings, 2 audit logs.',
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
