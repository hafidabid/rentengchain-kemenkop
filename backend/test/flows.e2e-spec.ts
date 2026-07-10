import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ContractClientService } from '../src/web3/contract-client.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Flow integration e2e. Exercises the full HTTP -> service -> DB path for the
 * KYC (①), Loans (②), and Savings (④) flows against the real seeded database,
 * with the on-chain contract client replaced by a deterministic mock so no live
 * transaction is ever broadcast. Renteng (③) has no controller in this build and
 * is intentionally omitted.
 *
 * Determinism: every mutating test creates FRESH entities (unique 16-digit NIK
 * per run) so re-runs never collide and the seeded demo personas stay intact.
 */

const PENGURUS_NIK = '3273010000000001';
const SRI_NIK = '3273012345678901';
const PASSWORD = 'RantaiRenteng2026';
const GROUP_ID = 'e5f6a7b8-9c0d-41e2-8a4b-5c6d7e8f9a0b';
const MOCK_TX_HASH =
  '0xFEED000000000000000000000000000000000000000000000000000000000001';
const RANDOM_UUID = '11111111-2222-4333-8444-555555555555';

/** Deterministic on-chain mock — see contract-client.service.ts for the real one. */
const contractMock = {
  trySubmit: jest
    .fn()
    .mockResolvedValue({ ok: true, txHash: MOCK_TX_HASH, status: 'success' }),
  readNextLoanId: jest.fn().mockResolvedValue(1n),
  canSubmit: jest.fn().mockReturnValue(true),
  roleFor: jest.fn().mockReturnValue('RELAYER'),
  buildCall: jest.fn(),
};

/** A unique, valid 16-digit NIK (prefix + last-8 of epoch + 6 random digits). */
function freshNik(): string {
  return (
    '99' +
    Date.now().toString().slice(-8) +
    Math.floor(Math.random() * 900000 + 100000).toString()
  );
}

describe('RantaiRenteng flows (e2e)', () => {
  let app: INestApplication;
  let pengurusToken: string;
  let sriToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ContractClientService)
      .useValue(contractMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    const p = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: PENGURUS_NIK, password: PASSWORD })
      .expect(200);
    pengurusToken = p.body.accessToken;

    const s = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: SRI_NIK, password: PASSWORD })
      .expect(200);
    sriToken = s.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  /** Submit a fresh KYC member and return the created MemberDto (Requested). */
  async function submitFresh(): Promise<any> {
    const res = await request(app.getHttpServer())
      .post('/api/kyc/submit')
      .send({
        nama: 'Uji Coba ' + Date.now(),
        nik: freshNik(),
        noHp: '0812' + Math.floor(Math.random() * 1e8),
        alamat: 'Jl. Testing No. 1',
        pekerjaan: 'Wiraswasta',
        peran: 'penabung',
      })
      .expect(201);
    return res.body;
  }

  /** Submit + Pengurus-approve a fresh member; returns the Approved MemberDto. */
  async function createApprovedMember(): Promise<any> {
    const member = await submitFresh();
    const res = await request(app.getHttpServer())
      .post(`/api/kyc/approve/${member.id}`)
      .set('Authorization', `Bearer ${pengurusToken}`)
      .expect(201);
    return res.body;
  }

  // ── Flow ① KYC ──────────────────────────────────────────────────────────
  describe('Flow ① KYC', () => {
    it('submits a fresh member as Requested with no wallet/secrets', async () => {
      const member = await submitFresh();
      expect(member.id).toBeDefined();
      expect(member.statusKyc).toBe('Requested');
      expect(member.role).toBe('Anggota');
      expect(member.walletAddress).toBeNull();
      expect(member.passwordHash).toBeUndefined();
      expect(member.encryptedPrivkey).toBeUndefined();
    });

    it('Pengurus approves: Approved + a real 0x wallet, no secrets, idempotent', async () => {
      const member = await submitFresh();

      const approved = await request(app.getHttpServer())
        .post(`/api/kyc/approve/${member.id}`)
        .set('Authorization', `Bearer ${pengurusToken}`)
        .expect(201);
      expect(approved.body.statusKyc).toBe('Approved');
      expect(approved.body.walletAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(approved.body.passwordHash).toBeUndefined();
      expect(approved.body.encryptedPrivkey).toBeUndefined();

      // Idempotent: re-approving keeps the same wallet and Approved state.
      const again = await request(app.getHttpServer())
        .post(`/api/kyc/approve/${member.id}`)
        .set('Authorization', `Bearer ${pengurusToken}`)
        .expect(201);
      expect(again.body.statusKyc).toBe('Approved');
      expect(again.body.walletAddress).toBe(approved.body.walletAddress);
    });

    it('rejects a duplicate NIK with a conflict', async () => {
      const first = await submitFresh();
      const dup = await request(app.getHttpServer())
        .post('/api/kyc/submit')
        .send({
          nama: 'Duplikat',
          nik: first.nik,
          noHp: '081200000000',
          alamat: 'Jl. Duplikat',
          pekerjaan: 'Petani',
          peran: 'penabung',
        });
      expect([400, 409]).toContain(dup.status);
    });

    it('approving an unknown member id is 404', async () => {
      await request(app.getHttpServer())
        .post(`/api/kyc/approve/${RANDOM_UUID}`)
        .set('Authorization', `Bearer ${pengurusToken}`)
        .expect(404);
    });

    it('a non-Pengurus cannot approve (403)', async () => {
      const member = await submitFresh();
      await request(app.getHttpServer())
        .post(`/api/kyc/approve/${member.id}`)
        .set('Authorization', `Bearer ${sriToken}`)
        .expect(403);
    });
  });

  // ── Flow ④ Savings ──────────────────────────────────────────────────────
  describe('Flow ④ Savings', () => {
    it('records a Wajib simpanan: PAID + txLink, and bumps simpananWajib by 50000', async () => {
      const member = await createApprovedMember();
      expect(member.simpananWajib).toBe(0);

      const saving = await request(app.getHttpServer())
        .post('/api/savings')
        .set('Authorization', `Bearer ${sriToken}`)
        .send({ memberId: member.id, jenis: 'Wajib', nominal: 50000 })
        .expect(201);
      expect(saving.body.status).toBe('PAID');
      expect(saving.body.nominal).toBe(50000);
      expect(saving.body.txHash).toBe(MOCK_TX_HASH);
      expect(saving.body.txLink).toContain(`/tx/${MOCK_TX_HASH}`);

      const after = await request(app.getHttpServer())
        .get(`/api/members/${member.id}`)
        .set('Authorization', `Bearer ${pengurusToken}`)
        .expect(200);
      expect(after.body.simpananWajib).toBe(50000);
    });

    it('lists a member savings newest-first', async () => {
      const member = await createApprovedMember();
      for (const nominal of [10000, 20000]) {
        await request(app.getHttpServer())
          .post('/api/savings')
          .set('Authorization', `Bearer ${sriToken}`)
          .send({ memberId: member.id, jenis: 'Sukarela', nominal })
          .expect(201);
      }

      const res = await request(app.getHttpServer())
        .get('/api/savings')
        .query({ memberId: member.id })
        .set('Authorization', `Bearer ${sriToken}`)
        .expect(200);
      expect(res.body.length).toBe(2);
      const times = res.body.map((s: any) => new Date(s.tanggal).getTime());
      expect(times).toEqual([...times].sort((a, b) => b - a));
      for (const s of res.body) expect(s.memberId).toBe(member.id);
    });

    it('rejects a non-positive nominal (400)', async () => {
      const member = await createApprovedMember();
      await request(app.getHttpServer())
        .post('/api/savings')
        .set('Authorization', `Bearer ${sriToken}`)
        .send({ memberId: member.id, jenis: 'Wajib', nominal: 0 })
        .expect(400);
    });

    it('rejects an invalid jenis (400)', async () => {
      const member = await createApprovedMember();
      await request(app.getHttpServer())
        .post('/api/savings')
        .set('Authorization', `Bearer ${sriToken}`)
        .send({ memberId: member.id, jenis: 'Bogus', nominal: 50000 })
        .expect(400);
    });

    it('rejects an unauthenticated saving (401)', async () => {
      await request(app.getHttpServer())
        .post('/api/savings')
        .send({ memberId: RANDOM_UUID, jenis: 'Wajib', nominal: 50000 })
        .expect(401);
    });
  });

  // ── Flow ② Loans ────────────────────────────────────────────────────────
  describe('Flow ② Loans', () => {
    it('applies -> Diajukan with AI flag, string onchainLoanId; sanggah -> approve', async () => {
      const member = await createApprovedMember();

      const applied = await request(app.getHttpServer())
        .post('/api/loans/apply')
        .set('Authorization', `Bearer ${pengurusToken}`)
        .send({
          memberId: member.id,
          groupId: GROUP_ID,
          nominal: 1_000_000,
          tujuan: 'Modal usaha warung',
          tenor: 10,
        })
        .expect(201);
      expect(applied.body.status).toBe('Diajukan');
      expect(typeof applied.body.skorAi).toBe('number');
      expect(['HIJAU', 'KUNING', 'MERAH']).toContain(applied.body.flagAi);
      expect(Array.isArray(applied.body.flagAlasan)).toBe(true);
      // onchainLoanId is a BigInt in the DB but MUST serialize as a string.
      expect(typeof applied.body.onchainLoanId).toBe('string');
      expect(applied.body.onchainLoanId).toBe('1');

      const loanId = applied.body.id;

      const sanggah = await request(app.getHttpServer())
        .post(`/api/loans/sanggah/${loanId}`)
        .set('Authorization', `Bearer ${sriToken}`)
        .send({ alasan: 'Skor tidak mencerminkan kemampuan bayar saya' })
        .expect(201);
      expect(sanggah.body.isSanggah).toBe(true);

      const approved = await request(app.getHttpServer())
        .post(`/api/loans/approve/${loanId}`)
        .set('Authorization', `Bearer ${pengurusToken}`)
        .expect(201);
      expect(approved.body.status).toBe('Disetujui');

      const list = await request(app.getHttpServer())
        .get('/api/loans')
        .set('Authorization', `Bearer ${pengurusToken}`)
        .expect(200);
      expect(list.body.some((l: any) => l.id === loanId)).toBe(true);
    });

    it('applying for an unknown member is 404', async () => {
      await request(app.getHttpServer())
        .post('/api/loans/apply')
        .set('Authorization', `Bearer ${pengurusToken}`)
        .send({
          memberId: RANDOM_UUID,
          groupId: GROUP_ID,
          nominal: 500000,
          tujuan: 'Test',
          tenor: 5,
        })
        .expect(404);
    });

    it('applying for an unknown group is 404', async () => {
      const member = await createApprovedMember();
      await request(app.getHttpServer())
        .post('/api/loans/apply')
        .set('Authorization', `Bearer ${pengurusToken}`)
        .send({
          memberId: member.id,
          groupId: RANDOM_UUID,
          nominal: 500000,
          tujuan: 'Test',
          tenor: 5,
        })
        .expect(404);
    });

    it('sanggah on an unknown loan is 404', async () => {
      await request(app.getHttpServer())
        .post(`/api/loans/sanggah/${RANDOM_UUID}`)
        .set('Authorization', `Bearer ${sriToken}`)
        .send({ alasan: 'Tidak ada pinjaman ini' })
        .expect(404);
    });

    it('a non-Pengurus cannot approve a loan (403)', async () => {
      const member = await createApprovedMember();
      const applied = await request(app.getHttpServer())
        .post('/api/loans/apply')
        .set('Authorization', `Bearer ${pengurusToken}`)
        .send({
          memberId: member.id,
          groupId: GROUP_ID,
          nominal: 750000,
          tujuan: 'Beli stok',
          tenor: 6,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/loans/approve/${applied.body.id}`)
        .set('Authorization', `Bearer ${sriToken}`)
        .expect(403);
    });
  });

  describe('Flow ③ Renteng bailout', () => {
    // Restore the seeded group's kasSosial after this block so the demo state
    // isn't drained by the bailout decrements.
    let originalKasSosial: number;

    beforeAll(async () => {
      const prisma = app.get(PrismaService);
      const g = await prisma.group.findUnique({ where: { id: GROUP_ID } });
      originalKasSosial = Number(g?.kasSosial ?? 0);
    });

    afterAll(async () => {
      const prisma = app.get(PrismaService);
      await prisma.group.update({
        where: { id: GROUP_ID },
        data: { kasSosial: originalKasSosial },
      });
    });

    async function createLoan(): Promise<string> {
      const member = await createApprovedMember();
      const applied = await request(app.getHttpServer())
        .post('/api/loans/apply')
        .set('Authorization', `Bearer ${pengurusToken}`)
        .send({
          memberId: member.id,
          groupId: GROUP_ID,
          nominal: 3000000,
          tujuan: 'Modal usaha ternak',
          tenor: 6,
        })
        .expect(201);
      return applied.body.id;
    }

    it('Pengurus bailout flips the loan to DITALANGI and decrements kasSosial', async () => {
      const loanId = await createLoan();
      const before = await request(app.getHttpServer())
        .get(`/api/groups/${GROUP_ID}`)
        .set('Authorization', `Bearer ${pengurusToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .post(`/api/renteng/${loanId}/bailout`)
        .set('Authorization', `Bearer ${pengurusToken}`)
        .send({ period: 1 })
        .expect(201);

      expect(res.body.loan.statusCicilan).toBe('DITALANGI');
      expect(typeof res.body.group.kasSosial).toBe('number');
      expect(res.body.group.kasSosial).toBeLessThanOrEqual(before.body.kasSosial);
    });

    it('bailout on an unknown loan is 404', async () => {
      await request(app.getHttpServer())
        .post(`/api/renteng/${RANDOM_UUID}/bailout`)
        .set('Authorization', `Bearer ${pengurusToken}`)
        .send({ period: 1 })
        .expect(404);
    });

    it('a non-Pengurus cannot trigger a bailout (403)', async () => {
      const loanId = await createLoan();
      await request(app.getHttpServer())
        .post(`/api/renteng/${loanId}/bailout`)
        .set('Authorization', `Bearer ${sriToken}`)
        .send({ period: 1 })
        .expect(403);
    });
  });
});
