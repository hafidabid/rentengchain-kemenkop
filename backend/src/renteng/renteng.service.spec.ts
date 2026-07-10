import { NotFoundException } from '@nestjs/common';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { RentengService } from './renteng.service';

describe('RentengService', () => {
  let service: RentengService;

  let prisma: {
    loan: { findUnique: jest.Mock; update: jest.Mock };
    group: { findUnique: jest.Mock; update: jest.Mock };
  };
  let contract: { trySubmit: jest.Mock };
  let audit: { append: jest.Mock };

  const pengurus: AuthUser = { userId: 'm-9', role: 'Pengurus' as any };

  const baseLoan = {
    id: 'l-1',
    memberId: 'm-1',
    groupId: 'g-1',
    nominal: 1000000,
    tujuan: 'modal usaha',
    tenor: 10,
    status: 'Cair',
    statusCicilan: 'UNPAID',
    sisaCicilan: 8,
    cicilanBulanan: 100000,
    jadwalCicilan: 'Setiap Jumat',
    skorAi: 70,
    flagAi: 'HIJAU',
    flagAlasan: ['sehat'],
    isSanggah: false,
    sanggahAlasan: null,
    onchainLoanId: 7n,
    txHash: null,
    member: { nama: 'Deni' },
    createdAt: new Date('2026-07-11T00:00:00.000Z'),
    updatedAt: new Date('2026-07-11T00:00:00.000Z'),
  };

  const group = { id: 'g-1', nama: 'Mekar Sari', kasSosial: 250000 };

  beforeEach(() => {
    prisma = {
      loan: { findUnique: jest.fn(), update: jest.fn() },
      group: { findUnique: jest.fn(), update: jest.fn() },
    };
    contract = {
      trySubmit: jest.fn().mockResolvedValue({ ok: true, txHash: '0xabc' }),
    };
    audit = { append: jest.fn().mockResolvedValue(undefined) };

    service = new RentengService(prisma as any, contract as any, audit as any);
  });

  // ---------- bailout (positive) ----------
  it('bailout marks loan DITALANGI, decrements kasSosial, calls the escrow trio, audits', async () => {
    prisma.loan.findUnique.mockResolvedValue(baseLoan);
    prisma.group.findUnique.mockResolvedValue(group);
    prisma.loan.update.mockResolvedValue({
      ...baseLoan,
      statusCicilan: 'DITALANGI',
      txHash: '0xabc',
    });
    prisma.group.update.mockResolvedValue({ ...group, kasSosial: 150000 });

    const result = await service.bailout('l-1', { period: 1 }, pengurus);

    // loan flipped to DITALANGI
    expect(prisma.loan.update).toHaveBeenCalledWith({
      where: { id: 'l-1' },
      data: expect.objectContaining({ statusCicilan: 'DITALANGI' }),
    });

    // recordRepayment(onTime=false) with the onchain id
    expect(contract.trySubmit).toHaveBeenCalledWith('recordRepayment', [
      7n,
      1n,
      false,
    ]);
    // applySocialFund
    expect(contract.trySubmit).toHaveBeenCalledWith('applySocialFund', [7n, 1n]);
    // activateRenteng with default grace period (30)
    expect(contract.trySubmit).toHaveBeenCalledWith('activateRenteng', [
      7n,
      1n,
      30n,
    ]);

    // kasSosial decremented by cicilanBulanan (250000 - 100000)
    expect(prisma.group.update).toHaveBeenCalledWith({
      where: { id: 'g-1' },
      data: { kasSosial: 150000 },
    });

    // audit appended by Pengurus with the escrow txHash
    expect(audit.append).toHaveBeenCalledWith(
      'Pengurus',
      'TANGGUNG_RENTENG_TRIGGERED',
      expect.stringContaining('Deni'),
      '0xabc',
    );

    // response shape
    expect(result.loan.statusCicilan).toBe('DITALANGI');
    expect(result.group).toEqual({ id: 'g-1', kasSosial: 150000 });
  });

  it('bailout uses provided gracePeriod for activateRenteng', async () => {
    prisma.loan.findUnique.mockResolvedValue(baseLoan);
    prisma.group.findUnique.mockResolvedValue(group);
    prisma.loan.update.mockResolvedValue({ ...baseLoan, statusCicilan: 'DITALANGI' });
    prisma.group.update.mockResolvedValue({ ...group, kasSosial: 150000 });

    await service.bailout('l-1', { period: 2, gracePeriod: 45 }, pengurus);

    expect(contract.trySubmit).toHaveBeenCalledWith('recordRepayment', [
      7n,
      2n,
      false,
    ]);
    expect(contract.trySubmit).toHaveBeenCalledWith('activateRenteng', [
      7n,
      2n,
      45n,
    ]);
  });

  it('bailout defaults period to 1 when omitted', async () => {
    prisma.loan.findUnique.mockResolvedValue(baseLoan);
    prisma.group.findUnique.mockResolvedValue(group);
    prisma.loan.update.mockResolvedValue({ ...baseLoan, statusCicilan: 'DITALANGI' });
    prisma.group.update.mockResolvedValue({ ...group, kasSosial: 150000 });

    await service.bailout('l-1', {}, pengurus);
    expect(contract.trySubmit).toHaveBeenCalledWith('recordRepayment', [
      7n,
      1n,
      false,
    ]);
  });

  // ---------- bailout (negative / edge) ----------
  it('bailout throws NotFound for an unknown loanId', async () => {
    prisma.loan.findUnique.mockResolvedValue(null);
    await expect(
      service.bailout('nope', { period: 1 }, pengurus),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.loan.update).not.toHaveBeenCalled();
    expect(prisma.group.update).not.toHaveBeenCalled();
  });

  it('bailout still persists DITALANGI + kasSosial decrement when on-chain trySubmit fails', async () => {
    prisma.loan.findUnique.mockResolvedValue(baseLoan);
    prisma.group.findUnique.mockResolvedValue(group);
    prisma.loan.update.mockResolvedValue({ ...baseLoan, statusCicilan: 'DITALANGI' });
    prisma.group.update.mockResolvedValue({ ...group, kasSosial: 150000 });
    contract.trySubmit.mockResolvedValue({ ok: false, error: 'no signer' });

    const result = await service.bailout('l-1', { period: 1 }, pengurus);

    expect(prisma.loan.update).toHaveBeenCalledWith({
      where: { id: 'l-1' },
      data: expect.objectContaining({ statusCicilan: 'DITALANGI' }),
    });
    expect(prisma.group.update).toHaveBeenCalledWith({
      where: { id: 'g-1' },
      data: { kasSosial: 150000 },
    });
    // audit still written, with no txHash
    expect(audit.append).toHaveBeenCalledWith(
      'Pengurus',
      'TANGGUNG_RENTENG_TRIGGERED',
      expect.any(String),
      undefined,
    );
    expect(result.loan.statusCicilan).toBe('DITALANGI');
  });

  it('bailout skips on-chain entirely when onchainLoanId is null but still persists state', async () => {
    prisma.loan.findUnique.mockResolvedValue({ ...baseLoan, onchainLoanId: null });
    prisma.group.findUnique.mockResolvedValue(group);
    prisma.loan.update.mockResolvedValue({ ...baseLoan, statusCicilan: 'DITALANGI' });
    prisma.group.update.mockResolvedValue({ ...group, kasSosial: 150000 });

    const result = await service.bailout('l-1', { period: 1 }, pengurus);

    expect(contract.trySubmit).not.toHaveBeenCalled();
    expect(prisma.loan.update).toHaveBeenCalledWith({
      where: { id: 'l-1' },
      data: expect.objectContaining({ statusCicilan: 'DITALANGI' }),
    });
    expect(prisma.group.update).toHaveBeenCalledWith({
      where: { id: 'g-1' },
      data: { kasSosial: 150000 },
    });
    expect(result.group.kasSosial).toBe(150000);
  });

  it('bailout clamps kasSosial at 0 when cicilanBulanan exceeds it', async () => {
    prisma.loan.findUnique.mockResolvedValue({
      ...baseLoan,
      cicilanBulanan: 300000,
    });
    prisma.group.findUnique.mockResolvedValue({ ...group, kasSosial: 100000 });
    prisma.loan.update.mockResolvedValue({ ...baseLoan, statusCicilan: 'DITALANGI' });
    prisma.group.update.mockResolvedValue({ ...group, kasSosial: 0 });

    const result = await service.bailout('l-1', { period: 1 }, pengurus);

    // 100000 - 300000 clamps to 0, never negative
    expect(prisma.group.update).toHaveBeenCalledWith({
      where: { id: 'g-1' },
      data: { kasSosial: 0 },
    });
    expect(result.group.kasSosial).toBe(0);
  });

  it('bailout is idempotent for a loan already DITALANGI (no decrement, no on-chain)', async () => {
    prisma.loan.findUnique.mockResolvedValue({
      ...baseLoan,
      statusCicilan: 'DITALANGI',
    });
    prisma.group.findUnique.mockResolvedValue(group);

    const result = await service.bailout('l-1', { period: 1 }, pengurus);

    expect(contract.trySubmit).not.toHaveBeenCalled();
    expect(prisma.loan.update).not.toHaveBeenCalled();
    expect(prisma.group.update).not.toHaveBeenCalled();
    expect(result.loan.statusCicilan).toBe('DITALANGI');
    expect(result.group.kasSosial).toBe(250000);
  });

  // ---------- repay-talangan ----------
  it('repay-talangan sets PAID and calls repayTalangan on-chain, audits', async () => {
    prisma.loan.findUnique.mockResolvedValue({
      ...baseLoan,
      statusCicilan: 'DITALANGI',
    });
    prisma.loan.update.mockResolvedValue({
      ...baseLoan,
      statusCicilan: 'PAID',
      txHash: '0xabc',
    });

    const result = await service.repayTalangan('l-1', { amount: 100000 }, pengurus);

    expect(contract.trySubmit).toHaveBeenCalledWith('repayTalangan', [
      7n,
      100000n,
    ]);
    expect(prisma.loan.update).toHaveBeenCalledWith({
      where: { id: 'l-1' },
      data: expect.objectContaining({ statusCicilan: 'PAID' }),
    });
    expect(audit.append).toHaveBeenCalledWith(
      'Pengurus',
      'TALANGAN_REPAID',
      expect.stringContaining('l-1'),
      '0xabc',
    );
    expect(result.statusCicilan).toBe('PAID');
  });

  it('repay-talangan skips on-chain when onchainLoanId is null but still sets PAID', async () => {
    prisma.loan.findUnique.mockResolvedValue({
      ...baseLoan,
      statusCicilan: 'DITALANGI',
      onchainLoanId: null,
    });
    prisma.loan.update.mockResolvedValue({ ...baseLoan, statusCicilan: 'PAID' });

    const result = await service.repayTalangan('l-1', { amount: 50000 }, pengurus);

    expect(contract.trySubmit).not.toHaveBeenCalled();
    expect(result.statusCicilan).toBe('PAID');
  });

  it('repay-talangan throws NotFound for an unknown loanId', async () => {
    prisma.loan.findUnique.mockResolvedValue(null);
    await expect(
      service.repayTalangan('nope', { amount: 100 }, pengurus),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.loan.update).not.toHaveBeenCalled();
  });
});
