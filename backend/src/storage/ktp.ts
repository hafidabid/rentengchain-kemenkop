/**
 * Dummy KTP (Indonesian ID card) image for the demo. Primary source is a bundled
 * JPEG asset (`backend/assets/rantai-renteng-ktp.jpeg`, overridable via
 * KTP_DUMMY_IMAGE_PATH); if that file is missing it falls back to a generated SVG
 * card so the seed never fails. Object key is derived from the member's NIK.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export interface KtpImage {
  key: string;
  contentType: string;
  body: Buffer | string;
}

/** Object key for a member's KTP, derived from NIK + file extension. */
export function ktpKey(nik: string, ext: string): string {
  return `ktp/${nik}.${ext}`;
}

function dummyImagePath(): string {
  return (
    process.env.KTP_DUMMY_IMAGE_PATH ||
    join(process.cwd(), 'assets', 'rantai-renteng-ktp.jpeg')
  );
}

function escapeXml(s: string): string {
  return s.replace(
    /[<>&'"]/g,
    (c) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[
        c
      ] as string,
  );
}

/** SVG fallback used only when the JPEG asset cannot be read. */
export function generateSvgKtp(nama: string, nik: string): KtpImage {
  const safeNama = escapeXml(nama);
  const safeNik = escapeXml(nik);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400" role="img" aria-label="KTP dummy ${safeNama}">
  <rect width="640" height="400" rx="16" fill="#FAF9F8" stroke="#E5544F" stroke-width="3"/>
  <rect x="0" y="0" width="640" height="64" rx="16" fill="#F06A6A"/>
  <rect x="0" y="40" width="640" height="24" fill="#F06A6A"/>
  <text x="24" y="41" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#ffffff">KARTU TANDA PENDUDUK — DUMMY</text>
  <g font-family="Arial, sans-serif" fill="#1E1F21">
    <text x="24" y="112" font-size="13" fill="#6D6E6F">NIK</text>
    <text x="24" y="140" font-size="24" font-weight="700" letter-spacing="2">${safeNik}</text>
    <text x="24" y="184" font-size="13" fill="#6D6E6F">Nama</text>
    <text x="24" y="210" font-size="22" font-weight="600">${safeNama}</text>
  </g>
  <text x="24" y="360" font-family="Arial, sans-serif" font-size="12" fill="#9a9896">RantaiRenteng — contoh KTP untuk demo, bukan dokumen resmi.</text>
</svg>`;
  return { key: ktpKey(nik, 'svg'), contentType: 'image/svg+xml', body };
}

/**
 * Dummy KTP for a member: the bundled JPEG asset, or the SVG fallback if the
 * asset file is unreadable.
 */
export function dummyKtpFor(nama: string, nik: string): KtpImage {
  try {
    const body = readFileSync(dummyImagePath());
    return { key: ktpKey(nik, 'jpg'), contentType: 'image/jpeg', body };
  } catch {
    return generateSvgKtp(nama, nik);
  }
}
