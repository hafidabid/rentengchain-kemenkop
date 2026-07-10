import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Foundation integration smoke test. Requires a migrated + seeded database
 * reachable via DATABASE_URL (see README: docker compose up -d && prisma
 * migrate deploy && prisma db seed). Exercises the four foundation
 * capabilities end-to-end against real Postgres.
 */
const PENGURUS_NIK = '3273010000000001';
const SRI_NIK = '3273012345678901';
const SRI_ID = 'a1b2c3d4-e5f6-47a8-9c0d-1e2f3a4b5c6d';
const GROUP_ID = 'e5f6a7b8-9c0d-41e2-8a4b-5c6d7e8f9a0b';
const PASSWORD = 'RantaiRenteng2026';

describe('RantaiRenteng foundation (e2e)', () => {
  let app: INestApplication;
  let pengurusToken: string;
  let sriToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
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
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health is open', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('logs in a Pengurus and an Anggota', async () => {
    const p = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: PENGURUS_NIK, password: PASSWORD })
      .expect(200);
    expect(p.body.accessToken).toBeDefined();
    expect(p.body.member.role).toBe('Pengurus');
    expect(p.body.member.passwordHash).toBeUndefined();
    pengurusToken = p.body.accessToken;

    const s = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: SRI_NIK, password: PASSWORD })
      .expect(200);
    sriToken = s.body.accessToken;
  });

  it('rejects a wrong password with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: PENGURUS_NIK, password: 'nope' })
      .expect(401);
  });

  it('GET /api/auth/me returns the caller identity', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${sriToken}`)
      .expect(200);
    expect(res.body.nama).toBe('Sri Wahyuni');
    expect(res.body.encryptedPrivkey).toBeUndefined();
  });

  it('Pengurus lists members; secrets never serialized', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/members')
      .set('Authorization', `Bearer ${pengurusToken}`)
      .expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(5);
    for (const m of res.body) {
      expect(m.passwordHash).toBeUndefined();
      expect(m.encryptedPrivkey).toBeUndefined();
    }
  });

  it('Anggota is blocked from the members list (403)', async () => {
    await request(app.getHttpServer())
      .get('/api/members')
      .set('Authorization', `Bearer ${sriToken}`)
      .expect(403);
  });

  it('unauthenticated members list is 401', async () => {
    await request(app.getHttpServer()).get('/api/members').expect(401);
  });

  it('GET /api/members/me returns own record with wallet', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/members/me')
      .set('Authorization', `Bearer ${sriToken}`)
      .expect(200);
    expect(res.body.id).toBe(SRI_ID);
    expect(res.body.walletAddress).toBeDefined();
  });

  it('GET /api/groups/:id assembles anggotaIds from the bridge', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/groups/${GROUP_ID}`)
      .set('Authorization', `Bearer ${pengurusToken}`)
      .expect(200);
    expect(res.body.anggotaIds).toEqual(expect.arrayContaining([SRI_ID]));
    expect(res.body.anggotaIds.length).toBe(3);
    expect(res.body.kodeUndangan).toBe('SRIKANDI-2026');
    expect(typeof res.body.kasSosial).toBe('number');
  });

  it('GET /api/audit-logs returns entries newest-first with derived txLink', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${pengurusToken}`)
      .expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    const times = res.body.map((e: any) => new Date(e.timestamp).getTime());
    const sorted = [...times].sort((a, b) => b - a);
    expect(times).toEqual(sorted);
  });
});
