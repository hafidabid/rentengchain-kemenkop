import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { S3Service } from './s3.service';

const cfg = (o: Record<string, string> = {}): ConfigService =>
  ({ get: (k: string, d?: string) => o[k] ?? d }) as unknown as ConfigService;

const ENABLED = {
  S3_BUCKET: 'b',
  S3_REGION: 'us-east-1',
  S3_ACCESS_KEY_ID: 'k',
  S3_SECRET_ACCESS_KEY: 's',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_PUBLIC_URL_BASE: 'http://localhost:9000/b',
};

describe('S3Service', () => {
  afterEach(() => jest.restoreAllMocks());

  // --- Disabled mode ---
  it('is disabled without credentials and rejects uploads with 503', async () => {
    const s = new S3Service(cfg({}));
    expect(s.enabled).toBe(false);
    await expect(s.upload('k', 'x', 't')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  // --- ensureObject: upload when missing ---
  it('ensureObject uploads when the object is missing', async () => {
    const s = new S3Service(cfg(ENABLED));
    const send = jest
      .spyOn(S3Client.prototype, 'send' as any)
      .mockImplementation(async (cmd: any) => {
        if (cmd instanceof HeadObjectCommand) {
          const e: any = new Error('NotFound');
          e.$metadata = { httpStatusCode: 404 };
          throw e;
        }
        return {}; // HeadBucket + PutObject succeed
      });
    const url = await s.ensureObject('ktp/x.svg', () => '<svg/>', 'image/svg+xml');
    expect(url).toBe('http://localhost:9000/b/ktp/x.svg');
    expect(
      send.mock.calls.some((c) => c[0] instanceof PutObjectCommand),
    ).toBe(true);
  });

  // --- ensureObject: skip when present ---
  it('ensureObject does NOT upload when the object already exists', async () => {
    const s = new S3Service(cfg(ENABLED));
    const send = jest
      .spyOn(S3Client.prototype, 'send' as any)
      .mockImplementation(async (cmd: any) => {
        if (cmd instanceof PutObjectCommand) throw new Error('should not upload');
        return {}; // HeadBucket + HeadObject succeed
      });
    const url = await s.ensureObject('ktp/x.svg', () => '<svg/>', 'image/svg+xml');
    expect(url).toBe('http://localhost:9000/b/ktp/x.svg');
    expect(
      send.mock.calls.filter((c) => c[0] instanceof PutObjectCommand).length,
    ).toBe(0);
    expect(
      send.mock.calls.some((c) => c[0] instanceof HeadBucketCommand),
    ).toBe(true);
  });

  // --- URL derivation ---
  it('derives an AWS virtual-host URL when no endpoint is set', () => {
    const s = new S3Service(
      cfg({
        S3_BUCKET: 'b',
        S3_REGION: 'ap-southeast-1',
        S3_ACCESS_KEY_ID: 'k',
        S3_SECRET_ACCESS_KEY: 's',
      }),
    );
    expect(s.publicUrl('ktp/x.svg')).toBe(
      'https://b.s3.ap-southeast-1.amazonaws.com/ktp/x.svg',
    );
  });
});
