import { useEffect, useState } from "react";
import {
  X,
  Loader2,
  Wallet,
  PiggyBank,
  CreditCard,
  HeartHandshake,
  User,
  ExternalLink,
} from "lucide-react";
import { api, ApiError } from "../lib/api";
import { formatIdr, formatTimestamp } from "../lib/format";
import type { MemberDetail } from "../types";

const flagStyle: Record<string, string> = {
  MERAH: "bg-[#FCE8E6] text-[#F06A6A]",
  KUNING: "bg-[#FDF6E2] text-[#C55A11]",
  HIJAU: "bg-[#EDF9F0] text-[#548235]",
};

/** Slide-in drawer showing a member's full profile, savings, loans & renteng. */
export default function MemberDetailDrawer({
  memberId,
  onClose,
}: {
  memberId: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setError(null);
    api
      .getMemberDetail(memberId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof ApiError ? err.message : "Gagal memuat detail.");
      });
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const m = detail?.member;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md h-full bg-[#FAF9F8] shadow-2xl flex flex-col animate-[slideIn_0.2s_ease-out]">
        {/* Header */}
        <div className="bg-[#1E1F21] text-white px-5 py-4 flex items-center justify-between shrink-0">
          <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5">
            <User className="w-4 h-4 text-[#F06A6A]" /> Detail Anggota
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {!detail && !error && (
            <div className="flex items-center gap-2 text-[#6D6E6F] py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Memuat detail anggota…
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-center">
              {error}
            </div>
          )}

          {m && (
            <>
              {/* Profile */}
              <div className="bg-white rounded-xl border border-[#E4E4E4] p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-[#1E1F21]">{m.nama}</h3>
                  <span className="text-[9px] font-bold text-[#548235] bg-[#EDF9F0] px-2 py-0.5 rounded-full uppercase">
                    Skor {m.skorKeanggotaan}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                  <Field label="NIK" value={m.nik} />
                  <Field label="No. HP" value={m.noHp} />
                  <Field label="Pekerjaan" value={m.pekerjaan} />
                  <Field label="Peran" value={m.peran} capitalize />
                  <Field label="Status KYC" value={m.statusKyc} />
                  <Field label="Alamat" value={m.alamat} />
                </div>
                <div className="bg-[#FCE8E6]/60 border border-[#F06A6A]/15 rounded-lg p-2 mt-1">
                  <span className="text-[9px] font-black text-[#F06A6A] uppercase tracking-wider flex items-center gap-1">
                    <Wallet className="w-3 h-3" /> Dompet On-Chain
                  </span>
                  <p className="font-mono text-[11px] text-[#1E1F21] break-all mt-0.5">
                    {m.walletAddress ?? "Belum diterbitkan"}
                  </p>
                </div>
              </div>

              {/* Savings balances */}
              <Section icon={PiggyBank} title="Saldo Simpanan">
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Pokok" value={formatIdr(m.simpananPokok)} />
                  <Stat label="Wajib" value={formatIdr(m.simpananWajib)} />
                  <Stat label="Sukarela" value={formatIdr(m.simpananSukarela)} />
                </div>
                {detail.savings.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                    {detail.savings.map((s) => (
                      <div
                        key={s.id}
                        className="flex justify-between items-center border-b border-slate-100 pb-1 last:border-0"
                      >
                        <span className="text-[11px] font-semibold text-slate-700">
                          Simpanan {s.jenis}
                        </span>
                        <span className="text-[11px] font-mono text-[#1E1F21]">
                          {formatIdr(s.nominal)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Loans */}
              <Section icon={CreditCard} title={`Pinjaman (${detail.loans.length})`}>
                {detail.loans.length === 0 ? (
                  <Empty>Belum ada pinjaman.</Empty>
                ) : (
                  <div className="space-y-2">
                    {detail.loans.map((l) => (
                      <div
                        key={l.id}
                        className="border border-[#E4E4E4] rounded-lg p-2.5 bg-[#FAF9F8]"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-[11px] text-[#1E1F21] truncate">
                              {l.tujuan}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {l.status} · {l.tenor} bln
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-black text-[11px] text-[#1E1F21] block">
                              {formatIdr(l.nominal)}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${flagStyle[l.flagAi] ?? "bg-slate-100 text-slate-600"}`}
                            >
                              {l.flagAi}
                            </span>
                          </div>
                        </div>
                        {l.txLink && (
                          <a
                            href={l.txLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] font-bold text-[#F06A6A] inline-flex items-center gap-0.5 mt-1"
                          >
                            tx <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Renteng history */}
              <Section icon={HeartHandshake} title="Riwayat Tanggung Renteng">
                {detail.rentengHistory.length === 0 ? (
                  <Empty>Anggota ini tidak pernah terlibat tanggung renteng.</Empty>
                ) : (
                  <div className="space-y-2">
                    {detail.rentengHistory.map((r) => (
                      <div
                        key={r.id}
                        className="flex justify-between items-center border-b border-slate-100 pb-1.5 last:border-0"
                      >
                        <div>
                          <span className="text-[11px] font-bold text-[#1E1F21] block capitalize">
                            {r.event}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            Periode {r.period} · {formatTimestamp(r.createdAt)}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-[#F06A6A]">
                          {formatIdr(r.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
    </div>
  );
}

function Field({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div>
      <span className="text-[9px] text-slate-400 uppercase tracking-wider block">
        {label}
      </span>
      <span
        className={`font-semibold text-[#1E1F21] break-words ${capitalize ? "capitalize" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof PiggyBank;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E4E4E4] p-4 space-y-2">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-[#F06A6A]" /> {title}
      </span>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#FAF9F8] rounded-lg p-2 text-center">
      <span className="text-[9px] text-slate-400 block">{label}</span>
      <strong className="text-[11px] text-[#1E1F21] block mt-0.5">{value}</strong>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] text-slate-400 italic text-center py-2">{children}</p>
  );
}
