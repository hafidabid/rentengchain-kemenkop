import { useEffect, useState } from "react";
import { History, Loader2, CheckCircle2, XCircle, PauseCircle, MessageSquare } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { formatTimestamp } from "../lib/format";
import type { LoanDecision } from "../types";

function iconFor(decision: string) {
  const d = decision.toLowerCase();
  if (d.includes("setuj") || d.includes("approve"))
    return <CheckCircle2 className="w-3.5 h-3.5 text-[#548235]" />;
  if (d.includes("tolak") || d.includes("reject"))
    return <XCircle className="w-3.5 h-3.5 text-[#C0392B]" />;
  if (d.includes("tunda") || d.includes("hold") || d.includes("sanggah"))
    return <PauseCircle className="w-3.5 h-3.5 text-[#C55A11]" />;
  return <MessageSquare className="w-3.5 h-3.5 text-[#6D6E6F]" />;
}

/** Decision-history timeline for a single loan (Pengurus review surface). */
export default function LoanDecisionTimeline({ loanId }: { loanId: string }) {
  const [decisions, setDecisions] = useState<LoanDecision[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDecisions(null);
    setError(null);
    api
      .getLoanDecisions(loanId)
      .then((d) => {
        if (!cancelled) setDecisions(d);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof ApiError ? err.message : "Gagal memuat riwayat.");
      });
    return () => {
      cancelled = true;
    };
  }, [loanId]);

  return (
    <div className="bg-[#FAF9F8] border border-[#E4E4E4] rounded-xl p-3">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <History className="w-3.5 h-3.5" /> Riwayat Keputusan
      </span>
      {decisions === null && !error ? (
        <div className="flex items-center gap-2 text-[11px] text-[#6D6E6F] py-1">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat riwayat…
        </div>
      ) : error ? (
        <p className="text-[11px] text-[#C0392B] italic">{error}</p>
      ) : decisions && decisions.length === 0 ? (
        <p className="text-[11px] text-slate-400 italic">
          Belum ada keputusan tercatat untuk pinjaman ini.
        </p>
      ) : (
        <ol className="space-y-2.5">
          {decisions!.map((d, i) => (
            <li key={d.id} className="flex gap-2.5">
              <div className="flex flex-col items-center">
                <span className="mt-0.5">{iconFor(d.decision)}</span>
                {i < decisions!.length - 1 && (
                  <span className="w-px flex-1 bg-[#E4E4E4] my-1" />
                )}
              </div>
              <div className="pb-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <strong className="text-[11px] text-[#1E1F21] capitalize">
                    {d.decision}
                  </strong>
                  <span className="text-[10px] text-slate-400">
                    {formatTimestamp(d.createdAt)}
                  </span>
                </div>
                <p className="text-[10px] text-[#6D6E6F]">oleh {d.aktor}</p>
                {d.note && (
                  <p className="text-[11px] text-[#1E1F21] bg-white border border-[#E4E4E4] rounded-lg px-2 py-1 mt-1 italic">
                    "{d.note}"
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
