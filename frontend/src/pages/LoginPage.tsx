import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Landmark, LogIn, ShieldCheck, Loader2, UserPlus } from "lucide-react";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";

const DEMO_ACCOUNTS = [
  { label: "Pengurus (Admin)", nik: "3273010000000001" },
  { label: "Sri (Anggota, skor 98)", nik: "3273012345678901" },
  { label: "Anisa (Anggota, skor 45)", nik: "3273011122334455" },
];

const DEMO_PASSWORD = "RantaiRenteng2026";

export default function LoginPage() {
  const { member, login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // If already authenticated, bounce to the correct surface.
  useEffect(() => {
    if (member) {
      navigate(member.role === "Pengurus" ? "/laman-pengurus" : "/", {
        replace: true,
      });
    }
  }, [member, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const m = await login(identifier.trim(), password);
      navigate(m.role === "Pengurus" ? "/laman-pengurus" : "/", {
        replace: true,
      });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Terjadi kesalahan tak terduga saat masuk.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F8] text-[#1E1F21] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="flex flex-col items-center text-center mb-6">
          <img
            src="/logo_banner.png"
            alt="RantaiRenteng"
            className="h-16 w-auto object-contain mb-3"
          />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#FCE8E6] flex items-center justify-center text-[#F06A6A] border border-[#F06A6A]/10">
              <Landmark className="w-4 h-4" />
            </div>
            <h1 className="text-lg font-black tracking-tight uppercase">
              RantaiRenteng
            </h1>
          </div>
          <p className="text-[#6D6E6F] text-xs font-medium mt-1">
            Koperasi Digital Tanggung Renteng & Asisten Skrining EWS AI
          </p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-3xl border border-[#E4E4E4] shadow-[0_2px_12px_rgba(30,31,33,0.05)] space-y-4"
        >
          <div>
            <label className="block text-xs font-bold text-[#6D6E6F] uppercase tracking-wide mb-1.5">
              NIK (Nomor Induk Kependudukan)
            </label>
            <input
              type="text"
              inputMode="numeric"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="3273012345678901"
              className="w-full text-sm font-semibold border border-[#E4E4E4] rounded-xl px-3 py-2.5 bg-[#FAF9F8] outline-none focus:border-[#F06A6A] focus:bg-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#6D6E6F] uppercase tracking-wide mb-1.5">
              Kata Sandi
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full text-sm font-semibold border border-[#E4E4E4] rounded-xl px-3 py-2.5 bg-[#FAF9F8] outline-none focus:border-[#F06A6A] focus:bg-white transition-colors"
            />
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
                <Loader2 className="w-4 h-4 animate-spin" /> Memproses…
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" /> Masuk
              </>
            )}
          </button>
        </form>

        {/* Onboarding link */}
        <Link
          to="/daftar"
          className="mt-4 w-full bg-white hover:bg-[#F6F5F3] border border-[#E4E4E4] text-[#1E1F21] font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          <UserPlus className="w-4 h-4 text-[#F06A6A]" /> Daftar sebagai anggota
          baru
        </Link>

        {/* Demo credential helper */}
        <div className="bg-white mt-4 p-4 rounded-2xl border border-[#E4E4E4] space-y-2">
          <span className="text-[10px] font-bold text-[#6D6E6F] uppercase tracking-widest flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#F06A6A]" /> Akun Demo
            (kata sandi: {DEMO_PASSWORD})
          </span>
          <div className="space-y-1.5">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.nik}
                type="button"
                onClick={() => {
                  setIdentifier(acc.nik);
                  setPassword(DEMO_PASSWORD);
                }}
                className="w-full text-left flex justify-between items-center bg-[#FAF9F8] hover:bg-[#F6F5F3] border border-[#E4E4E4] rounded-xl px-3 py-2 text-xs transition-colors"
              >
                <span className="font-bold text-[#1E1F21]">{acc.label}</span>
                <span className="font-mono text-[#6D6E6F]">{acc.nik}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-[11px] text-[#9CA1A8] mt-4">
          &copy; 2026 RantaiRenteng by Calon Manager Merah Putih
        </p>
      </div>
    </div>
  );
}
