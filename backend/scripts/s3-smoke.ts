/**
 * Live S3 smoke: uploads one dummy KTP via S3Service and prints its public URL.
 * Proves credentials/region/bucket/write + CloudFront URL derivation, no DB.
 * Run: npx ts-node scripts/s3-smoke.ts
 */
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { dummyKtpFor } from '../src/storage/ktp';
import { S3Service } from '../src/storage/s3.service';

const cfg = {
  get: (k: string, d?: string) => process.env[k] ?? d,
} as unknown as ConfigService;

async function main(): Promise<void> {
  const s3 = new S3Service(cfg);
  console.log('enabled:', s3.enabled);
  if (!s3.enabled) throw new Error('S3 not enabled (missing creds)');

  const ktp = dummyKtpFor('S3 Smoke Test', '0000000000000000');
  const url = await s3.ensureObject(ktp.key, () => ktp.body, ktp.contentType);
  console.log('uploaded ->', url);
  console.log('exists   ->', await s3.objectExists(ktp.key));
}

main().catch((e) => {
  console.error('FAIL:', e?.name, e?.message);
  process.exit(1);
});
