import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

/** Prepend https:// when a configured URL/host omits the scheme, so scheme-less
 * env (e.g. a bare CDN host) doesn't produce an invalid endpoint. */
function withScheme(value?: string): string | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/**
 * Object storage for KTP images. Targets AWS S3 or any S3-compatible endpoint
 * (MinIO/LocalStack) via env. Boots even when unconfigured — operations then
 * throw a clear ServiceUnavailable (upload) or callers skip (seed step).
 */
@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client | null;
  readonly enabled: boolean;
  private readonly bucket: string;
  private readonly endpoint?: string;
  private readonly region: string;
  private readonly publicUrlBase?: string;

  constructor(config: ConfigService) {
    this.bucket = config.get<string>('S3_BUCKET', 'rantai-renteng-ktp');
    this.region = config.get<string>('S3_REGION', 'us-east-1');
    this.endpoint = withScheme(config.get<string>('S3_ENDPOINT'));
    this.publicUrlBase = withScheme(config.get<string>('S3_PUBLIC_URL_BASE'));
    const accessKeyId = config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('S3_SECRET_ACCESS_KEY');
    const forcePathStyle =
      config.get<string>('S3_FORCE_PATH_STYLE', this.endpoint ? 'true' : 'false') ===
      'true';

    this.enabled = Boolean(accessKeyId && secretAccessKey);
    if (!this.enabled) {
      this.client = null;
      this.logger.warn(
        'S3 not configured (S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY) — KTP uploads disabled.',
      );
      return;
    }
    this.client = new S3Client({
      region: this.region,
      endpoint: this.endpoint,
      forcePathStyle,
      credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
    });
  }

  private require(): S3Client {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Object storage is not configured (set S3_* env / run MinIO).',
      );
    }
    return this.client;
  }

  publicUrl(key: string): string {
    if (this.publicUrlBase) return `${this.publicUrlBase.replace(/\/$/, '')}/${key}`;
    if (this.endpoint)
      return `${this.endpoint.replace(/\/$/, '')}/${this.bucket}/${key}`;
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /** Create the bucket if it does not exist (idempotent). */
  async ensureBucket(): Promise<void> {
    const client = this.require();
    try {
      await client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Created bucket ${this.bucket}`);
    }
  }

  async objectExists(key: string): Promise<boolean> {
    const client = this.require();
    try {
      await client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch (err: any) {
      const status = err?.$metadata?.httpStatusCode;
      if (status === 404 || err?.name === 'NotFound') return false;
      throw err;
    }
  }

  async upload(
    key: string,
    body: Buffer | string,
    contentType: string,
  ): Promise<string> {
    const client = this.require();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return this.publicUrl(key);
  }

  /** Upload only if the object is missing; returns the public URL either way. */
  async ensureObject(
    key: string,
    factory: () => Buffer | string,
    contentType: string,
  ): Promise<string> {
    await this.ensureBucket();
    if (await this.objectExists(key)) {
      return this.publicUrl(key);
    }
    return this.upload(key, factory(), contentType);
  }
}
