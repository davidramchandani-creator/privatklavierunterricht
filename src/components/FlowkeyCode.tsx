"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { FLOWKEY } from "@/lib/flowkey";

/**
 * Der Rabattcode als „Gutschein“ mit Kopieren-Knopf.
 */
export default function FlowkeyCode({ klein = false }: { klein?: boolean }) {
  const [kopiert, setKopiert] = useState(false);

  function kopieren() {
    navigator.clipboard?.writeText(FLOWKEY.code).then(() => {
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={kopieren}
      aria-label={`Code ${FLOWKEY.code} kopieren`}
      className={`group relative inline-flex items-center gap-3 rounded-2xl border-2 border-dashed bg-white transition-all hover:-translate-y-0.5 hover:shadow-lg ${
        klein ? "px-4 py-2.5" : "px-6 py-4"
      }`}
      style={{ borderColor: FLOWKEY.orange }}
    >
      <span className="text-left">
        <span className="block text-[11px] font-600 uppercase tracking-widest text-gray-400">Dein Code</span>
        <span
          className={`block font-800 tracking-[0.12em] leading-none mt-1 ${klein ? "text-2xl" : "text-3xl sm:text-4xl"}`}
          style={{ color: FLOWKEY.orange }}
        >
          {FLOWKEY.code}
        </span>
      </span>
      <span
        className={`flex items-center justify-center rounded-xl transition-colors ${klein ? "w-9 h-9" : "w-11 h-11"}`}
        style={{ background: kopiert ? "#ECFDF5" : "#FFF3E6" }}
      >
        {kopiert ? (
          <Check className="w-5 h-5 text-emerald-600" />
        ) : (
          <Copy className="w-5 h-5" style={{ color: FLOWKEY.orange }} />
        )}
      </span>
      <span className="sr-only" aria-live="polite">
        {kopiert ? "Kopiert" : ""}
      </span>
    </button>
  );
}
