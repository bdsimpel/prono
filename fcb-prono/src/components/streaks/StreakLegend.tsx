"use client";

import { useState, useRef, useEffect } from "react";

const FLAME_PATH = "M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.176 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.546 3.75 3.75 0 0 1 3.255 3.718Z";

type Category = "bolletjes" | "vlammen" | "cirkels";

function InfoButton({ label, onClick, active }: { label: string; onClick: () => void; active: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 text-[11px] transition-colors px-2 py-1 rounded border ${
        active
          ? "text-gray-300 border-white/[0.15] bg-white/[0.04]"
          : "text-gray-500 hover:text-gray-300 border-white/[0.08] hover:border-white/[0.15]"
      }`}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
      {label}
    </button>
  );
}

interface StreakLegendProps {
  variant?: "stats" | "profile";
}

export default function StreakLegend({ variant = "stats" }: StreakLegendProps) {
  const [open, setOpen] = useState<Category | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const toggle = (cat: Category) => setOpen((v) => (v === cat ? null : cat));

  return (
    <div ref={ref} className="relative inline-flex gap-1">
      {variant === "profile" && (
        <InfoButton label="Bolletjes" onClick={() => toggle("bolletjes")} active={open === "bolletjes"} />
      )}
      <InfoButton label="Vlammen" onClick={() => toggle("vlammen")} active={open === "vlammen"} />
      <InfoButton label="Cirkels" onClick={() => toggle("cirkels")} active={open === "cirkels"} />

      {open && (
        <div className="absolute z-50 top-full right-0 mt-1.5 w-[200px] bg-cb-dark border border-white/[0.1] rounded-lg shadow-2xl p-3">
          {open === "bolletjes" && (
            <>
              <div className="text-[11px] text-gray-400 uppercase tracking-[0.15em] mb-2">
                Bolletjes
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cb-gold shrink-0" />
                  <span className="text-xs text-gray-300">Exact</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cb-blue shrink-0" />
                  <span className="text-xs text-gray-300">Goal verschil</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cb-blue/60 shrink-0" />
                  <span className="text-xs text-gray-300">Juist resultaat</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-600 shrink-0" />
                  <span className="text-xs text-gray-300">Fout</span>
                </div>
              </div>
            </>
          )}

          {open === "vlammen" && (
            <>
              <div className="text-[11px] text-gray-400 uppercase tracking-[0.15em] mb-1">
                Vlammen
              </div>
              <p className="text-[10px] text-gray-500 mb-2">
                Opeenvolgend punten gescoord
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#C9A84C" className="shrink-0">
                    <path fillRule="evenodd" d={FLAME_PATH} clipRule="evenodd" />
                  </svg>
                  <span className="text-xs text-gray-300">Reeks &ge; 5</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#005a94" className="shrink-0">
                    <path fillRule="evenodd" d={FLAME_PATH} clipRule="evenodd" />
                  </svg>
                  <span className="text-xs text-gray-300">Reeks &lt; 5</span>
                </div>
              </div>
            </>
          )}

          {open === "cirkels" && (
            <>
              <div className="text-[11px] text-gray-400 uppercase tracking-[0.15em] mb-2">
                Cirkels
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-cb-gold/20 text-cb-gold text-[10px] font-bold flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span className="text-xs text-gray-300">Exact</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-cb-blue/20 text-cb-blue text-[10px] font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span className="text-xs text-gray-300">Goal verschil</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span className="text-xs text-gray-300">Juist resultaat</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
