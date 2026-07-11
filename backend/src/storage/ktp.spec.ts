import { dummyKtpFor, generateSvgKtp, ktpKey } from './ktp';

describe('ktp', () => {
  it('ktpKey derives from NIK + extension', () => {
    expect(ktpKey('999', 'jpg')).toBe('ktp/999.jpg');
    expect(ktpKey('999', 'svg')).toBe('ktp/999.svg');
  });

  it('dummyKtpFor returns the bundled JPEG asset', () => {
    const k = dummyKtpFor('Sri Wahyuni', '3273012345678901');
    expect(k.contentType).toBe('image/jpeg');
    expect(k.key).toBe('ktp/3273012345678901.jpg');
    expect(Buffer.isBuffer(k.body)).toBe(true);
    expect((k.body as Buffer).length).toBeGreaterThan(1000);
  });

  it('falls back to an SVG card when the asset is missing', () => {
    const prev = process.env.KTP_DUMMY_IMAGE_PATH;
    process.env.KTP_DUMMY_IMAGE_PATH = '/nonexistent/does-not-exist.jpeg';
    try {
      const k = dummyKtpFor('A & <B>', '123');
      expect(k.contentType).toBe('image/svg+xml');
      expect(k.key).toBe('ktp/123.svg');
      expect(k.body).toContain('A &amp; &lt;B&gt;'); // XML-escaped
    } finally {
      process.env.KTP_DUMMY_IMAGE_PATH = prev;
    }
  });

  it('generateSvgKtp escapes XML and includes name + NIK', () => {
    const k = generateSvgKtp('Sri', '3273012345678901');
    expect(k.body).toContain('Sri');
    expect(k.body).toContain('3273012345678901');
    expect(k.body).toContain('<svg');
  });
});
