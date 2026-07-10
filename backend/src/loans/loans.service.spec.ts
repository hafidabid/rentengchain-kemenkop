import { NotFoundException } from '@nestjs/common';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { AIFlag } from '../web3/abis/escrow.abi';
import { LoansService } from './loans.service';

describe('LoansService', () => {
  let service: LoansService;

  let prisma: {
    member: { findUnique: jest.Mock };
    group: { findUnique: jest.Mock };
    loan: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let gemini: { screen: jest.Mock };
  let contract: { readNextLoanId: jest.Mock; trySubmit: jest.Mock };
  let onchain: { groupIdFor: jest.Mock; memberHashFor: jest.Mock };
  let hashing: { paramsHash: jest.Mock; reasonHash: jest.Mock };
  let audit: { append: jest.Mock };
  let config: { get: jest.Mock };

  const anggota: AuthUser = { userId: 'm-1', role: 'Anggota' as any };
  const pengurus: AuthUser = { userId: 'm-9', role: 'Pengurus' as any };

  const member = {
    id: 'm-1',
    nik: '3273010000000001',
    nama: 'Ani',
    skorKeanggotaan: 45,
    isDorman: true,
    simpananPokok: 50000,
    simpananWajib: 0,
    simpananSukarela: 0,
  };
  const group = {
    id: 'g-1',
    nama: 'Mekar Sari',
    jadwalPertemuan: 'Setiap Jumat',
    kehadiranRate: 90,
  };

  const applyDto = {
    memberId: 'm-1',
    groupId: 'g-1',
    nominal: 1000000,
    tujuan: 'modal usaha',
    tenor: 10,
  };

  const createdLoan = {
    id: 'l-1',
    memberId: 'm-1',
    groupId: 'g-1',
    nominal: 1000000,
    tujuan: 'modal usaha',
    tenor: 10,
    status: 'Diajukan',
    statusCicilan: 'UNPAID',
    sisaCicilan: 10,
    cicilanBulanan: 100000,
    jadwalCicilan: 'Setiap Jumat',
    skorAi: 38,
    flagAi: 'MERAH',
    flagAlasan: ['dorman'],
    isSanggah: false,
    sanggahAlasan: null,
    onchainLoanId: null,
    txHash: null,
    createdAt: new Date('2026-07-11T00:00:00.000Z'),
    updatedAt: new Date('2026-07-11T00:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      member: { findUnique: jest.fn() },
      group: { findUnique: jest.fn() },
      loan: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };
    gemini = {
      screen: jest.fn().mockResolvedValue({
        skorAi: 38,
        flagAi: 'MERAH',
        flagAlasan: ['dorman'],
      }),
    };
    contract = {
      readNextLoanId: jest.fn().mockResolvedValue(7n),
      trySubmit: jest.fn().mockResolvedValue({ ok: true, txHash: '0xabc' }),
    };
    onchain = {
      groupIdFor: jest.fn().mockReturnValue('0xgroup'),
      memberHashFor: jest.fn().mockReturnValue('0xmember'),
    };
    hashing = {
      paramsHash: jest.fn().mockReturnValue('0xparams'),
      reasonHash: jest.fn().mockReturnValue('0xreason'),
    };
    audit = { append: jest.fn().mockResolvedValue(undefined) };
    config = { get: jest.fn().mockReturnValue('https://sepolia.basescan.org') };

    service = new LoansService(
      prisma as any,
      gemini as any,
      contract as any,
      onchain as any,
      hashing as any,
      audit as any,
      config as any,
    );
  });

  // ---------- apply (positive) ----------
  it('apply creates a Diajukan loan with screening fields and calls createLoan', async () => {
    gemini.screen.mockResolvedValue({
      skorAi: 82,
      flagAi: 'HIJAU',
      flagAlasan: ['sehat'],
    });
    prisma.member.findUnique.mockResolvedValue(member);
    prisma.group.findUnique.mockResolvedValue(group);
    const created = {
      ...createdLoan,
      skorAi: 82,
      flagAi: 'HIJAU',
      flagAlasan: ['sehat'],
    };
    prisma.loan.create.mockResolvedValue(created);
    prisma.loan.update.mockResolvedValue({
      ...created,
      onchainLoanId: 7n,
      txHash: '0xabc',
    });

    const result = await service.apply(applyDto, anggota);

    // persisted screening fields + lifecycle defaults
    expect(prisma.loan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'Diajukan',
        statusCicilan: 'UNPAID',
        sisaCicilan: 10,
        cicilanBulanan: 100000,
        jadwalCicilan: 'Setiap Jumat',
        skorAi: 82,
        flagAi: 'HIJAU',
        flagAlasan: ['sehat'],
      }),
    });

    // createLoan called with the right shape
    const createLoanCall = contract.trySubmit.mock.calls.find(
      (c) => c[0] === 'createLoan',
    );
    expect(createLoanCall).toBeDefined();
    const args = createLoanCall![1];
    expect(args[0]).toBe('0xgroup');
    expect(args[1]).toBe('0xmember');
    expect(args[2]).toBe(BigInt(1000000));
    expect(args[3]).toBe(BigInt(10));
    expect(args[4]).toBe(BigInt(100000));
    expect(args[5]).toBe(82);
    expect(args[6]).toBe(AIFlag.HIJAU);
    expect(args[7]).toBe('0xparams');

    // onchainLoanId persisted + recordScreening anchored
    expect(prisma.loan.update).toHaveBeenCalledWith({
      where: { id: 'l-1' },
      data: { onchainLoanId: 7n, txHash: '0xabc' },
    });
    expect(contract.trySubmit).toHaveBeenCalledWith('recordScreening', [
      7n,
      82,
      AIFlag.HIJAU,
      '0xparams',
    ]);

    // serialized: BigInt → string
    expect(result.status).toBe('Diajukan');
    expect(result.onchainLoanId).toBe('7');
    expect(typeof result.onchainLoanId).toBe('string');
    expect(audit.append).toHaveBeenCalled();
  });

  it('apply derives cicilanBulanan from nominal/tenor when omitted, else uses provided', async () => {
    prisma.member.findUnique.mockResolvedValue(member);
    prisma.group.findUnique.mockResolvedValue(group);
    prisma.loan.create.mockResolvedValue(createdLoan);
    prisma.loan.update.mockResolvedValue({ ...createdLoan, onchainLoanId: 7n });

    await service.apply({ ...applyDto, cicilanBulanan: 123456 }, anggota);
    expect(prisma.loan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ cicilanBulanan: 123456 }),
    });
  });

  // ---------- apply (negative) ----------
  it('apply throws NotFound for unknown member', async () => {
    prisma.member.findUnique.mockResolvedValue(null);
    await expect(service.apply(applyDto, anggota)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.loan.create).not.toHaveBeenCalled();
  });

  it('apply throws NotFound for unknown group', async () => {
    prisma.member.findUnique.mockResolvedValue(member);
    prisma.group.findUnique.mockResolvedValue(null);
    await expect(service.apply(applyDto, anggota)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.loan.create).not.toHaveBeenCalled();
  });

  it('apply persists the loan even when readNextLoanId throws (stays off-chain)', async () => {
    prisma.member.findUnique.mockResolvedValue(member);
    prisma.group.findUnique.mockResolvedValue(group);
    prisma.loan.create.mockResolvedValue(createdLoan);
    contract.readNextLoanId.mockRejectedValue(new Error('rpc down'));

    const result = await service.apply(applyDto, anggota);

    expect(prisma.loan.create).toHaveBeenCalled();
    // no onchain persist update because nextId is null
    expect(prisma.loan.update).not.toHaveBeenCalled();
    expect(result.onchainLoanId).toBeNull();
    expect(audit.append).toHaveBeenCalled();
  });

  it('apply persists the loan even when createLoan trySubmit is not ok', async () => {
    prisma.member.findUnique.mockResolvedValue(member);
    prisma.group.findUnique.mockResolvedValue(group);
    prisma.loan.create.mockResolvedValue(createdLoan);
    contract.trySubmit.mockResolvedValue({ ok: false, error: 'no signer' });

    const result = await service.apply(applyDto, anggota);

    expect(prisma.loan.create).toHaveBeenCalled();
    expect(prisma.loan.update).not.toHaveBeenCalled();
    expect(result.onchainLoanId).toBeNull();
    // recordScreening must NOT be attempted when createLoan failed
    expect(
      contract.trySubmit.mock.calls.some((c) => c[0] === 'recordScreening'),
    ).toBe(false);
  });

  it('apply uses the Gemini fallback flag and still creates the loan', async () => {
    // simulate gemini returning its seeded fallback (MERAH for Ani)
    gemini.screen.mockResolvedValue({
      skorAi: 38,
      flagAi: 'MERAH',
      flagAlasan: ['Anggota berstatus dorman'],
    });
    prisma.member.findUnique.mockResolvedValue(member);
    prisma.group.findUnique.mockResolvedValue(group);
    prisma.loan.create.mockResolvedValue(createdLoan);
    prisma.loan.update.mockResolvedValue({ ...createdLoan, onchainLoanId: 7n });

    const result = await service.apply(applyDto, anggota);
    expect(result.flagAi).toBe('MERAH');
    expect(prisma.loan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ flagAi: 'MERAH', skorAi: 38 }),
    });
  });

  // ---------- sanggah ----------
  it('sanggah sets isSanggah + sanggahAlasan and calls fileAppeal', async () => {
    const merahLoan = {
      ...createdLoan,
      flagAi: 'MERAH',
      onchainLoanId: 7n,
    };
    prisma.loan.findUnique.mockResolvedValue(merahLoan);
    prisma.loan.update.mockResolvedValue({
      ...merahLoan,
      isSanggah: true,
      sanggahAlasan: 'saya mampu membayar',
    });

    const result = await service.sanggah(
      'l-1',
      { alasan: 'saya mampu membayar' },
      anggota,
    );

    expect(prisma.loan.update).toHaveBeenCalledWith({
      where: { id: 'l-1' },
      data: { isSanggah: true, sanggahAlasan: 'saya mampu membayar' },
    });
    expect(contract.trySubmit).toHaveBeenCalledWith('fileAppeal', [
      7n,
      '0xreason',
    ]);
    expect(result.isSanggah).toBe(true);
    expect(result.sanggahAlasan).toBe('saya mampu membayar');
  });

  it('sanggah skips fileAppeal when the loan has no onchainLoanId', async () => {
    prisma.loan.findUnique.mockResolvedValue({ ...createdLoan, onchainLoanId: null });
    prisma.loan.update.mockResolvedValue({
      ...createdLoan,
      isSanggah: true,
      sanggahAlasan: 'alasan',
    });

    await service.sanggah('l-1', { alasan: 'alasan' }, anggota);
    expect(
      contract.trySubmit.mock.calls.some((c) => c[0] === 'fileAppeal'),
    ).toBe(false);
  });

  it('sanggah throws NotFound for unknown loan', async () => {
    prisma.loan.findUnique.mockResolvedValue(null);
    await expect(
      service.sanggah('nope', { alasan: 'x' }, anggota),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  // ---------- approve ----------
  it('approve sets Disetujui, calls approveLoan and resolveAppeal(true) when appealed', async () => {
    prisma.loan.findUnique.mockResolvedValue({
      ...createdLoan,
      onchainLoanId: 7n,
      isSanggah: true,
    });
    prisma.loan.update.mockResolvedValue({
      ...createdLoan,
      status: 'Disetujui',
      onchainLoanId: 7n,
      isSanggah: true,
    });

    const result = await service.approve('l-1', pengurus);

    expect(prisma.loan.update).toHaveBeenCalledWith({
      where: { id: 'l-1' },
      data: { status: 'Disetujui' },
    });
    expect(contract.trySubmit).toHaveBeenCalledWith('approveLoan', [7n]);
    expect(contract.trySubmit).toHaveBeenCalledWith('resolveAppeal', [7n, true]);
    expect(result.status).toBe('Disetujui');
  });

  it('approve does not resolveAppeal when the loan was not appealed', async () => {
    prisma.loan.findUnique.mockResolvedValue({
      ...createdLoan,
      onchainLoanId: 7n,
      isSanggah: false,
    });
    prisma.loan.update.mockResolvedValue({
      ...createdLoan,
      status: 'Disetujui',
      onchainLoanId: 7n,
    });

    await service.approve('l-1', pengurus);
    expect(contract.trySubmit).toHaveBeenCalledWith('approveLoan', [7n]);
    expect(
      contract.trySubmit.mock.calls.some((c) => c[0] === 'resolveAppeal'),
    ).toBe(false);
  });

  it('approve throws NotFound for unknown loan', async () => {
    prisma.loan.findUnique.mockResolvedValue(null);
    await expect(service.approve('nope', pengurus)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // ---------- reject ----------
  it('reject sets Ditunda, calls deferLoan and resolveAppeal(false) when appealed', async () => {
    prisma.loan.findUnique.mockResolvedValue({
      ...createdLoan,
      onchainLoanId: 7n,
      isSanggah: true,
    });
    prisma.loan.update.mockResolvedValue({
      ...createdLoan,
      status: 'Ditunda',
      onchainLoanId: 7n,
      isSanggah: true,
    });

    const result = await service.reject('l-1', { reason: 'plafon' }, pengurus);

    expect(prisma.loan.update).toHaveBeenCalledWith({
      where: { id: 'l-1' },
      data: { status: 'Ditunda' },
    });
    expect(contract.trySubmit).toHaveBeenCalledWith('deferLoan', [7n]);
    expect(contract.trySubmit).toHaveBeenCalledWith('resolveAppeal', [7n, false]);
    expect(result.status).toBe('Ditunda');
  });

  it('reject throws NotFound for unknown loan', async () => {
    prisma.loan.findUnique.mockResolvedValue(null);
    await expect(
      service.reject('nope', {}, pengurus),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  // ---------- reads ----------
  it('findAll returns loans with member + group names and AI fields', async () => {
    prisma.loan.findMany.mockResolvedValue([
      {
        ...createdLoan,
        onchainLoanId: 7n,
        member: { nama: 'Ani' },
        group: { nama: 'Mekar Sari' },
      },
    ]);

    const list = await service.findAll();
    expect(list).toHaveLength(1);
    expect(list[0].memberNama).toBe('Ani');
    expect(list[0].groupNama).toBe('Mekar Sari');
    expect(list[0].flagAi).toBe('MERAH');
    expect(list[0].onchainLoanId).toBe('7');
  });

  it('findOne throws NotFound for unknown loan', async () => {
    prisma.loan.findUnique.mockResolvedValue(null);
    await expect(service.findOne('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('findOne returns a serialized loan with BigInt onchainLoanId as string', async () => {
    prisma.loan.findUnique.mockResolvedValue({
      ...createdLoan,
      onchainLoanId: 42n,
      member: { nama: 'Ani' },
      group: { nama: 'Mekar Sari' },
    });
    const result = await service.findOne('l-1');
    expect(result.onchainLoanId).toBe('42');
    expect(typeof result.onchainLoanId).toBe('string');
    expect(result.flagAlasan).toEqual(['dorman']);
  });
});
