/**
 * Live Base Sepolia smoke: registers the seeded members/group on-chain (admin
 * key) then records one savings tx (relayer key), printing real explorer links.
 * Run: npx ts-node scripts/live-smoke.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ContractClientService } from '../src/web3/contract-client.service';
import { HashingService } from '../src/web3/hashing.service';
import { OnchainSyncService } from '../src/web3/onchain-sync.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SavingsType, PaymentMethod } from '../src/web3/abis/escrow.abi';

const EXPLORER = process.env.EXPLORER_BASE_URL || 'https://sepolia.basescan.org';
const link = (tx?: string) => (tx ? `${EXPLORER}/tx/${tx}` : '(no tx)');

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });
  const onchain = app.get(OnchainSyncService);
  const contract = app.get(ContractClientService);
  const hashing = app.get(HashingService);
  const prisma = app.get(PrismaService);

  console.log('\n== bootstrapSeeded (register members/group on-chain) ==');
  const boot = await onchain.bootstrapSeeded();
  for (const s of boot.steps) console.log('  ', s);

  const sri = await prisma.member.findFirst({ where: { nama: 'Sri Wahyuni' } });
  if (sri) {
    console.log('\n== recordSavings (Sri, Wajib 50000) ==');
    const res = await contract.trySubmit('recordSavings', [
      hashing.memberHash(sri.nik),
      SavingsType.WAJIB,
      50000n,
      PaymentMethod.QRIS,
    ]);
    console.log('  ', res.ok ? `OK ${link(res.txHash)}` : `FAILED: ${res.error}`);
  }

  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
