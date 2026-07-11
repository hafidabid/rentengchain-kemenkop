import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ContractClientService } from '../src/web3/contract-client.service';

/**
 * Integration e2e for the Pengurus admin-tools endpoints. Exercises the full
 * HTTP -> service -> DB path against the real seeded database, with the on-chain
 * contract client replaced by a deterministic mock so no live transaction is
 * broadcast. Mirrors test/flows.e2e-spec.ts: fresh entities per run (unique
 * 16-digit NIK) keep re-runs collision-free and the seeded demo personas intact.
 *
 * Surfaces covered: KYC review (approve credential + password reset), loan
 * decision notes/history, Pengurus member detail, the grounded assistant, and
 * the e-RAT reports (JSON + XLSX export). No test triggers a bailout, so the
 * seeded group's kasSosial is never mutated and needs no afterAll restore.
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

/** A unique, valid 16-digit NIK (prefix + last-8 of epoch + 3 random digits). */
function freshNik(): string {
  return (
    '99' +
    Date.now().toString().slice(-8) +
    Math.floor(Math.random() * 900 + 100).toString()
  );
}

describe('Pengurus admin tools (e2e)', () => {
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

    pengurusToken = await login(PENGURUS_NIK, PASSWORD);
    sriToken = await login(SRI_NIK, PASSWORD);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Log in with an identifier (NIK) + password; returns the bearer access token. */
  async function login(identifier: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier, password })
      .expect(200);
    return res.body.accessToken;
  }

  /** Submit a fresh KYC member and return the created MemberDto (Requested). */
  async function submitFresh(): Promise<any> {
    const res = await request(app.getHttpServer())
      .post('/api/kyc/submit')
      .send({
        nama: 'Alat Pengurus ' + Date.now(),
        nik: freshNik(),
        noHp: '0812' + Math.floor(Math.random() * 1e8),
        alamat: 'Jl. Testing No. 2',
        pekerjaan: 'Wiraswasta',
        peran: 'peminjam',
      })
      .expect(201);
    return res.body;
  }

  /**
   * Submit + Pengurus-approve a fresh member; returns the Approved response body
   * (a MemberDto plus a one-time `tempPassword`).
   */
  async function createApprovedMember(): Promise<any> {
    const member = await submitFresh();
    const res = await request(app.getHttpServer())
      .post(`/api/kyc/approve/${member.id}`)
      .set('Authorization', `Bearer ${pengurusToken}`)
      .expect(201);
    return res.body;
  }

  /** Apply a loan for a fresh approved member in GROUP_ID; returns the LoanDto. */
  async function applyLoan(): Promise<any> {
    const member = await createApprovedMember();
    const res = await request(app.getHttpServer())
      .post('/api/loans/apply')
      .set('Authorization', `Bearer ${pengurusToken}`)
      .send({
        memberId: member.id,
        groupId: GROUP_ID,
        nominal: 1_500_000,
        tujuan: 'Modal usaha warung',
        tenor: 8,
      })
      .expect(201);
    return res.body;
  }

  // ── KYC review: approval credential + password reset ────────────────────
  describe('KYC review', () => {
    it('approve issues a working tempPassword and marks the member Approved', async () => {
      const member = await submitFresh();

      const approved = await request(app.getHttpServer())
        .post(`/api/kyc/approve/${member.id}`)
        .set('Authorization', `Bearer ${pengurusToken}`)
        .expect(201);

      expect(approved.body.statusKyc).toBe('Approved');
      expect(typeof approved.body.tempPassword).toBe('string');
      expect(approved.body.tempPassword.length).toBeGreaterThan(0);
      expect(approved.body.passwordHash).toBeUndefined();
      expect(approved.body.encryptedPrivkey).toBeUndefined();

      // The issued credential logs the new member in.
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: member.nik, password: approved.body.tempPassword })
        .expect(200);
    });

    it('reset-password rotates the credential: old fails (401), new works (200)', async () => {
      const member = await submitFresh();
      const approved = await request(app.getHttpServer())
        .post(`/api/kyc/approve/${member.id}`)
        .set('Authorization', `Bearer ${pengurusToken}`)
        .expect(201);
      const oldPassword: string = approved.body.tempPassword;

      // Sanity: the original credential works before the reset.
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: member.nik, password: oldPassword })
        .expect(200);

      const reset = await request(app.getHttpServer())
        .post(`/api/kyc/${member.id}/reset-password`)
        .set('Authorization', `Bearer ${pengurusToken}`)
        .expect(201);
      expect(typeof reset.body.tempPassword).toBe('string');
      expect(reset.body.tempPassword.length).toBeGreaterThan(0);
      expect(reset.body.tempPassword).not.toBe(oldPassword);

      // Old credential is dead; new one authenticates.
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: member.nik, password: oldPassword })
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: member.nik, password: reset.body.tempPassword })
        .expect(200);
    });

    it('a non-Pengurus cannot approve (403)', async () => {
      const member = await submitFresh();
      await request(app.getHttpServer())
        .post(`/api/kyc/approve/${member.id}`)
        .set('Authorization', `Bearer ${sriToken}`)
        .expect(403);
    });

    it('a non-Pengurus cannot reset a password (403)', async () => {
      const approved = await createApprovedMember();
      await request(app.getHttpServer())
        .post(`/api/kyc/${approved.id}/reset-password`)
        .set('Authorization', `Bearer ${sriToken}`)
        .expect(403);
    });

    it('resetting an unknown member id is 404', async () => {
      await request(app.getHttpServer())
        .post(`/api/kyc/${RANDOM_UUID}/reset-password`)
        .set('Authorization', `Bearer ${pengurusToken}`)
        .expect(404);
    });
  });

  // ── Loan decision notes + history ───────────────────────────────────────
  describe('Loan notes & decision history', () => {
    it('reject stores the note as catatanPengurus, visible on the loan', async () => {
      const loan = await applyLoan();
      const note = 'Agunan belum lengkap, mohon dilengkapi dulu.';

      const rejected = await request(app.getHttpServer())
        .post(`/api/loans/reject/${loan.id}`)
        .set('Authorization', `Bearer ${pengurusToken}`)
        .send({ note })
        .expect(201);
      expect(rejected.body.catatanPengurus).toBe(note);

      const fetched = await request(app.getHttpServer())
        .get(`/api/loans/${loan.id}`)
        .set('Authorization', `Bearer ${pengurusToken}`)
        .expect(200);
      expect(fetched.body.catatanPengurus).toBe(note);
    });

    it('decisions lists the notes newest-first', async () => {
      const loan = await applyLoan();
      const firstNote = 'Ditunda: dokumen kurang.';
      const secondNote = 'Ditunda lagi: verifikasi ulang penghasilan.';

      for (const note of [firstNote, secondNote]) {
        await request(app.getHttpServer())
          .post(`/api/loans/reject/${loan.id}`)
          .set('Authorization', `Bearer ${pengurusToken}`)
          .send({ note })
          .expect(201);
      }

      const res = await request(app.getHttpServer())
        .get(`/api/loans/${loan.id}/decisions`)
        .set('Authorization', `Bearer ${pengurusToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      const notes = res.body.map((d: any) => d.note);
      expect(notes).toContain(firstNote);
      expect(notes).toContain(secondNote);
      // Newest first: the most recent decision carries the second note.
      expect(res.body[0].note).toBe(secondNote);
      const times = res.body.map((d: any) => new Date(d.createdAt).getTime());
      expect(times).toEqual([...times].sort((a, b) => b - a));
    });

    it('a non-Pengurus cannot read the decision history (403)', async () => {
      const loan = await applyLoan();
      await request(app.getHttpServer())
        .get(`/api/loans/${loan.id}/decisions`)
        .set('Authorization', `Bearer ${sriToken}`)
        .expect(403);
    });
  });

  // ── Pengurus member detail ──────────────────────────────────────────────
  describe('Member detail', () => {
    it('returns member + savings/loans/rentengHistory arrays with no secrets', async () => {
      const approved = await createApprovedMember();

      const res = await request(app.getHttpServer())
        .get(`/api/members/${approved.id}/detail`)
        .set('Authorization', `Bearer ${pengurusToken}`)
        .expect(200);

      expect(res.body.member).toBeDefined();
      expect(res.body.member.id).toBe(approved.id);
      expect(res.body.member.passwordHash).toBeUndefined();
      expect(res.body.member.encryptedPrivkey).toBeUndefined();
      expect(res.body.member.tempPassword).toBeUndefined();
      expect(Array.isArray(res.body.savings)).toBe(true);
      expect(Array.isArray(res.body.loans)).toBe(true);
      expect(Array.isArray(res.body.rentengHistory)).toBe(true);
      // A member never involved in a bailout has an empty renteng history.
      expect(res.body.rentengHistory).toEqual([]);
    });

    it('a non-Pengurus cannot read a member detail (403)', async () => {
      const approved = await createApprovedMember();
      await request(app.getHttpServer())
        .get(`/api/members/${approved.id}/detail`)
        .set('Authorization', `Bearer ${sriToken}`)
        .expect(403);
    });

    it('an unknown member id is 404', async () => {
      await request(app.getHttpServer())
        .get(`/api/members/${RANDOM_UUID}/detail`)
        .set('Authorization', `Bearer ${pengurusToken}`)
        .expect(404);
    });
  });

  // ── Cooperative assistant ───────────────────────────────────────────────
  describe('Assistant', () => {
    it('snapshot returns live aggregates for a Pengurus', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/assistant/snapshot')
        .set('Authorization', `Bearer ${pengurusToken}`)
        .expect(200);

      expect(res.body.aggregates).toBeDefined();
      expect(typeof res.body.aggregates.members.total).toBe('number');
    });

    it('chat degrades gracefully without a Gemini key (configured:false, non-empty reply)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/assistant/chat')
        .set('Authorization', `Bearer ${pengurusToken}`)
        .send({ history: [{ role: 'user', text: 'Berapa total anggota?' }] })
        .expect(201);

      expect(res.body.configured).toBe(false);
      expect(typeof res.body.reply).toBe('string');
      expect(res.body.reply.length).toBeGreaterThan(0);
    });

    it('a non-Pengurus cannot reach the snapshot (403)', async () => {
      await request(app.getHttpServer())
        .get('/api/assistant/snapshot')
        .set('Authorization', `Bearer ${sriToken}`)
        .expect(403);
    });

    it('a non-Pengurus cannot chat (403)', async () => {
      await request(app.getHttpServer())
        .post('/api/assistant/chat')
        .set('Authorization', `Bearer ${sriToken}`)
        .send({ history: [{ role: 'user', text: 'Halo' }] })
        .expect(403);
    });
  });

  // ── e-RAT reports ───────────────────────────────────────────────────────
  describe('Reports (e-RAT)', () => {
    it('returns summary, charts, and tables for a Pengurus', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reports/e-rat')
        .set('Authorization', `Bearer ${pengurusToken}`)
        .expect(200);

      expect(res.body.summary).toBeDefined();
      expect(typeof res.body.summary.totalAnggota).toBe('number');
      expect(res.body.charts).toBeDefined();
      expect(Array.isArray(res.body.charts.loansByFlag)).toBe(true);
      expect(res.body.tables).toBeDefined();
      expect(Array.isArray(res.body.tables.anggota)).toBe(true);
    });

    it('exports an XLSX workbook (spreadsheetml content-type)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reports/e-rat/export.xlsx')
        .set('Authorization', `Bearer ${pengurusToken}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('spreadsheetml');
    });

    it('a non-Pengurus cannot read the report (403)', async () => {
      await request(app.getHttpServer())
        .get('/api/reports/e-rat')
        .set('Authorization', `Bearer ${sriToken}`)
        .expect(403);
    });

    it('a non-Pengurus cannot export the report (403)', async () => {
      await request(app.getHttpServer())
        .get('/api/reports/e-rat/export.xlsx')
        .set('Authorization', `Bearer ${sriToken}`)
        .expect(403);
    });
  });
});
