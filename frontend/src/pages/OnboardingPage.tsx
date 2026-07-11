import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  UploadCloud,
  UserPlus,
  X,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { Peran } from '../types';

const PERAN_OPTIONS: { value: Peran; label: string }[] = [
  { value: 'penabung', label: 'Penabung' },
  { value: 'peminjam', label: 'Peminjam' },
  { value: 'keduanya', label: 'Keduanya' },
];

const field =
  'w-full text-sm font-semibold border border-[#E4E4E4] rounded-xl px-3 py-2.5 bg-[#FAF9F8] outline-none focus:border-[#F06A6A] focus:bg-white transition-colors';
const labelCls =
  'block text-xs font-bold text-[#6D6E6F] uppercase tracking-wide mb-1.5';

export default function OnboardingPage() {
  const navigate = useNavigate();

  const [nama, setNama] = useState('');
  const [nik, setNik] = useState('');
  const [noHp, setNoHp] = useState('');
  const [alamat, setAlamat] = useState('');
  const [pekerjaan, setPekerjaan] = useState('');
  const [peran, setPeran] = useState<Peran>('keduanya');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const onPickFile = (f: File | null) => {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      let ktpUrl: string | undefined;
      if (file) {
        const uploaded = await api.uploadKtp(file);
        ktpUrl = uploaded.ktpUrl;
      }
      await api.submitKyc({
        nama: nama.trim(),
        nik: nik.trim(),
        noHp: noHp.trim(),
        alamat: alamat.trim(),
        pekerjaan: pekerjaan.trim(),
        peran,
        ktpUrl,
      });
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Terjadi kesalahan tak terduga saat mendaftar.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-[#FAF9F8] text-[#1E1F21] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white p-8 rounded-3xl border border-[#E4E4E4] text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#EDF9F0] flex items-center justify-center text-[#3FA35B]">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-black">Pendaftaran Terkirim</h1>
          <p className="text-sm text-[#6D6E6F]">
            KYC Anda berstatus <b>Requested</b> dan menunggu persetujuan Pengurus.
            Setelah disetujui, dompet on-chain Anda dibuat otomatis.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 w-full bg-[#F06A6A] hover:bg-[#E5544F] text-white font-extrabold text-sm py-3 rounded-xl"
          >
            Ke Halaman Masuk
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F8] text-[#1E1F21] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-5">
          <img
            src="/logo_banner.png"
            alt="RantaiRenteng"
            className="h-14 w-auto object-contain mb-2"
          />
          <h1 className="text-lg font-black tracking-tight uppercase">
            Pendaftaran Anggota
          </h1>
          <p className="text-[#6D6E6F] text-xs font-medium mt-1">
            Isi data diri dan unggah KTP untuk mengajukan KYC.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-3xl border border-[#E4E4E4] shadow-[0_2px_12px_rgba(30,31,33,0.05)] space-y-4"
        >
          <div>
            <label className={labelCls}>Nama Lengkap</label>
            <input
              required
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Nama sesuai KTP"
              className={field}
            />
          </div>

          <div>
            <label className={labelCls}>NIK</label>
            <input
              required
              inputMode="numeric"
              value={nik}
              onChange={(e) => setNik(e.target.value)}
              placeholder="16 digit NIK"
              className={field}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>No. HP</label>
              <input
                required
                inputMode="tel"
                value={noHp}
                onChange={(e) => setNoHp(e.target.value)}
                placeholder="0812…"
                className={field}
              />
            </div>
            <div>
              <label className={labelCls}>Peran</label>
              <select
                value={peran}
                onChange={(e) => setPeran(e.target.value as Peran)}
                className={field}
              >
                {PERAN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Alamat</label>
            <input
              required
              value={alamat}
              onChange={(e) => setAlamat(e.target.value)}
              placeholder="Alamat domisili"
              className={field}
            />
          </div>

          <div>
            <label className={labelCls}>Pekerjaan</label>
            <input
              required
              value={pekerjaan}
              onChange={(e) => setPekerjaan(e.target.value)}
              placeholder="mis. Pengusaha Kripik"
              className={field}
            />
          </div>

          {/* KTP file-picker (optional) */}
          <div>
            <label className={labelCls}>Foto KTP</label>
            {preview ? (
              <div className="relative rounded-xl overflow-hidden border border-[#E4E4E4]">
                <img
                  src={preview}
                  alt="Pratinjau KTP"
                  className="w-full max-h-44 object-contain bg-[#FAF9F8]"
                />
                <button
                  type="button"
                  onClick={() => onPickFile(null)}
                  className="absolute top-2 right-2 bg-white/90 hover:bg-white rounded-lg p-1.5 border border-[#E4E4E4]"
                  aria-label="Hapus KTP"
                >
                  <X className="w-4 h-4 text-[#6D6E6F]" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-[#E4E4E4] rounded-xl px-3 py-6 cursor-pointer hover:border-[#F06A6A] hover:bg-[#FCE8E6]/30 transition-colors text-center">
                <UploadCloud className="w-6 h-6 text-[#F06A6A]" />
                <span className="text-xs font-bold text-[#1E1F21]">
                  Unggah foto KTP
                </span>
                <span className="text-[11px] text-[#9CA1A8]">
                  KTP asli Anda — untuk demo, gambar apa pun boleh (opsional)
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
            {file && (
              <p className="text-[11px] text-[#6D6E6F] mt-1.5 truncate">
                {file.name}
              </p>
            )}
          </div>

          {error && (
            <div className="bg-[#FCE8E6] border border-[#F06A6A]/30 text-[#C0392B] text-xs font-semibold rounded-xl p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#F06A6A] hover:bg-[#E5544F] disabled:opacity-60 text-white font-extrabold text-sm py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Mengirim…
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" /> Ajukan Pendaftaran
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full text-[#6D6E6F] hover:text-[#1E1F21] text-xs font-bold flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Sudah punya akun? Masuk
          </button>
        </form>
      </div>
    </div>
  );
}
