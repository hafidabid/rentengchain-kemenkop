import { generateDummyKtp, ktpKey } from './ktp';

describe('generateDummyKtp', () => {
  it('produces a non-empty SVG containing the name and NIK', () => {
    const k = generateDummyKtp('Sri Wahyuni', '3273012345678901');
    expect(k.contentType).toBe('image/svg+xml');
    expect(k.key).toBe('ktp/3273012345678901.svg');
    expect(k.body).toContain('Sri Wahyuni');
    expect(k.body).toContain('3273012345678901');
    expect(k.body.length).toBeGreaterThan(100);
    expect(k.body).toContain('<svg');
  });

  it('escapes XML special characters (no injection)', () => {
    const k = generateDummyKtp('A & <B>', '123');
    expect(k.body).toContain('A &amp; &lt;B&gt;');
    expect(k.body).not.toContain('A & <B>');
  });

  it('ktpKey is stable per NIK', () => {
    expect(ktpKey('999')).toBe('ktp/999.svg');
  });
});
