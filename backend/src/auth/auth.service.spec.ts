import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { member: { findUnique: jest.Mock } };
  let jwt: { signAsync: jest.Mock };

  const passwordHash = bcrypt.hashSync('correct-horse', 10);
  const pengurus = {
    id: 'm-1',
    nik: '3273010000000001',
    nama: 'Bendahara Koperasi',
    role: 'Pengurus',
    passwordHash,
    simpananPokok: 0,
    simpananWajib: 0,
    simpananSukarela: 0,
    encryptedPrivkey: 'super-secret-key',
  };

  beforeEach(async () => {
    prisma = { member: { findUnique: jest.fn() } };
    jwt = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  // --- Positive ---
  it('issues a role-bearing JWT for valid credentials', async () => {
    prisma.member.findUnique.mockResolvedValue(pengurus);
    const result = await service.login(pengurus.nik, 'correct-horse');

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: 'm-1',
      role: 'Pengurus',
    });
  });

  it('never leaks secrets in the returned member', async () => {
    prisma.member.findUnique.mockResolvedValue(pengurus);
    const result = await service.login(pengurus.nik, 'correct-horse');
    expect((result.member as any).passwordHash).toBeUndefined();
    expect((result.member as any).encryptedPrivkey).toBeUndefined();
  });

  // --- Edge cases ---
  it('rejects a wrong password with 401', async () => {
    prisma.member.findUnique.mockResolvedValue(pengurus);
    await expect(service.login(pengurus.nik, 'wrong')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('rejects an unknown identifier with 401 (no enumeration)', async () => {
    prisma.member.findUnique.mockResolvedValue(null);
    await expect(
      service.login('0000000000000000', 'correct-horse'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a member with no password hash', async () => {
    prisma.member.findUnique.mockResolvedValue({
      ...pengurus,
      passwordHash: null,
    });
    await expect(
      service.login(pengurus.nik, 'correct-horse'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('me() returns the sanitized member', async () => {
    prisma.member.findUnique.mockResolvedValue(pengurus);
    const me = await service.me('m-1');
    expect(me.id).toBe('m-1');
    expect((me as any).passwordHash).toBeUndefined();
  });

  it('me() throws for an unknown user id', async () => {
    prisma.member.findUnique.mockResolvedValue(null);
    await expect(service.me('nope')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
