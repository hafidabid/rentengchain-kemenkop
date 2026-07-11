import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Bot, User, Sparkles, AlertTriangle } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { formatTimestamp } from "../lib/format";
import type { ChatTurn } from "../types";

interface Meta {
  snapshotAt: string;
  configured: boolean;
}

const SUGGESTIONS = [
  "Berapa total anggota dan status KYC-nya?",
  "Bagaimana ringkasan pinjaman saat ini?",
  "Berapa total simpanan koperasi?",
];

/** Pengurus-facing grounded chat assistant (Flow ⑤). */
export default function AssistantChat() {
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState<Meta | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Prime the "Data per <snapshotAt>" disclaimer without consuming a turn.
    api
      .assistantSnapshot()
      .then((s: any) => {
        if (s?.generatedAt)
          setMeta((m) => m ?? { snapshotAt: s.generatedAt, configured: true });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [history, busy]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const next: ChatTurn[] = [...history, { role: "user", text: trimmed }];
    setHistory(next);
    setInput("");
    setBusy(true);
    try {
      const res = await api.assistantChat(next);
      setHistory([...next, { role: "model", text: res.reply }]);
      setMeta({ snapshotAt: res.snapshotAt, configured: res.configured });
    } catch (err) {
      setHistory([
        ...next,
        {
          role: "model",
          text:
            err instanceof ApiError
              ? `Maaf, terjadi kesalahan: ${err.message}`
              : "Maaf, asisten tidak dapat dihubungi.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E4E4E4] shadow-sm flex flex-col h-[560px] overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#F06A6A] to-[#E5544F] text-white px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Bot className="w-4.5 h-4.5" />
          </div>
          <div>
            <h4 className="text-sm font-black leading-tight">Asisten AI Koperasi</h4>
            <span className="text-[10px] text-red-100">
              Grounded pada data ledger real-time
            </span>
          </div>
        </div>
        <Sparkles className="w-5 h-5 opacity-80" />
      </div>

      {/* Disclaimers */}
      {meta && (
        <div className="shrink-0">
          <div className="px-4 py-1.5 text-[10px] text-[#6D6E6F] bg-[#FAF9F8] border-b border-[#E4E4E4]">
            Data per {formatTimestamp(meta.snapshotAt)}
          </div>
          {!meta.configured && (
            <div className="px-4 py-1.5 text-[10px] text-[#8a5a12] bg-[#FDF6E2] border-b border-[#F1BD6C]/30 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              GEMINI_API_KEY belum disetel — jawaban memakai ringkasan snapshot
              deterministik.
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAF9F8]">
        {history.length === 0 && (
          <div className="text-center py-6 space-y-3">
            <Bot className="w-10 h-10 text-[#F06A6A] mx-auto opacity-70" />
            <p className="text-xs text-[#6D6E6F]">
              Tanyakan apa saja tentang data koperasi Anda.
            </p>
            <div className="flex flex-col gap-1.5 items-center">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-[11px] font-semibold text-[#F06A6A] bg-white border border-[#F06A6A]/20 hover:bg-[#FCE8E6]/40 px-3 py-1.5 rounded-full transition-colors max-w-full"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {history.map((turn, i) => (
          <div
            key={i}
            className={`flex gap-2 ${turn.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                turn.role === "user"
                  ? "bg-[#1E1F21] text-white"
                  : "bg-[#FCE8E6] text-[#F06A6A]"
              }`}
            >
              {turn.role === "user" ? (
                <User className="w-3.5 h-3.5" />
              ) : (
                <Bot className="w-3.5 h-3.5" />
              )}
            </div>
            <div
              className={`max-w-[78%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words ${
                turn.role === "user"
                  ? "bg-[#1E1F21] text-white rounded-tr-sm"
                  : "bg-white border border-[#E4E4E4] text-[#1E1F21] rounded-tl-sm"
              }`}
            >
              {turn.text}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-[#FCE8E6] text-[#F06A6A] flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bg-white border border-[#E4E4E4] rounded-2xl rounded-tl-sm px-3 py-2 flex items-center gap-1.5 text-xs text-[#6D6E6F]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menganalisis…
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="p-3 border-t border-[#E4E4E4] bg-white flex items-center gap-2 shrink-0"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ketik pertanyaan…"
          disabled={busy}
          className="flex-1 text-xs border border-[#E4E4E4] rounded-xl px-3 py-2.5 bg-[#FAF9F8] focus:bg-white focus:ring-1 focus:ring-[#F06A6A] outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="bg-[#F06A6A] hover:bg-[#E5544F] disabled:opacity-50 text-white p-2.5 rounded-xl transition-colors"
          aria-label="Kirim"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
