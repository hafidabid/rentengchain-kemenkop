import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, Role, StatusKyc } from '@prisma/client';
import { AuditLogService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { OnchainSyncService } from '../web3/onchain-sync.service';
import { WalletService } from '../web3/wallet.service';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { KycService } from './kyc.service';

describe('KycService', () => {
  let service: KycService;
  let prisma: {
    member: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let walletService: { ensureWallet: jest.Mock };
  let onchainSync: { registerMember: jest.Mock };
  let audit: { append: jest.Mock };

  const WALLET = '0x1111111111111111111111111111111111111111';

  const requestedMember = {
    id: 'm-ira',
    nama: 'Ira',
    nik: '3273010000000009',
    noHp: '081200000009',
    alamat: 'Jl. Mekar Sari',
    pekerjaan: 'Pedagang',
    peran: 'penabung',
    statusKyc: StatusKyc.Requested,
    skorKeanggotaan: 100,
    ktpUrl: 'https://seed/ktp/ira.jpg',
    simpananPokok: 0,
    simpananWajib: 0,
    simpananSukarela: 0,
    isDorman: false,
    isUzur: false,
    jumlahIzinUzur: 0,
    walletAddress: null,
    role: Role.Anggota,
    passwordHash: 'hashed-password',
    encryptedPrivkey: 'super-secret-key',
    onchainRegistered: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const submitDto: SubmitKycDto = {
    nama: 'Ira',
    nik: '3273010000000009',
    noHp: '081200000009',
    alamat: 'Jl. Mekar Sari',
    pekerjaan: 'Pedagang',
    peran: 'penabung' as SubmitKycDto['peran'],
    ktpUrl: 'https://seed/ktp/ira.jpg',
  };

  beforeEach(async () => {
    prisma = {
      member: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    walletService = { ensureWallet: jest.fn().mockResolvedValue(WALLET) };
    onchainSync = {
      registerMember: jest
        .fn()
        .mockResolvedValue({ ok: true, txHash: '0xdeadbeef' }),
    };
    audit = { append: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        KycService,
        { provide: PrismaService, useValue: prisma },
        { provide: WalletService, useValue: walletService },
        { provide: OnchainSyncService, useValue: onchainSync },
        { provide: AuditLogService, useValue: audit },
      ],
    }).compile();
    service = moduleRef.get(KycService);
  });

  // --- Positive: submit ---
  it('submit creates a Requested member with defaults and returns the DTO', async () => {
    prisma.member.create.mockResolvedValue(requestedMember);
    const result = await service.submit(submitDto);

    expect(prisma.member.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nama: 'Ira',
        nik: '3273010000000009',
        peran: 'penabung',
        ktpUrl: 'https://seed/ktp/ira.jpg',
        statusKyc: StatusKyc.Requested,
        role: Role.Anggota,
        skorKeanggotaan: 100,
      }),
    });
    expect(result.id).toBe('m-ira');
    expect(result.statusKyc).toBe(StatusKyc.Requested);
    expect(result.walletAddress).toBeNull();
  });

  it('submit never leaks secrets in the returned DTO', async () => {
    prisma.member.create.mockResolvedValue(requestedMember);
    const result = await service.submit(submitDto);
    expect((result as any).passwordHash).toBeUndefined();
    expect((result as any).encryptedPrivkey).toBeUndefined();
  });

  // --- Negative: submit ---
  it('submit rejects a duplicate NIK with ConflictException', async () => {
    prisma.member.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: '5.0.0',
      }),
    );
    await expect(service.submit(submitDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  // --- Positive: approve ---
  it('approve sets Approved, mints wallet, registers on-chain, audits, returns wallet', async () => {
    prisma.member.findUnique
      .mockResolvedValueOnce(requestedMember) // existence check
      .mockResolvedValueOnce({
        ...requestedMember,
        statusKyc: StatusKyc.Approved,
        walletAddress: WALLET,
        onchainRegistered: true,
      }); // final re-fetch
    prisma.member.update.mockResolvedValue({
      ...requestedMember,
      statusKyc: StatusKyc.Approved,
    });

    const result = await service.approve('m-ira');

    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: 'm-ira' },
      data: { statusKyc: StatusKyc.Approved },
    });
    expect(walletService.ensureWallet).toHaveBeenCalledWith('m-ira');
    expect(onchainSync.registerMember).toHaveBeenCalledWith('m-ira');
    expect(audit.append).toHaveBeenCalledWith(
      'Pengurus',
      'KYC_APPROVED',
      expect.stringContaining(WALLET),
      '0xdeadbeef',
    );
    expect(result.statusKyc).toBe(StatusKyc.Approved);
    expect(result.walletAddress).toBe(WALLET);
  });

  it('approve returns a member without secrets', async () => {
    prisma.member.findUnique
      .mockResolvedValueOnce(requestedMember)
      .mockResolvedValueOnce({
        ...requestedMember,
        statusKyc: StatusKyc.Approved,
        walletAddress: WALLET,
      });
    prisma.member.update.mockResolvedValue({});

    const result = await service.approve('m-ira');
    expect((result as any).passwordHash).toBeUndefined();
    expect((result as any).encryptedPrivkey).toBeUndefined();
  });

  // --- Edge: approve idempotent on already-Approved member ---
  it('approve is idempotent for an already-Approved member (keeps wallet, no crash)', async () => {
    const approved = {
      ...requestedMember,
      statusKyc: StatusKyc.Approved,
      walletAddress: WALLET,
      onchainRegistered: true,
    };
    prisma.member.findUnique
      .mockResolvedValueOnce(approved) // existence check
      .mockResolvedValueOnce(approved); // final re-fetch
    prisma.member.update.mockResolvedValue(approved);
    // ensureWallet is idempotent: returns the existing address
    walletService.ensureWallet.mockResolvedValue(WALLET);

    const result = await service.approve('m-ira');
    expect(result.statusKyc).toBe(StatusKyc.Approved);
    expect(result.walletAddress).toBe(WALLET);
    expect(walletService.ensureWallet).toHaveBeenCalledWith('m-ira');
  });

  // --- Negative: approve unknown id ---
  it('approve throws NotFoundException for an unknown id', async () => {
    prisma.member.findUnique.mockResolvedValue(null);
    await expect(service.approve('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(walletService.ensureWallet).not.toHaveBeenCalled();
    expect(prisma.member.update).not.toHaveBeenCalled();
  });

  // --- Edge: on-chain failure degrades gracefully ---
  it('approve still persists the wallet when registerMember returns {ok:false}', async () => {
    onchainSync.registerMember.mockResolvedValue({
      ok: false,
      error: 'no signer',
    });
    prisma.member.findUnique
      .mockResolvedValueOnce(requestedMember)
      .mockResolvedValueOnce({
        ...requestedMember,
        statusKyc: StatusKyc.Approved,
        walletAddress: WALLET,
      });
    prisma.member.update.mockResolvedValue({});

    const result = await service.approve('m-ira');
    expect(result.statusKyc).toBe(StatusKyc.Approved);
    expect(result.walletAddress).toBe(WALLET);
    // audited with an undefined txHash (best-effort registration failed)
    expect(audit.append).toHaveBeenCalledWith(
      'Pengurus',
      'KYC_APPROVED',
      expect.stringContaining(WALLET),
      undefined,
    );
  });

  // --- Positive: reject ---
  it('reject sets Rejected, audits, mints no wallet, returns the DTO', async () => {
    prisma.member.findUnique.mockResolvedValue(requestedMember);
    prisma.member.update.mockResolvedValue({
      ...requestedMember,
      statusKyc: StatusKyc.Rejected,
    });

    const result = await service.reject('m-ira');

    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: 'm-ira' },
      data: { statusKyc: StatusKyc.Rejected },
    });
    expect(walletService.ensureWallet).not.toHaveBeenCalled();
    expect(audit.append).toHaveBeenCalledWith(
      'Pengurus',
      'KYC_REJECTED',
      expect.stringContaining('Ira'),
    );
    expect(result.statusKyc).toBe(StatusKyc.Rejected);
    expect(result.walletAddress).toBeNull();
  });

  it('reject never leaks secrets in the returned DTO', async () => {
    prisma.member.findUnique.mockResolvedValue(requestedMember);
    prisma.member.update.mockResolvedValue({
      ...requestedMember,
      statusKyc: StatusKyc.Rejected,
    });
    const result = await service.reject('m-ira');
    expect((result as any).passwordHash).toBeUndefined();
    expect((result as any).encryptedPrivkey).toBeUndefined();
  });

  // --- Negative: reject unknown id ---
  it('reject throws NotFoundException for an unknown id', async () => {
    prisma.member.findUnique.mockResolvedValue(null);
    await expect(service.reject('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.member.update).not.toHaveBeenCalled();
  });
});
