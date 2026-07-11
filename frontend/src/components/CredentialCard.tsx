import { useState } from "react";
import { KeyRound, Copy, Check, X, ShieldAlert } from "lucide-react";

/**
 * One-time credential card shown after a Pengurus approves a member or resets a
 * password. Surfaces the NIK (login id) + temporary password once, with copy.
 */
export default function CredentialCard({
  nik,
  password,
  nama,
  title = "Kredensial Sekali Tampil",
  onClose,
}: {
  nik: string;
  password: string;
  nama?: string;
  title?: string;
  onClose?: () => void;
}) {
  const [copied, setCopied] = useState<"nik" | "pw" | "both" | null>(null);

  const copy = async (value: string, which: "nik" | "pw" | "both") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard blocked — ignore */
    }
  };

  return (
    <div className="bg-white border-2 border-[#62D26F]/40 rounded-2xl shadow-lg overflow-hidden">
      <div className="bg-[#EDF9F0] px-4 py-2.5 border-b border-[#62D26F]/20 flex items-center justify-between">
        <span className="text-xs font-extrabold text-[#548235] uppercase tracking-wider flex items-center gap-1.5">
          <KeyRound className="w-4 h-4" /> {title}
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="text-[#548235] hover:text-[#1E1F21] p-1 rounded"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="p-4 space-y-3 text-xs">
        {nama && (
          <p className="text-[#6D6E6F]">
            Untuk anggota <strong className="text-[#1E1F21]">{nama}</strong>
          </p>
        )}
        <CredRow
          label="NIK (untuk login)"
          value={nik}
          copied={copied === "nik"}
          onCopy={() => copy(nik, "nik")}
        />
        <CredRow
          label="Kata sandi sementara"
          value={password}
          mono
          copied={copied === "pw"}
          onCopy={() => copy(password, "pw")}
        />
        <button
          onClick={() => copy(`NIK: ${nik}\nSandi: ${password}`, "both")}
          className="w-full flex items-center justify-center gap-1.5 bg-[#F06A6A] hover:bg-[#E5544F] text-white font-bold py-2 rounded-xl transition-colors"
        >
          {copied === "both" ? (
            <Check className="w-4 h-4" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          {copied === "both" ? "Tersalin" : "Salin NIK & Sandi"}
        </button>
        <div className="flex items-start gap-1.5 text-[10px] text-[#C55A11] bg-[#FDF6E2] border border-[#F1BD6C]/30 rounded-lg p-2">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Sandi ini <strong>hanya ditampilkan sekali</strong>. Catat & serahkan
            ke anggota; setelah kartu ini ditutup sandi tidak dapat dilihat lagi.
          </span>
        </div>
      </div>
    </div>
  );
}

function CredRow({
  label,
  value,
  mono,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 bg-[#FAF9F8] border border-[#E4E4E4] rounded-xl px-3 py-2">
      <div className="min-w-0">
        <span className="text-[10px] text-slate-400 block uppercase tracking-wider">
          {label}
        </span>
        <span
          className={`text-sm font-bold text-[#1E1F21] break-all ${mono ? "font-mono tracking-wide" : ""}`}
        >
          {value}
        </span>
      </div>
      <button
        onClick={onCopy}
        className="shrink-0 p-2 rounded-lg bg-white border border-[#E4E4E4] hover:bg-[#FCE8E6]/40 text-[#F06A6A]"
        aria-label={`Salin ${label}`}
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
