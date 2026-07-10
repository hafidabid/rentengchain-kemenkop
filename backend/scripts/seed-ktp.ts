/**
 * Ensure a dummy KTP image exists in object storage for every member, then set
 * members.ktp_url to the real object URL. Idempotent (skips existing objects).
 * Run: npm run seed:ktp   (requires S3/MinIO configured — see docker-compose)
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { generateDummyKtp } from '../src/storage/ktp';
import { S3Service } from '../src/storage/s3.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });
  const s3 = app.get(S3Service);
  const prisma = app.get(PrismaService);

  if (!s3.enabled) {
    // eslint-disable-next-line no-console
    console.error(
      'S3 not configured (set S3_* env / run MinIO via docker compose). Skipping KTP seed.',
    );
    await app.close();
    return;
  }

  const members = await prisma.member.findMany();
  for (const m of members) {
    const ktp = generateDummyKtp(m.nama, m.nik);
    const url = await s3.ensureObject(ktp.key, () => ktp.body, ktp.contentType);
    await prisma.member.update({ where: { id: m.id }, data: { ktpUrl: url } });
    // eslint-disable-next-line no-console
    console.log(`KTP ${m.nama}: ${url}`);
  }

  await app.close();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
