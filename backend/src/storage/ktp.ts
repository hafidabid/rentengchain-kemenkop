/**
 * Dummy KTP (Indonesian ID card) image generator. Produces an SVG card with the
 * member's name + NIK so the demo has a real, viewable KTP without a real scan.
 * SVG needs no native image deps and renders directly in <img> / the browser.
 */
export interface GeneratedKtp {
  key: string;
  contentType: string;
  body: string;
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

/** Object key for a member's KTP, derived from NIK (stable/idempotent). */
export function ktpKey(nik: string): string {
  return `ktp/${nik}.svg`;
}

export function generateDummyKtp(nama: string, nik: string): GeneratedKtp {
  const safeNama = escapeXml(nama);
  const safeNik = escapeXml(nik);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400" role="img" aria-label="KTP dummy ${safeNama}">
  <rect width="640" height="400" rx="16" fill="#FAF9F8" stroke="#E5544F" stroke-width="3"/>
  <rect x="0" y="0" width="640" height="64" rx="16" fill="#F06A6A"/>
  <rect x="0" y="40" width="640" height="24" fill="#F06A6A"/>
  <text x="24" y="41" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#ffffff">KARTU TANDA PENDUDUK — DUMMY</text>
  <rect x="440" y="96" width="176" height="220" rx="8" fill="#EAE8E6" stroke="#C9C6C2"/>
  <text x="528" y="212" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#6D6E6F">FOTO</text>
  <g font-family="Arial, sans-serif" fill="#1E1F21">
    <text x="24" y="112" font-size="13" fill="#6D6E6F">NIK</text>
    <text x="24" y="140" font-size="24" font-weight="700" letter-spacing="2">${safeNik}</text>
    <text x="24" y="184" font-size="13" fill="#6D6E6F">Nama</text>
    <text x="24" y="210" font-size="22" font-weight="600">${safeNama}</text>
    <text x="24" y="250" font-size="13" fill="#6D6E6F">Kewarganegaraan</text>
    <text x="24" y="272" font-size="18">WNI</text>
  </g>
  <text x="24" y="360" font-family="Arial, sans-serif" font-size="12" fill="#9a9896">RantaiRenteng — contoh KTP untuk demo, bukan dokumen resmi.</text>
</svg>`;
  return { key: ktpKey(nik), contentType: 'image/svg+xml', body };
}
