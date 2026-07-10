"""
RantaiRenteng — Asisten Skrining Risiko Anggota (prototipe explainable)
=======================================================================
Tujuan  : Membantu KETUA TANGGUNG RENTENG & pengurus mendeteksi dini risiko
          gagal bayar SEBELUM menyetujui pinjaman kelompok.
Sifat   : ALAT BANTU KEPUTUSAN (decision-support) -> menghasilkan PERINGATAN
          yang bisa ditinjau, BUKAN vonis otomatis.

PRINSIP TATA KELOLA (wajib dipatuhi implementasi nyata):
  1. CONSENT: calon peminjam menyetujui skrining (UU PDP No. 27/2022).
  2. SUMBER SAH: data internal koperasi + self-declared terverifikasi +
     referensi grup + sinyal publik yang boleh diakses. TIDAK melakukan
     scraping diam-diam akun/medsos pribadi.
  3. EXPLAINABLE: setiap kontribusi skor punya alasan yang bisa dibaca.
  4. HUMAN-IN-THE-LOOP: keputusan akhir di tangan ketua grup + pengurus.
  5. HAK SANGGAH: setiap flag adverse bisa dibantah anggota.
  6. FAIRNESS: TIDAK memakai atribut sensitif (gender, agama, suku, dsb).
  7. FLAG BELUM TERVERIFIKASI != penalti penuh. Hanya memicu "perlu tinjau"
     agar tidak menghukum karena false-positive (nama sama / hoaks).
"""

from dataclasses import dataclass, field
from typing import List, Optional
import json


# --------------------------------------------------------------------------
# INPUT
# --------------------------------------------------------------------------
@dataclass
class AdverseFlag:
    jenis: str                 # mis. "Tunggakan tersembunyi", "Catatan hukum keuangan"
    sumber: str                # mis. "Cross-check DB koperasi lain", "SLIK/daftar resmi"
    terverifikasi: bool = False
    keterangan: str = ""


@dataclass
class Kandidat:
    nama: str
    consent: bool = False                      # WAJIB True untuk diproses

    # Pilar 1 — Rekam Internal Koperasi (0..1 rasio, kecuali tenure/bulan)
    simpanan_ontime_rate: Optional[float] = None   # % simpanan wajib PAID tepat waktu
    cicilan_ontime_rate: Optional[float] = None    # % cicilan lampau tepat waktu
    tenure_bulan: Optional[int] = None             # lama keanggotaan
    kehadiran_rate: Optional[float] = None         # % hadir pertemuan grup

    # Pilar 2 — Kapasitas (self-declared, perlu verifikasi)
    penghasilan_bulanan: Optional[int] = None
    total_cicilan_bulanan: Optional[int] = None    # semua kewajiban (termasuk pengajuan ini)
    stabilitas_penghasilan: str = "tidak_tetap"    # tetap | musiman | tidak_tetap
    kapasitas_terverifikasi: bool = False

    # Pilar 3 — Referensi Sosial Grup (inti tanggung renteng)
    ketua_vouch: str = "ragu"                      # ya | ragu | tidak
    anggota_kenal_lama: int = 0                    # jumlah anggota grup kenal >1 thn
    ukuran_grup: int = 0
    reputasi_komunitas: str = "cukup"              # baik | cukup | kurang

    # Pilar 4 — Sinyal Adverse (publik/lintas-data, dengan consent)
    adverse: List[AdverseFlag] = field(default_factory=list)


# --------------------------------------------------------------------------
# HELPER
# --------------------------------------------------------------------------
def _clip(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def _pts(reason, value, maxpts):
    """Kembalikan dict kontribusi terbaca."""
    value = round(value, 1)
    return {"faktor": reason, "poin": value, "maks": maxpts}


# --------------------------------------------------------------------------
# ENGINE
# --------------------------------------------------------------------------
class RiskScreener:
    # Bobot pilar positif (total 100). Adverse = gate/pengurang, bukan bobot positif.
    MAKS = {"internal": 45, "kapasitas": 30, "sosial": 25}

    def score(self, k: Kandidat) -> dict:
        if not k.consent:
            return {
                "nama": k.nama,
                "status": "DITOLAK_PROSES",
                "alasan": "Tidak ada persetujuan (consent) skrining. Wajib sesuai UU PDP.",
            }

        rincian = []
        completeness = []  # untuk confidence

        # ---------------- Pilar 1: Rekam Internal (maks 45) ----------------
        p1 = 0.0
        if k.simpanan_ontime_rate is not None:
            v = _clip(k.simpanan_ontime_rate) * 18
            p1 += v; rincian.append(_pts("Simpanan wajib tepat waktu", v, 18)); completeness.append(1)
        else:
            completeness.append(0); rincian.append(_pts("Simpanan wajib (data kosong)", 0, 18))
        if k.cicilan_ontime_rate is not None:
            v = _clip(k.cicilan_ontime_rate) * 15
            p1 += v; rincian.append(_pts("Riwayat cicilan tepat waktu", v, 15)); completeness.append(1)
        else:
            completeness.append(0); rincian.append(_pts("Riwayat cicilan (belum ada / anggota baru)", 0, 15))
        if k.tenure_bulan is not None:
            v = _clip(k.tenure_bulan / 24) * 6
            p1 += v; rincian.append(_pts("Lama keanggotaan", v, 6)); completeness.append(1)
        else:
            completeness.append(0)
        if k.kehadiran_rate is not None:
            v = _clip(k.kehadiran_rate) * 6
            p1 += v; rincian.append(_pts("Kehadiran pertemuan grup", v, 6)); completeness.append(1)
        else:
            completeness.append(0)

        # ---------------- Pilar 2: Kapasitas (maks 30) ----------------
        p2 = 0.0
        if k.penghasilan_bulanan and k.total_cicilan_bulanan is not None and k.penghasilan_bulanan > 0:
            dsr = k.total_cicilan_bulanan / k.penghasilan_bulanan   # debt service ratio
            # DSR <=0.30 -> penuh (18); >=0.70 -> 0
            v = _clip((0.70 - dsr) / (0.70 - 0.30)) * 18
            p2 += v
            rincian.append(_pts(f"Rasio cicilan/penghasilan (DSR={dsr:.0%})", v, 18)); completeness.append(1)
        else:
            completeness.append(0); rincian.append(_pts("Kapasitas bayar (data kosong)", 0, 18))
        stab = {"tetap": 7, "musiman": 4, "tidak_tetap": 2}.get(k.stabilitas_penghasilan, 2)
        p2 += stab; rincian.append(_pts(f"Stabilitas penghasilan ({k.stabilitas_penghasilan})", stab, 7))
        # verifikasi menaikkan sedikit keyakinan kapasitas
        if k.kapasitas_terverifikasi:
            v = 5; p2 += v; rincian.append(_pts("Kapasitas terverifikasi", v, 5)); completeness.append(1)
        else:
            rincian.append(_pts("Kapasitas BELUM diverifikasi", 0, 5)); completeness.append(0)

        # ---------------- Pilar 3: Referensi Sosial Grup (maks 25) ----------------
        p3 = 0.0
        vouch = {"ya": 10, "ragu": 4, "tidak": 0}.get(k.ketua_vouch, 4)
        p3 += vouch; rincian.append(_pts(f"Jaminan ketua grup ({k.ketua_vouch})", vouch, 10))
        if k.ukuran_grup > 0:
            v = _clip(k.anggota_kenal_lama / max(k.ukuran_grup, 1)) * 8
            p3 += v; rincian.append(_pts("Anggota grup kenal >1 thn", v, 8)); completeness.append(1)
        else:
            completeness.append(0)
        rep = {"baik": 7, "cukup": 4, "kurang": 1}.get(k.reputasi_komunitas, 4)
        p3 += rep; rincian.append(_pts(f"Reputasi komunitas ({k.reputasi_komunitas})", rep, 7))

        base = p1 + p2 + p3   # 0..100

        # ---------------- Pilar 4: Gate Adverse ----------------
        DED = {   # pengurang bila TERVERIFIKASI
            "Tunggakan tersembunyi": 25,
            "Ketidaksesuaian data": 12,
            "Catatan hukum keuangan": 20,
            "Berita negatif keuangan": 10,
        }
        pengurang = 0.0
        adverse_out = []
        ada_flag_terbuka = False       # flag apa pun -> minimal KUNING
        ada_verified_serius = False
        for f in k.adverse:
            ded = DED.get(f.jenis, 8)
            if f.terverifikasi:
                pengurang += ded
                if ded >= 20:
                    ada_verified_serius = True
                adverse_out.append({"jenis": f.jenis, "status": "TERVERIFIKASI",
                                    "dampak": -ded, "sumber": f.sumber, "ket": f.keterangan})
            else:
                # belum terverifikasi -> TIDAK memotong penuh, hanya flag review
                adverse_out.append({"jenis": f.jenis, "status": "PERLU VERIFIKASI",
                                    "dampak": 0, "sumber": f.sumber, "ket": f.keterangan,
                                    "catatan": "Tidak memotong skor sampai diverifikasi (hindari false-positive)."})
            ada_flag_terbuka = True

        skor = round(_clip((base - pengurang) / 100) * 100)

        # ---------------- Confidence ----------------
        conf = round(sum(completeness) / len(completeness) * 100) if completeness else 0

        # ---------------- Banding / Band & Rekomendasi ----------------
        if ada_verified_serius or skor < 50:
            band, warna = "MERAH — Risiko Tinggi", "merah"
            aksi = "Tinjau manual mendalam. Jangan cairkan tanpa verifikasi & mitigasi (penjamin/plafon kecil)."
        elif ada_flag_terbuka or skor < 70:
            band, warna = "KUNING — Perlu Tinjau", "kuning"
            aksi = "Boleh lanjut DENGAN SYARAT: verifikasi flag, tambah penjamin, plafon/tenor disesuaikan, atau mulai pinjaman kecil."
        else:
            band, warna = "HIJAU — Risiko Rendah", "hijau"
            aksi = "Layak dilanjutkan ke musyawarah grup untuk persetujuan."

        if conf < 50:
            aksi += " CATATAN: data belum lengkap (confidence rendah) — kumpulkan bukti tambahan dulu."

        return {
            "nama": k.nama,
            "skor": skor,
            "band": band,
            "warna": warna,
            "confidence_pct": conf,
            "pilar": {"internal": round(p1, 1), "kapasitas": round(p2, 1), "sosial": round(p3, 1),
                      "pengurang_adverse": round(pengurang, 1)},
            "rincian_faktor": rincian,
            "adverse_flags": adverse_out,
            "rekomendasi": aksi,
            "catatan_governance": ("Peringatan bantu keputusan, BUKAN vonis. Keputusan akhir di ketua grup + "
                                   "pengurus. Anggota berhak menyanggah setiap flag. Atribut sensitif tidak dipakai."),
        }


# --------------------------------------------------------------------------
# CONTOH / SELF-TEST
# --------------------------------------------------------------------------
def _print(hasil):
    print("=" * 68)
    print(f"KANDIDAT: {hasil['nama']}")
    if hasil.get("status") == "DITOLAK_PROSES":
        print("  ->", hasil["alasan"]); return
    print(f"  SKOR: {hasil['skor']}/100  |  {hasil['band']}  |  confidence {hasil['confidence_pct']}%")
    print(f"  Pilar: internal {hasil['pilar']['internal']}/45, kapasitas {hasil['pilar']['kapasitas']}/30, "
          f"sosial {hasil['pilar']['sosial']}/25, adverse -{hasil['pilar']['pengurang_adverse']}")
    if hasil["adverse_flags"]:
        print("  FLAG:")
        for f in hasil["adverse_flags"]:
            print(f"    - [{f['status']}] {f['jenis']} (dampak {f['dampak']}) · {f['sumber']}")
    print(f"  REKOMENDASI: {hasil['rekomendasi']}")


if __name__ == "__main__":
    eng = RiskScreener()

    # 1) Anggota disiplin, referensi kuat, tanpa flag -> HIJAU
    bu_sri = Kandidat("Bu Sri (penabung disiplin)", consent=True,
        simpanan_ontime_rate=0.98, cicilan_ontime_rate=0.97, tenure_bulan=30, kehadiran_rate=0.95,
        penghasilan_bulanan=3_500_000, total_cicilan_bulanan=700_000, stabilitas_penghasilan="tetap",
        kapasitas_terverifikasi=True, ketua_vouch="ya", anggota_kenal_lama=7, ukuran_grup=8,
        reputasi_komunitas="baik")

    # 2) KASUS KUNCI: terlihat baik di masyarakat (referensi kuat) TAPI ada tunggakan
    #    tersembunyi terverifikasi dari cross-check data koperasi lain -> dipaksa MERAH/KUNING
    pak_x = Kandidat("Pak X (terlihat baik, ada tunggakan tersembunyi)", consent=True,
        simpanan_ontime_rate=0.9, cicilan_ontime_rate=None, tenure_bulan=6, kehadiran_rate=0.8,
        penghasilan_bulanan=4_000_000, total_cicilan_bulanan=1_800_000, stabilitas_penghasilan="musiman",
        kapasitas_terverifikasi=False, ketua_vouch="ya", anggota_kenal_lama=6, ukuran_grup=8,
        reputasi_komunitas="baik",
        adverse=[AdverseFlag("Tunggakan tersembunyi", "Cross-check DB koperasi mitra", terverifikasi=True,
                             keterangan="Kredit macet di koperasi lain yang tidak diakui saat wawancara.")])

    # 3) Flag BELUM terverifikasi (mis. berita negatif nama mirip) -> tidak memotong, hanya KUNING
    bu_y = Kandidat("Bu Y (ada flag belum terverifikasi)", consent=True,
        simpanan_ontime_rate=0.85, cicilan_ontime_rate=0.9, tenure_bulan=18, kehadiran_rate=0.7,
        penghasilan_bulanan=3_000_000, total_cicilan_bulanan=900_000, stabilitas_penghasilan="tetap",
        kapasitas_terverifikasi=True, ketua_vouch="ragu", anggota_kenal_lama=4, ukuran_grup=8,
        reputasi_komunitas="cukup",
        adverse=[AdverseFlag("Berita negatif keuangan", "Pencarian publik (nama mirip)", terverifikasi=False,
                             keterangan="Perlu dipastikan apakah benar orang yang sama.")])

    # 4) Tanpa consent -> tidak diproses
    no_consent = Kandidat("Pak Z (tanpa consent)", consent=False)

    for kand in (bu_sri, pak_x, bu_y, no_consent):
        _print(eng.score(kand))
    print("=" * 68)
    print("\nContoh keluaran JSON (untuk integrasi backend):")
    print(json.dumps(eng.score(pak_x), ensure_ascii=False, indent=2)[:800], "...")
