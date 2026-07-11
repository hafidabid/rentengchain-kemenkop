import { useState, type ReactNode } from "react";
import { Info, Sparkles } from "lucide-react";

/** Shared Indonesian copy explaining the AI Early Warning System. */
export const EWS_COPY =
  "EWS (Early Warning System) — skrining risiko kredit berbasis AI (Gemini): skor 0–100 dan flag HIJAU/KUNING/MERAH dari histori bayar, tabungan, dan kehadiran kelompok.";

/**
 * Accessible tooltip: opens on hover AND on keyboard focus, dismissible on blur.
 * Renders the trigger inline; the bubble is absolutely positioned above it.
 */
export function InfoTooltip({
  text,
  children,
  label = "Info",
}: {
  text: string;
  children?: ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label={label}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className="inline-flex items-center gap-1 text-inherit cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F06A6A]/50 rounded"
      >
        {children ?? <Info className="w-3.5 h-3.5 opacity-70" />}
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 max-w-[80vw] bg-[#1E1F21] text-white text-[11px] leading-relaxed font-medium normal-case tracking-normal px-3 py-2 rounded-lg shadow-xl z-50 pointer-events-none"
        >
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1E1F21]" />
        </span>
      )}
    </span>
  );
}

/** Inline explainer block for EWS surfaces (loan review / risk screening). */
export function EwsExplainer() {
  return (
    <div className="bg-[#FDF6E2] border border-[#F1BD6C]/30 rounded-xl p-3 flex items-start gap-2 text-[11px] text-[#8a5a12] leading-relaxed">
      <Sparkles className="w-4 h-4 text-[#C55A11] shrink-0 mt-0.5" />
      <p>{EWS_COPY}</p>
    </div>
  );
}
